/**
 * Filesystem walk of the albums folder → SourceTree (TRD §4.1–4.2).
 * Together with exif.ts, the only content module that touches the filesystem.
 *
 * - A node is any folder not starting with `@` or `.`.
 * - `@<slug>` folders directly inside a node are photographer folders (never nodes).
 * - Supported images: .jpg .jpeg .png .webp (any letter case). Other image-like files,
 *   videos, near-miss metadata file names and metadata files in a place where they are not
 *   read (an `@` folder, the albums folder itself) are recorded as "strays" for validation,
 *   so nothing a maintainer wrote is silently ignored.
 * - Hidden files and folders (starting with `.`) are ignored.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { photographerSlug } from '../slug.ts';
import type { SourceImage, SourceNode, SourceText, SourceTree, StrayKind } from './types.ts';

export const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
const HEIC_EXTENSIONS = ['.heic', '.heif'];
const OTHER_IMAGE_EXTENSIONS = [
  '.gif', '.bmp', '.tif', '.tiff', '.avif', '.jxl', '.jfif', '.svg', '.ico', '.psd',
  '.raw', '.dng', '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.raf', '.srw', '.pef',
];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp'];
/**
 * Names that were clearly meant to be a metadata file: other letter cases, `.yml`,
 * singular forms, and the `.txt` ending Windows Notepad adds when extensions are hidden.
 */
const NEAR_MISS_METADATA = /^(index\.(md|markdown)|photos?\.ya?ml|photographers?\.ya?ml)(\.txt)?$/i;

export type FileKind = 'image' | 'index' | 'photos' | 'photographers' | StrayKind | 'ignore';

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
};

/** Classify a file inside a node folder by its name. Pure. */
export function classifyFile(name: string): FileKind {
  if (name === 'index.md') return 'index';
  if (name === 'photos.yaml') return 'photos';
  if (name === 'photographers.yaml') return 'photographers';
  if (NEAR_MISS_METADATA.test(name)) return 'misnamed-metadata';
  const extension = extensionOf(name);
  if ((SUPPORTED_EXTENSIONS as readonly string[]).includes(extension)) return 'image';
  if (HEIC_EXTENSIONS.includes(extension)) return 'heic';
  if (OTHER_IMAGE_EXTENSIONS.includes(extension)) return 'unsupported-image';
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  return 'ignore';
}

interface Walk {
  totalBytes: number;
}

const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

async function listDir(absDir: string) {
  return (await readdir(absDir, { withFileTypes: true })).filter((entry) => !entry.name.startsWith('.')).sort(byName);
}

async function readText(absPath: string, file: string): Promise<SourceText> {
  return { file, text: await readFile(absPath, 'utf8') };
}

/**
 * Scan the albums folder.
 * @param rootAbs absolute path of the albums folder
 * @param displayRoot repo-relative POSIX path of the same folder (used in all `file` fields)
 */
export async function scanAlbums(rootAbs: string, displayRoot: string): Promise<SourceTree> {
  const rootStat = await stat(rootAbs).catch(() => undefined);
  if (!rootStat?.isDirectory()) throw new Error(`Album folder not found: ${rootAbs}`);

  const walk: Walk = { totalBytes: 0 };
  const tree: SourceTree = { root: await scanNode(rootAbs, displayRoot, true, walk), totalBytes: 0 };
  const photographersYaml = join(rootAbs, 'photographers.yaml');
  if ((await stat(photographersYaml).catch(() => undefined))?.isFile()) {
    tree.photographersYaml = await readText(photographersYaml, `${displayRoot}/photographers.yaml`);
  }
  tree.totalBytes = walk.totalBytes;
  return tree;
}

