/**
 * Per-photo metadata resolution (TRD §4.6) and photos.yaml key matching (TRD §4.4).
 * PURE: every function takes plain data and returns plain data.
 *
 * Precedence, highest first; the first source with a value wins:
 *
 * | Field        | 1                     | 2              | 3                            | 4                     |
 * |--------------|-----------------------|----------------|------------------------------|-----------------------|
 * | Caption      | photos.yaml caption   | P1: IPTC/XMP   | none                         |                       |
 * | Photographer | photos.yaml           | @folder        | nearest ancestor index.md    | P1: Artist / By-line  |
 * | Date         | photos.yaml date      | EXIF original  | nearest ancestor index.md    | none                  |
 * | Alt text     | photos.yaml alt       | caption        | generated                    |                       |
 * | Hidden       | photos.yaml hidden    |                |                              |                       |
 *
 * Absent values stay `undefined`; nothing is ever filled with "Unknown".
 */
import { exifToAlbumDate, toAlbumDate, type AlbumDate } from '../dates.ts';
import { initials, titleFromSlug } from '../slug.ts';
import type {
  AltSource,
  CaptionSource,
  DateSource,
  KeyMatchResult,
  PhotoOverride,
  Photographer,
  PhotographerEntry,
  PhotographerSource,
} from './types.ts';

// ---------------------------------------------------------------------------------------
// Photographers
// ---------------------------------------------------------------------------------------

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

/** Look up a photographer; unlisted slugs fall back to the slug title-cased (TRD §4.5). */
export function lookupPhotographer(slug: string, registry: ReadonlyMap<string, PhotographerEntry>): Photographer {
  const entry = registry.get(slug);
  const name = entry?.name ?? titleFromSlug(slug);
  const photographer: Photographer = { slug, name, initials: initials(name), listed: entry !== undefined };
  if (entry?.instagram) {
    photographer.instagram = entry.instagram;
    photographer.instagramUrl = instagramUrl(entry.instagram);
  }
  return photographer;
}

// ---------------------------------------------------------------------------------------
// Paths written by maintainers → files (index.md `cover`, photos.yaml keys)
// ---------------------------------------------------------------------------------------

/**
 * Repo-relative path an index.md `cover:` value points to. Paths are relative to the node
 * folder (`dir`) and may point into sub-folders; `./` and backslashes are tolerated.
 * Undefined for blank paths and paths that try to leave the folder.
 */
