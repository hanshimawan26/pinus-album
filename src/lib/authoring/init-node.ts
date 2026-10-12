/**
 * photos:init on the filesystem: find the album folder (node), list its photos in display
 * order with the content engine, and add the missing photos.yaml entries (photos-yaml.ts).
 * The CLI in scripts/photos-init.ts only parses arguments and prints.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { ALBUMS_DIR } from '../config.ts';
import { comparePhotos, loadAlbums } from '../content/index.ts';
import type { ModelNode } from '../content/types.ts';
import { addMissingEntries, type SkippedPhotos } from './photos-yaml.ts';
import { isInside } from './target.ts';

export type InitNodeResult =
  | {
      ok: true;
      /** Absolute path of the node's photos.yaml. */
      photosYaml: string;
      created: boolean;
      added: string[];
      skipped: SkippedPhotos[];
      /** Photos in the node (hidden ones included). */
      photoCount: number;
    }
  | { ok: false; problem: string };

/**
 * The model node for `folder`, or a plain-English problem. `folder` must be an event or
 * section folder inside the albums folder (not the albums folder, not an @ folder).
 */
export function findNode(root: ModelNode, albumsAbs: string, folderAbs: string): { ok: true; node: ModelNode } | { ok: false; problem: string } {
  if (!isInside(albumsAbs, folderAbs)) {
    return { ok: false, problem: `The folder must be inside the albums folder (${ALBUMS_DIR}).` };
  }
  const rel = relative(albumsAbs, folderAbs);
  if (rel === '') {
    return { ok: false, problem: `That is the main albums folder. Give the folder of one event or section, for example ${ALBUMS_DIR}/my-event/day-1.` };
  }
  const segments = rel.split(sep).join('/').split('/');
  const photographerIndex = segments.findIndex((segment) => segment.startsWith('@'));
  if (photographerIndex !== -1) {
    const parent = segments.slice(0, photographerIndex).join('/');
    return {
      ok: false,
      problem: `"${segments[photographerIndex]}" is a photographer folder. Run photos:init on the album folder that contains it${parent ? ` (…/${parent})` : ''}: its photos.yaml lists the photos of every photographer folder in it.`,
    };
  }
  let node = root;
  for (const segment of segments) {
    const child = node.children.find((candidate) => candidate.source.folderName === segment);
    if (!child) return { ok: false, problem: `No album folder named "${segment}" was found there. Check the path (folders starting with "." are ignored).` };
    node = child;
  }
  return { ok: true, node };
}

/** Add the missing photos.yaml entries of the node at `folderAbs`. Writes only when something is added. */
export async function initNode(albumsAbs: string, folderAbs: string, options: { dryRun?: boolean } = {}): Promise<InitNodeResult> {
  const albums = await loadAlbums({ root: albumsAbs, includeDrafts: true });
  const found = findNode(albums.model.root, resolve(albumsAbs), resolve(folderAbs));
  if (!found.ok) return found;
  const { node } = found;

  // A near-miss name (Photos.yaml, photos.yml, photos.yaml.txt) is not read by the site, and on
  // Windows and macOS "photos.yaml" would even open "Photos.yaml". Have it renamed first.
  const misnamed = node.source.strays.find((stray) => stray.kind === 'misnamed-metadata' && /^photos?\.ya?ml/i.test(basename(stray.file)));
  if (misnamed) {
    const name = basename(misnamed.file);
    return { ok: false, problem: `This folder has "${name}", which the site does not read. Rename it to exactly "photos.yaml" first, then run photos:init again.` };
  }

  // Display order (by date, or by file name with `sort: filename`), so captions are written
  // in the order visitors see the photos. Unreadable images are still listed, by name.
  const ordered = [...node.photos].sort(comparePhotos(node.meta.sort)).map((photo) => photo.relPath);
  const unreadable = node.source.images.map((image) => image.relPath).filter((path) => !ordered.includes(path));
  const photoPaths = [...ordered, ...unreadable];

  const photosYaml = join(resolve(folderAbs), 'photos.yaml');
  const existing = await readFile(photosYaml, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  const result = addMissingEntries(existing, photoPaths);
  if (!result.ok) return result;
  if (result.added.length > 0 && !options.dryRun) await writeFile(photosYaml, result.text);
  return {
    ok: true,
    photosYaml,
    created: existing === undefined && result.added.length > 0,
    added: result.added,
    skipped: result.skipped,
    photoCount: photoPaths.length,
  };
}