async function scanNode(absDir: string, dir: string, isRoot: boolean, walk: Walk): Promise<SourceNode> {
  const folderName = dir.slice(dir.lastIndexOf('/') + 1);
  const node: SourceNode = { folderName, dir, images: [], strays: [], children: [] };

  for (const entry of await listDir(absDir)) {
    const abs = join(absDir, entry.name);
    const file = `${dir}/${entry.name}`;

    if (entry.isDirectory()) {
      if (!entry.name.startsWith('@')) {
        node.children.push(await scanNode(abs, file, false, walk));
      } else if (isRoot) {
        node.strays.push({ kind: 'outside-event', file });
        await addFolderSize(abs, walk);
      } else {
        await scanPhotographerFolder(abs, file, entry.name, node, walk);
      }
      continue;
    }
    if (!entry.isFile()) continue;

    const info = await stat(abs);
    walk.totalBytes += info.size;
    const kind = classifyFile(entry.name);
    const stray = isRoot ? rootStray(kind, entry.name) : nodeStray(kind, entry.name);
    if (stray) node.strays.push({ kind: stray, file });
    else if (isRoot) continue; // photographers.yaml is read by scanAlbums
    else if (kind === 'index') node.indexMd = await readText(abs, file);
    else if (kind === 'photos') node.photosYaml = await readText(abs, file);
    else if (kind === 'image') node.images.push(sourceImage(abs, file, entry.name, info));
  }
  return node;
}

const isPhotographersName = (name: string) => /^photographer/i.test(name);

/** What a file inside an event or section folder must be reported as, if anything. */
function nodeStray(kind: FileKind, name: string): StrayKind | undefined {
  if (kind === 'photographers' || (kind === 'misnamed-metadata' && isPhotographersName(name))) return 'photographers-yaml-in-node';
  if (kind === 'index' || kind === 'photos' || kind === 'image' || kind === 'ignore') return undefined;
  return kind;
}

/** The albums folder holds event folders and photographers.yaml only. */
function rootStray(kind: FileKind, name: string): StrayKind | undefined {
  switch (kind) {
    case 'image':
    case 'heic':
    case 'unsupported-image':
      return 'outside-event';
    case 'index':
    case 'photos':
      return 'metadata-in-albums-folder';
    case 'misnamed-metadata':
      return isPhotographersName(name) ? 'misnamed-metadata' : 'metadata-in-albums-folder';
    case 'photographers':
    case 'ignore':
      return undefined;
    default:
      return kind;
  }
}

async function scanPhotographerFolder(absDir: string, dir: string, name: string, node: SourceNode, walk: Walk) {
  const slug = photographerSlug(name);
  if (slug === '') {
    node.strays.push({ kind: 'invalid-photographer-folder', file: dir });
    await addFolderSize(absDir, walk);
    return;
  }
  for (const entry of await listDir(absDir)) {
    const abs = join(absDir, entry.name);
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      node.strays.push({ kind: 'nested-in-photographer-folder', file });
      await addFolderSize(abs, walk);
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(abs);
    walk.totalBytes += info.size;
    const kind = classifyFile(entry.name);
    if (kind === 'image') {
      node.images.push({ ...sourceImage(abs, file, `${name}/${entry.name}`, info), photographerFolder: slug });
    } else if (kind === 'heic' || kind === 'unsupported-image' || kind === 'video') {
      node.strays.push({ kind, file });
    } else if (kind !== 'ignore') {
      // index.md, photos.yaml, … are only read in the node folder itself. Ignoring them here
      // would silently drop a `hidden: true` or `draft: true`.
      node.strays.push({ kind: 'metadata-in-photographer-folder', file });
    }
  }
}

function sourceImage(absPath: string, file: string, relPath: string, info: { size: number; mtimeMs: number }): SourceImage {
  return { relPath, file, absPath, size: info.size, mtimeMs: info.mtimeMs };
}

/** Count the bytes of a folder that is reported as a whole (so the size total stays honest). */
async function addFolderSize(absDir: string, walk: Walk): Promise<void> {
  for (const entry of await readdir(absDir, { withFileTypes: true })) {
    const abs = join(absDir, entry.name);
    if (entry.isDirectory()) await addFolderSize(abs, walk);
    else if (entry.isFile()) walk.totalBytes += (await stat(abs)).size;
  }
}
