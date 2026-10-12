/**
 * photos:prep on the filesystem: find the images in a folder, prepare each JPEG in place
 * (prep.ts) and describe what happened to every other image. The CLI in
 * scripts/photos-prep.ts only parses arguments and prints.
 */
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { exifTiffBlock } from '../content/exif.ts';
import { classifyFile } from '../content/scan.ts';
import { LARGE_IMAGE_BYTES } from '../content/validate.ts';
import { readTiff } from './exif-block.ts';
import { prepareJpeg, type ImageSnapshot, type JpegPrepResult } from './prep.ts';
import { isOversize } from './prep-rules.ts';
import { isInDemoFolder } from './target.ts';

export type PrepOutcome =
  /** A JPEG, prepared (or already fine). `written` is false in a dry run or when unchanged. */
  | { kind: 'jpeg'; absPath: string; result: JpegPrepResult; written: boolean }
  /** HEIC/HEIF (by name or by content): must be converted first. */
  | { kind: 'heic'; absPath: string; disguised: boolean }
  /** PNG or WebP: left untouched; flagged when too big or carrying a location. */
  | { kind: 'other-format'; absPath: string; format: string; snapshot: ImageSnapshot; oversize: boolean; hasGps: boolean }
  /** An image format the site cannot use at all (.gif, .tiff, camera raw, …). */
  | { kind: 'unsupported'; absPath: string }
  /** A generated demo image (`src/albums/demo-*`): never changed (`npm run demo:images` owns it). */
  | { kind: 'demo'; absPath: string }
  /** The file could not be read or written. */
  | { kind: 'error'; absPath: string; message: string };

/** Every file under `target` (or `target` itself) that photos:prep looks at, sorted. Dot-files are skipped. */
export async function listPrepCandidates(target: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) return [target];
  const files: string[] = [];
  const walk = async (dir: string) => {
    const entries = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && ['image', 'heic', 'unsupported-image'].includes(classifyFile(entry.name))) files.push(path);
    }
  };
  await walk(target);
  return files;
}

/** Replace a file's contents via a temporary file and a rename, so a crash never leaves half a photo. */
async function replaceFile(absPath: string, bytes: Uint8Array): Promise<void> {
  const temporary = `${absPath}.photos-prep-tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, absPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface PrepFileOptions {
  dryRun?: boolean;
  /** The albums folder: images in its generated demo folders (`demo-*`) are left alone. */
  albumsAbs?: string;
}

/** Prepare one file (see {@link PrepOutcome}). Never throws. */
export async function prepFile(absPath: string, options: PrepFileOptions = {}): Promise<PrepOutcome> {
  if (options.albumsAbs !== undefined && isInDemoFolder(options.albumsAbs, absPath)) return { kind: 'demo', absPath };
  const kind = classifyFile(basename(absPath));
  if (kind === 'heic') return { kind: 'heic', absPath, disguised: false };
  if (kind === 'unsupported-image') return { kind: 'unsupported', absPath };

  let input: Buffer;
  let metadata: Metadata;
  try {
    input = await readFile(absPath);
    // Read through a buffer: a path would let sharp's cache keep the file open on Windows.
    metadata = await sharp(input).metadata();
  } catch (error) {
    return { kind: 'error', absPath, message: `could not be read as an image (${message(error)})` };
  }

  if (metadata.format === 'heif') return { kind: 'heic', absPath, disguised: true };
  if (metadata.format !== 'jpeg') {
    const tiff = metadata.exif ? exifTiffBlock(metadata.exif) : undefined;
    return {
      kind: 'other-format',
      absPath,
      format: metadata.format ?? 'unknown',
      snapshot: { ...metadata.autoOrient, bytes: input.length },
      oversize: isOversize(metadata.autoOrient.width, metadata.autoOrient.height, input.length, LARGE_IMAGE_BYTES),
      hasGps: tiff ? readTiff(tiff).hasGps : false,
    };
  }

  let result: JpegPrepResult;
  try {
    result = await prepareJpeg(input);
  } catch (error) {
    return { kind: 'error', absPath, message: `could not be prepared (${message(error)})` };
  }
  if (!result.output || options.dryRun) return { kind: 'jpeg', absPath, result, written: false };
  try {
    await replaceFile(absPath, result.output);
  } catch (error) {
    return { kind: 'error', absPath, message: `could not be saved (${message(error)}). Close any program that has it open and run photos:prep again.` };
  }
  return { kind: 'jpeg', absPath, result, written: true };
}
