/**
 * Filesystem helpers for checking the built site (dist/). Shared by the
 * `remove-source-copies` integration and `npm run verify:dist`.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const toPosix = (path: string) => path.split(sep).join('/');

/** Every file under `dir`, recursively, as absolute paths (sorted, so output is stable). */
export async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/** Path of `file` relative to `dir`, with forward slashes. */
export const relativePosix = (dir: string, file: string): string => toPosix(relative(dir, file));

async function sha256(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

export const SOURCE_IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;

export interface SourceCopy {
  /** Absolute path of the file in dist/. */
  distFile: string;
  /** Absolute path of the source image it is identical to. */
  sourceFile: string;
}

/**
 * Files in `distDir` that are byte-for-byte copies of a source image in `sourceDir`.
 * Sources keep their EXIF/GPS data, so no such copy may be published (TRD §7, §10).
 * Only files whose size matches a source image are hashed.
 */
export async function findSourceCopies(distDir: string, sourceDir: string): Promise<SourceCopy[]> {
  const sources = (await listFiles(sourceDir)).filter((file) => SOURCE_IMAGE_PATTERN.test(file));
  const sourcesBySize = new Map<number, string[]>();
  for (const file of sources) {
    const { size } = await stat(file);
    sourcesBySize.set(size, [...(sourcesBySize.get(size) ?? []), file]);
  }

  const sourceHashes = new Map<string, string>();
  const hashOfSource = async (file: string) => {
    let hash = sourceHashes.get(file);
    if (hash === undefined) {
      hash = await sha256(file);
      sourceHashes.set(file, hash);
    }
    return hash;
  };

  const copies: SourceCopy[] = [];
  for (const distFile of await listFiles(distDir)) {
    const candidates = sourcesBySize.get((await stat(distFile)).size);
    if (!candidates) continue;
    const hash = await sha256(distFile);
    for (const sourceFile of candidates) {
      if ((await hashOfSource(sourceFile)) === hash) {
        copies.push({ distFile, sourceFile });
        break;
      }
    }
  }
  return copies;
}
