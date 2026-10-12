/**
 * Content engine entry point: scan → EXIF → model → tree + validation.
 *
 * `loadAlbums()` is what pages and `photos:check` call. Results are memoised per options;
 * each call re-scans the folder (a quick directory walk) and only rebuilds when a file
 * changed, so `astro dev` picks up new photos without a restart. EXIF is cached per file
 * (path + size + modification time).
 */
import { relative, resolve, sep } from 'node:path';
import { ALBUMS_DIR, TIMEZONE } from '../config.ts';
import { isValidTimeZone } from '../dates.ts';
import { readImageInfo } from './exif.ts';
import { buildModel } from './model.ts';
import { scanAlbums } from './scan.ts';
import { buildTree, indexNodes } from './tree.ts';
import type { AlbumNode, ContentModel, ImageInfo, Issue, ModelNode, Photographer, SourceNode, SourceTree } from './types.ts';
import { lookupPhotographer } from './resolve.ts';
import { validateContent } from './validate.ts';

export type * from './types.ts';
export { pathTo, siblingsOf, photosInSubtree, slugPathKey } from './tree.ts';

export interface LoadOptions {
  /** Albums folder; default `src/albums` under the current working directory. */
  root?: string;
  /** Include draft nodes (dev). Default false (production). */
  includeDrafts?: boolean;
  /** IANA zone for EXIF dates and display. Default: TIMEZONE from config. */
  timeZone?: string;
}

export interface Albums {
  /** Virtual root; its children are the events, newest first. */
  root: AlbumNode;
  /** Every published node by slug path (`demo-event-a/day-1`); the root is `''`. */
  nodes: ReadonlyMap<string, AlbumNode>;
  /** Photographers listed in photographers.yaml or credited on a published photo. */
  photographers: ReadonlyMap<string, Photographer>;
  /** All validation issues (drafts and hidden photos included), errors first. */
  issues: readonly Issue[];
  errors: readonly Issue[];
  warnings: readonly Issue[];
  stats: { nodes: number; photos: number; hiddenPhotos: number; draftNodes: number; totalBytes: number };
}

// ---------------------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------------------

const toPosix = (path: string) => path.split(sep).join('/');

/** Repo-relative POSIX display path of the albums folder (absolute if outside the cwd). */
function displayPathOf(rootAbs: string): string {
  const rel = relative(process.cwd(), rootAbs);
  return rel === '' ? '.' : rel.startsWith('..') || /^[a-zA-Z]:/.test(rel) ? toPosix(rootAbs) : toPosix(rel);
}

const infoCache = new Map<string, { key: string; info?: ImageInfo; error?: string }>();

async function readAllImageInfo(tree: SourceTree): Promise<void> {
  const images = allSourceNodes(tree.root).flatMap((node) => node.images);
  await mapWithConcurrency(images, 8, async (image) => {
    const key = `${image.size}:${image.mtimeMs}`;
    let cached = infoCache.get(image.absPath);
    if (cached?.key !== key) {
      try {
        cached = { key, info: await readImageInfo(image.absPath) };
      } catch (error) {
        cached = { key, error: error instanceof Error ? error.message : String(error) };
      }
      infoCache.set(image.absPath, cached);
    }
    if (cached.info) image.info = cached.info;
    if (cached.error !== undefined) image.readError = cached.error;
  });
}

function allSourceNodes(node: SourceNode): SourceNode[] {
  return [node, ...node.children.flatMap(allSourceNodes)];
}

async function mapWithConcurrency<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** Changes whenever any scanned file, its size or modification time changes. */
function fingerprint(tree: SourceTree): string {
  const parts: string[] = [tree.photographersYaml?.text ?? ''];
  for (const node of allSourceNodes(tree.root)) {
    parts.push(node.dir, node.indexMd?.text ?? '', node.photosYaml?.text ?? '');
    for (const image of node.images) parts.push(`${image.file}|${image.size}|${image.mtimeMs}`);
    for (const stray of node.strays) parts.push(`${stray.kind}|${stray.file}`);
  }
  return parts.join('\n');
}

