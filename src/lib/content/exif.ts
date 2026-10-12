/**
 * Image facts read at build time: pixel size, EXIF orientation, EXIF dates and whether the
 * file carries a GPS position (for the photos:check privacy warning).
 * Together with scan.ts, the only content module that touches the filesystem.
 *
 * sharp reads the header (size, orientation and the raw EXIF block, for JPEG, PNG and WebP
 * alike); exifr decodes the EXIF block. Dates are returned raw: interpreting them in
 * TIMEZONE is dates.ts' job.
 *
 * P1 extension point: IPTC/XMP caption and Artist / By-line would be read here and passed
 * to resolve.ts as `EmbeddedMetadata`.
 */
import { readFile } from 'node:fs/promises';
import exifr from 'exifr';
import sharp from 'sharp';
import type { ImageInfo } from './types.ts';

/** EXIF orientations 5–8 rotate the image by 90°, so width and height swap when shown upright. */
export function uprightSize(width: number, height: number, orientation: number): { width: number; height: number } {
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

/** sharp returns JPEG/WebP EXIF with an `Exif\0\0` header; exifr wants the bare TIFF block. */
export function exifTiffBlock(exif: Buffer): Buffer {
  return exif.subarray(0, 6).toString('latin1') === 'Exif\0\0' ? exif.subarray(6) : exif;
}

interface ExifTags {
  DateTimeOriginal?: unknown;
  OffsetTimeOriginal?: unknown;
  GPSLatitude?: unknown;
  GPSLongitude?: unknown;
}

async function readExifTags(exif: Buffer | undefined): Promise<ExifTags> {
  if (!exif || exif.length === 0) return {};
  try {
    const tags = (await exifr.parse(exifTiffBlock(exif), {
      pick: ['DateTimeOriginal', 'OffsetTimeOriginal', 'GPSLatitude', 'GPSLongitude'],
      reviveValues: false,
      translateValues: false,
    })) as ExifTags | undefined;
    return tags ?? {};
  } catch {
    return {}; // A damaged EXIF block only means "no camera date".
  }
}

const asString = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

/**
 * Read size, orientation and EXIF dates of one image. Throws if the file is not a readable image.
 * The file is read into memory first: giving sharp a path lets its cache keep the file open,
 * which on Windows stops maintainers from deleting or renaming photos while `astro dev` runs.
 */
export async function readImageInfo(absPath: string): Promise<ImageInfo> {
  const metadata = await sharp(await readFile(absPath)).metadata();
  if (!metadata.width || !metadata.height) throw new Error('no image size found');
  const orientation = metadata.orientation && metadata.orientation >= 1 && metadata.orientation <= 8 ? metadata.orientation : 1;
  const tags = await readExifTags(metadata.exif);

  const info: ImageInfo = {
    format: metadata.format ?? 'unknown',
    ...uprightSize(metadata.width, metadata.height, orientation),
    orientation,
  };
  const dateTimeOriginal = asString(tags.DateTimeOriginal);
  const offsetTimeOriginal = asString(tags.OffsetTimeOriginal);
  if (dateTimeOriginal) info.exifDateTimeOriginal = dateTimeOriginal;
  if (offsetTimeOriginal) info.exifOffsetTimeOriginal = offsetTimeOriginal;
  if (tags.GPSLatitude !== undefined || tags.GPSLongitude !== undefined) info.hasGps = true;
  return info;
}
