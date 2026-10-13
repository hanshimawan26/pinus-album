/**
 * In-memory source trees for testing the pure content modules (model, tree, validate)
 * without touching the filesystem.
 */
import { buildModel } from '../../src/lib/content/model.ts';
import { buildTree } from '../../src/lib/content/tree.ts';
import type { ImageInfo, Issue, SourceImage, SourceNode, SourceTree, StrayKind } from '../../src/lib/content/types.ts';
import { validateContent } from '../../src/lib/content/validate.ts';

export const ROOT = 'src/albums';
export const TZ = 'Asia/Singapore';

export interface ImageSpec {
  /** EXIF DateTimeOriginal, e.g. `2026:09:20 10:00:00`. */
  exif?: string;
  offset?: string;
  size?: number;
  width?: number;
  height?: number;
  orientation?: number;
  /** Content format detected by sharp (default `jpeg`). */
  format?: string;
  /** Simulate an unreadable file. */
  readError?: string;
  /** The EXIF data includes a GPS position. */
  gps?: boolean;
}

export interface NodeSpec {
  folder: string;
  index?: string;
  photos?: string;
  /** relPath → spec; an array means "default specs". */
  images?: Record<string, ImageSpec> | string[];
  strays?: { kind: StrayKind; path: string }[];
  children?: NodeSpec[];
}

function makeImage(dir: string, relPath: string, spec: ImageSpec): SourceImage {
  const image: SourceImage = {
    relPath,
    file: `${dir}/${relPath}`,
    absPath: `/abs/${dir}/${relPath}`,
    size: spec.size ?? 100_000,
    mtimeMs: 0,
  };
  if (relPath.startsWith('@')) image.photographerFolder = relPath.slice(1, relPath.indexOf('/'));
  if (spec.readError !== undefined) {
    image.readError = spec.readError;
    return image;
  }
  const info: ImageInfo = {
    format: spec.format ?? 'jpeg',
    width: spec.width ?? 1600,
    height: spec.height ?? 1067,
    orientation: spec.orientation ?? 1,
  };
  if (spec.exif) info.exifDateTimeOriginal = spec.exif;
  if (spec.offset) info.exifOffsetTimeOriginal = spec.offset;
  if (spec.gps) info.hasGps = true;
  image.info = info;
  return image;
}

function makeNode(spec: NodeSpec, parentDir: string): SourceNode {
  const dir = `${parentDir}/${spec.folder}`;
  const images = Array.isArray(spec.images)
    ? Object.fromEntries(spec.images.map((path) => [path, {} as ImageSpec]))
    : (spec.images ?? {});
  const node: SourceNode = {
    folderName: spec.folder,
    dir,
    images: Object.entries(images).map(([relPath, imageSpec]) => makeImage(dir, relPath, imageSpec)),
    strays: (spec.strays ?? []).map(({ kind, path }) => ({ kind, file: `${dir}/${path}` })),
    children: (spec.children ?? []).map((child) => makeNode(child, dir)),
  };
  if (spec.index !== undefined) node.indexMd = { file: `${dir}/index.md`, text: spec.index };
  if (spec.photos !== undefined) node.photosYaml = { file: `${dir}/photos.yaml`, text: spec.photos };
  return node;
}

export function sourceTree(
  events: NodeSpec[],
  options: { photographers?: string; totalBytes?: number; rootStrays?: { kind: StrayKind; path: string }[] } = {},
): SourceTree {
  const tree: SourceTree = {
    root: {
      folderName: 'albums',
      dir: ROOT,
      images: [],
      strays: (options.rootStrays ?? []).map(({ kind, path }) => ({ kind, file: `${ROOT}/${path}` })),
      children: events.map((event) => makeNode(event, ROOT)),
    },
    totalBytes: options.totalBytes ?? 0,
  };
  if (options.photographers !== undefined) {
    tree.photographersYaml = { file: `${ROOT}/photographers.yaml`, text: options.photographers };
  }
  return tree;
}

/** Frontmatter-only index.md from a YAML string. */
export const index = (yaml: string, story = '') => `---\n${yaml}\n---\n${story}`;

/** Run the pure pipeline. */
export function build(tree: SourceTree, includeDrafts = false, includeHidden = false) {
  const model = buildModel(tree, TZ);
  return { model, root: buildTree(model, { includeDrafts, includeHidden }), issues: validateContent(model) };
}

export const codes = (issues: readonly Issue[]) => issues.map((issue) => issue.code);