function countModel(model: ContentModel): Albums['stats'] {
  const stats = { nodes: 0, photos: 0, hiddenPhotos: 0, draftNodes: 0, totalBytes: model.totalBytes };
  const visit = (node: ModelNode) => {
    if (node.depth > 0) stats.nodes++;
    if (node.meta.draft) stats.draftNodes++;
    stats.photos += node.photos.length;
    stats.hiddenPhotos += node.photos.filter((photo) => photo.hidden).length;
    node.children.forEach(visit);
  };
  visit(model.root);
  return stats;
}

function collectPhotographers(model: ContentModel, root: AlbumNode): Map<string, Photographer> {
  const photographers = new Map<string, Photographer>();
  for (const slug of model.registry.keys()) photographers.set(slug, lookupPhotographer(slug, model.registry));
  const visit = (node: AlbumNode) => {
    for (const photo of node.photos) {
      if (photo.photographer && !photographers.has(photo.photographer.slug)) {
        photographers.set(photo.photographer.slug, photo.photographer);
      }
    }
    node.children.forEach(visit);
  };
  visit(root);
  return photographers;
}

async function build(includeDrafts: boolean, timeZone: string, tree: SourceTree): Promise<Albums> {
  await readAllImageInfo(tree);
  const model = buildModel(tree, timeZone);
  const root = buildTree(model, { includeDrafts });
  const issues = validateContent(model);
  return {
    root,
    nodes: indexNodes(root),
    photographers: collectPhotographers(model, root),
    issues,
    errors: issues.filter((issue) => issue.level === 'error'),
    warnings: issues.filter((issue) => issue.level === 'warning'),
    stats: countModel(model),
  };
}

const memo = new Map<string, { fingerprint: string; result: Promise<Albums> }>();

/** Load, resolve and validate all albums. Never throws for content problems: see `issues`. */
export async function loadAlbums(options: LoadOptions = {}): Promise<Albums> {
  const rootAbs = resolve(options.root ?? ALBUMS_DIR);
  const includeDrafts = options.includeDrafts ?? false;
  const timeZone = options.timeZone ?? TIMEZONE;
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`TIMEZONE "${timeZone}" is not a valid time zone name. Use an IANA name such as Asia/Singapore.`);
  }

  const tree = await scanAlbums(rootAbs, displayPathOf(rootAbs));
  const key = JSON.stringify([rootAbs, includeDrafts, timeZone]);
  const print = fingerprint(tree);
  const cached = memo.get(key);
  if (cached && cached.fingerprint === print) return cached.result;

  const result = build(includeDrafts, timeZone, tree);
  memo.set(key, { fingerprint: print, result });
  result.catch(() => memo.delete(key));
  return result;
}

// ---------------------------------------------------------------------------------------
// Failing the build
// ---------------------------------------------------------------------------------------

/** Thrown by {@link loadAlbumsOrThrow}; the message lists every error. */
export class AlbumContentError extends Error {
  readonly issues: readonly Issue[];
  constructor(errors: readonly Issue[]) {
    super(formatBuildErrors(errors));
    this.name = 'AlbumContentError';
    this.issues = errors;
  }
}

/** One readable message listing every error-level issue. */
export function formatBuildErrors(errors: readonly Issue[]): string {
  const lines = errors.map((issue) => `  - ${issue.file}\n    ${issue.message.replaceAll('\n', '\n    ')}`);
  return [
    `The photo albums have ${errors.length} error${errors.length === 1 ? '' : 's'}, so the site cannot be built:`,
    '',
    ...lines,
    '',
    'Run "npm run photos:check" to see all errors and warnings.',
  ].join('\n');
}

/** Like {@link loadAlbums}, but throws one {@link AlbumContentError} if there are errors (used by pages). */
export async function loadAlbumsOrThrow(options: LoadOptions = {}): Promise<Albums> {
  const albums = await loadAlbums(options);
  if (albums.errors.length > 0) throw new AlbumContentError(albums.errors);
  return albums;
}