export function coverFile(dir: string, cover: string): string | undefined {
  const segments: string[] = [];
  for (const segment of cover.trim().replaceAll('\\', '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') return undefined;
    segments.push(segment);
  }
  return segments.length > 0 ? `${dir}/${segments.join('/')}` : undefined;
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** A photos.yaml key as a path relative to the node, and whether it is a path (not a bare file name). */
export function normaliseKey(key: string): { path: string; explicitPath: boolean } {
  const cleaned = key.trim().replaceAll('\\', '/');
  if (cleaned.startsWith('./')) return { path: cleaned.slice(2), explicitPath: true };
  return { path: cleaned, explicitPath: cleaned.includes('/') };
}

/**
 * Match photos.yaml keys to the photos of one node.
 * - A key with a `/` (or starting with `./`) is a path relative to the node and must match exactly.
 * - A bare file name matches by file name, and only if exactly one photo has that name.
 * Matching is case-sensitive, because the site is built on Linux; near misses are reported
 * with a suggestion.
 *
 * @param photoPaths relPaths of the node's photos
 * @param options.childFolders folder names of child nodes (to explain keys that point into them)
 * @param options.otherFiles relPaths of files that exist but are reported elsewhere (e.g. HEIC);
 *   keys matching them are not reported again as "no match"
 */
export function matchPhotoKeys(
  entries: ReadonlyMap<string, PhotoOverride>,
  photoPaths: readonly string[],
  options: { childFolders?: readonly string[]; otherFiles?: readonly string[] } = {},
): KeyMatchResult {
  const result: KeyMatchResult = { matched: new Map(), unmatched: [], ambiguous: [], duplicates: [] };
  const keysByPath = new Map<string, string[]>();

  for (const [key, override] of entries) {
    const { path, explicitPath } = normaliseKey(key);
    let target: string | undefined;

    if (explicitPath) {
      if (photoPaths.includes(path)) target = path;
    } else {
      const candidates = photoPaths.filter((photo) => baseName(photo) === path);
      if (candidates.length > 1) {
        result.ambiguous.push({ key, candidates });
        continue;
      }
      target = candidates[0];
    }

    if (target === undefined) {
      if (options.otherFiles?.some((file) => (explicitPath ? file === path : baseName(file) === path))) continue;
      result.unmatched.push({ key, ...nearMiss(path, explicitPath, photoPaths, options.childFolders ?? []) });
      continue;
    }

    const keys = keysByPath.get(target) ?? [];
    keys.push(key);
    keysByPath.set(target, keys);
    if (keys.length === 1) result.matched.set(target, { key, override });
  }

  for (const [relPath, keys] of keysByPath) {
    if (keys.length > 1) result.duplicates.push({ relPath, keys });
  }
  return result;
}

function nearMiss(
  path: string,
  explicitPath: boolean,
  photoPaths: readonly string[],
  childFolders: readonly string[],
): { suggestion?: string; reason?: 'case' | 'child-folder' } {
  const lower = path.toLowerCase();
  const caseMatch = photoPaths.find((photo) => (explicitPath ? photo : baseName(photo)).toLowerCase() === lower);
  if (caseMatch) return { suggestion: explicitPath ? caseMatch : baseName(caseMatch), reason: 'case' };
  const firstSegment = path.split('/')[0] ?? '';
  if (explicitPath && childFolders.includes(firstSegment)) return { suggestion: firstSegment, reason: 'child-folder' };
  return {};
}

// ---------------------------------------------------------------------------------------
// Precedence (TRD §4.6)
// ---------------------------------------------------------------------------------------

/**
 * P1 extension point: metadata embedded in the file by the camera or an editor
 * (IPTC/XMP description, EXIF Artist / IPTC By-line). Not read in P0; when exif.ts starts
 * reading it, pass it in {@link PhotoContext.embedded} and the precedence below applies.
 */
export interface EmbeddedMetadata {
  description?: string;
  /** Photographer slug derived from Artist / By-line. */
  artist?: string;
}

/** index.md values of one ancestor node (the photo's own node counts as the nearest). */
export interface AncestorMeta {
  photographer?: string;
  date?: AlbumDate;
}

/** Everything the precedence rules look at for one photo. */
export interface PhotoContext {
  override?: PhotoOverride;
  embedded?: EmbeddedMetadata;
  exif?: { dateTimeOriginal?: string; offsetTimeOriginal?: string };
  /** Photographer slug from the photo's `@folder`. */
  folderPhotographer?: string;
  /** index.md values, own node first, then parent, … up to the event. */
  ancestors: readonly AncestorMeta[];
  /** Title of the photo's own node, for generated alt text. */
  nodeTitle: string;
  registry: ReadonlyMap<string, PhotographerEntry>;
  timeZone: string;
}

export interface Resolved<T, S> {
  value?: T;
  source?: S;
}

function firstOf<T, S>(...candidates: [T | undefined, S][]): Resolved<T, S> {
  for (const [value, source] of candidates) {
    if (value !== undefined) return { value, source };
  }
  return {};
}

export function resolveCaption(ctx: PhotoContext): Resolved<string, CaptionSource> {
  return firstOf<string, CaptionSource>(
    [ctx.override?.caption, 'photos.yaml'],
    [ctx.embedded?.description, 'embedded'],
  );
}

export function resolvePhotographerSlug(ctx: PhotoContext): Resolved<string, PhotographerSource> {
  return firstOf<string, PhotographerSource>(
    [ctx.override?.photographer, 'photos.yaml'],
    [ctx.folderPhotographer, 'folder'],
    [ctx.ancestors.find((a) => a.photographer !== undefined)?.photographer, 'index.md'],
    [ctx.embedded?.artist, 'embedded'],
  );
}

export function resolveDate(ctx: PhotoContext): Resolved<AlbumDate, DateSource> {
  const override = ctx.override?.date;
  return firstOf<AlbumDate, DateSource>(
    [override ? toAlbumDate(override, ctx.timeZone) : undefined, 'photos.yaml'],
    [exifToAlbumDate(ctx.exif?.dateTimeOriginal, ctx.exif?.offsetTimeOriginal, ctx.timeZone), 'exif'],
    [ctx.ancestors.find((a) => a.date !== undefined)?.date, 'index.md'],
  );
}

/** "Photo from {node title} by {photographer}", or without the "by" part when unknown. */
export function generatedAlt(nodeTitle: string, photographerName?: string): string {
  return photographerName ? `Photo from ${nodeTitle} by ${photographerName}` : `Photo from ${nodeTitle}`;
}

export function resolveAlt(
  ctx: PhotoContext,
  caption: string | undefined,
  photographerName: string | undefined,
): { value: string; source: AltSource } {
  if (ctx.override?.alt !== undefined) return { value: ctx.override.alt, source: 'photos.yaml' };
  // Alt text is read aloud as one sentence, so a multi-line caption becomes one line.
  if (caption !== undefined) return { value: caption.replace(/\s+/g, ' ').trim(), source: 'caption' };
  return { value: generatedAlt(ctx.nodeTitle, photographerName), source: 'generated' };
}

export function resolveHidden(ctx: PhotoContext): boolean {
  return ctx.override?.hidden ?? false;
}

export interface ResolvedPhotoMetadata {
  caption?: string;
  photographer?: Photographer;
  date?: AlbumDate;
  alt: string;
  hidden: boolean;
  sources: { caption?: CaptionSource; photographer?: PhotographerSource; date?: DateSource; alt: AltSource };
}

/** Apply the whole §4.6 table to one photo. */
export function resolvePhotoMetadata(ctx: PhotoContext): ResolvedPhotoMetadata {
  const caption = resolveCaption(ctx);
  const photographerSlug = resolvePhotographerSlug(ctx);
  const photographer =
    photographerSlug.value !== undefined ? lookupPhotographer(photographerSlug.value, ctx.registry) : undefined;
  const date = resolveDate(ctx);
  const alt = resolveAlt(ctx, caption.value, photographer?.name);

  const resolved: ResolvedPhotoMetadata = {
    alt: alt.value,
    hidden: resolveHidden(ctx),
    sources: { alt: alt.source },
  };
  if (caption.value !== undefined) {
    resolved.caption = caption.value;
    resolved.sources.caption = caption.source;
  }
  if (photographer) {
    resolved.photographer = photographer;
    resolved.sources.photographer = photographerSlug.source;
  }
  if (date.value !== undefined) {
    resolved.date = date.value;
    resolved.sources.date = date.source;
  }
  return resolved;
}
