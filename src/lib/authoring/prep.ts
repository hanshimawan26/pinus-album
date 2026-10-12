/**
 * photos:prep for one image, in memory: bytes in, new bytes (or "leave it") out.
 * Uses sharp for decoding and re-encoding, but never touches the filesystem, so it is
 * tested directly; prep-files.ts walks folders and writes files.
 *
 * Orientation: when pixels are re-encoded (resize or recompress), the EXIF rotation is
 * applied to the pixels and the Orientation tag is dropped, so the file is upright in every
 * viewer. When only metadata is removed, the pixels are not touched and the Orientation tag
 * is kept (browsers, sharp and the site's image pipeline all honour it).
 */
import exifr from 'exifr';
import sharp from 'sharp';
import { buildExifApp1, readTiff, textBytes, type KeptTags, type TiffFacts } from './exif-block.ts';
import { APP1, COM, exifTiffOf, isKeptSegment, parseJpeg, sameBytes, startsWithSignature, withMetadataOnly, type ParsedJpeg } from './jpeg.ts';
import { PREP_LIMITS, planJpeg, recompressionPays, type PrepAction } from './prep-rules.ts';

export interface PixelSize {
  width: number;
  height: number;
}

export interface ImageSnapshot extends PixelSize {
  bytes: number;
}

export interface JpegPrepResult {
  /** What was done. `none` = the file is already web-ready and stays exactly as it is. */
  action: PrepAction;
  /** The new file contents; undefined when the file stays as it is. */
  output?: Uint8Array;
  /** Upright pixel size and file size before and after. */
  before: ImageSnapshot;
  after: ImageSnapshot;
  /** Metadata removed from the file, in plain words (empty when nothing was written). */
  removed: string[];
  /** The photo was stored sideways and is now rotated upright in its pixels. */
  rotated: boolean;
  /** Why a planned re-encode was not kept, for the report. */
  note?: string;
}

const EMPTY_FACTS: TiffFacts = { tags: {}, hasGps: false, hasOtherTags: false };
const XMP_SIGNATURE = 'http://ns.adobe.com/xap/1.0/';

/** Text from an XMP or IPTC value: a string, a language alternative `{ value }`, or a list. */
export function embeddedText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(embeddedText).filter((part): part is string => part !== undefined);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }
  if (value && typeof value === 'object' && 'value' in value) return embeddedText((value as { value: unknown }).value);
  return undefined;
}

/**
 * Caption and photographer written into XMP or IPTC (by Lightroom, Photo Mechanic, …) are
 * moved into EXIF ImageDescription / Artist when EXIF has none, so dropping XMP and IPTC
 * keeps them for the planned fallback (TRD §4.6, P1).
 */
async function carriedOver(input: Uint8Array, parsed: ParsedJpeg, tags: KeptTags): Promise<KeptTags> {
  if (tags.imageDescription && tags.artist) return {};
  const hasXmpOrIptc = parsed.segments.some(
    (segment) => (segment.marker === APP1 && startsWithSignature(segment.data, XMP_SIGNATURE)) || segment.marker === 0xed,
  );
  if (!hasXmpOrIptc) return {};
  const found = (await exifr
    .parse(Buffer.from(input), {
      tiff: false,
      ifd1: false,
      exif: false,
      gps: false,
      interop: false,
      makerNote: false,
      userComment: false,
      icc: false,
      jfif: false,
      ihdr: false,
      xmp: true,
      iptc: true,
      mergeOutput: true,
    })
    .catch(() => undefined)) as Record<string, unknown> | undefined;
  if (!found) return {};
  const extra: KeptTags = {};
  const description = textBytes(embeddedText(found.description) ?? embeddedText(found.Caption) ?? '');
  const artist = textBytes(embeddedText(found.creator) ?? embeddedText(found.Byline) ?? '');
  if (!tags.imageDescription && description) extra.imageDescription = description;
  if (!tags.artist && artist) extra.artist = artist;
  return extra;
}

/** Plain-words list of the metadata that a rewrite drops, for the report. */
function describeRemoved(parsed: ParsedJpeg, facts: TiffFacts): string[] {
  const removed = new Set<string>();
  const xmp = parsed.segments.find((segment) => segment.marker === APP1 && startsWithSignature(segment.data, XMP_SIGNATURE));
  if (facts.hasGps || (xmp && /GPSLatitude|GPSLongitude/.test(new TextDecoder().decode(xmp.data)))) removed.add('GPS location');
  if (facts.hasOtherTags) removed.add('camera and software details');
  for (const segment of parsed.segments) {
    if (isKeptSegment(segment)) continue;
    if (segment.marker === APP1 && startsWithSignature(segment.data, 'Exif\0\0')) continue; // rebuilt
    if (segment.marker === APP1) removed.add('XMP');
    else if (segment.marker === 0xed) removed.add('IPTC');
    else if (segment.marker === COM) removed.add('comment');
    else removed.add('other metadata');
  }
  if (parsed.trailing.length > 0) removed.add('extra data after the image (for example a motion-photo video)');
  return [...removed];
}

/** Re-encode at the TRD §7 limits: upright pixels, long edge ≤ 2400 px, mozjpeg quality 85, no metadata. */
async function reencode(input: Uint8Array): Promise<Uint8Array> {
  return sharp(input)
    .rotate() // apply the EXIF orientation to the pixels
    .resize({ width: PREP_LIMITS.maxLongEdge, height: PREP_LIMITS.maxLongEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: PREP_LIMITS.jpegQuality, mozjpeg: true })
    .toBuffer();
}

/**
 * Bring one JPEG to the TRD §7 limits (see prep-rules.ts for the rules).
 * Throws when the file is not a readable JPEG.
 */
export async function prepareJpeg(input: Uint8Array): Promise<JpegPrepResult> {
  const parsed = parseJpeg(input);
  const metadata = await sharp(input).metadata();
  if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height) throw new Error('not a readable JPEG image');

  const tiff = exifTiffOf(parsed.segments);
  const facts = tiff ? readTiff(tiff) : EMPTY_FACTS;
  const tags: KeptTags = { ...facts.tags, ...(await carriedOver(input, parsed, facts.tags)) };
  const prepared = facts.tags.prepared === true;
  const before: ImageSnapshot = { ...metadata.autoOrient, bytes: input.length };

  /** The file with only the kept metadata and the pixels untouched. */
  const stripped = (marker: boolean) => withMetadataOnly(parsed, buildExifApp1({ ...tags, prepared: marker }));
  const metadataClean = sameBytes(stripped(prepared), input);
  const planned = planJpeg({ width: metadata.width, height: metadata.height, bytes: input.length, prepared, metadataClean });
  const unchanged: JpegPrepResult = { action: 'none', before, after: before, removed: [], rotated: false };

  let note: string | undefined;
  if (planned === 'resize' || planned === 'recompress') {
    const encoded = parseJpeg(await reencode(input));
    // The orientation is now in the pixels: the tag must go, or viewers would turn it again.
    const output = withMetadataOnly(encoded, buildExifApp1({ ...tags, orientation: undefined, prepared: true }));
    if (planned === 'resize' || recompressionPays(input.length, output.length)) {
      const after = await sharp(output).metadata();
      return {
        action: planned,
        output,
        before,
        after: { width: after.width ?? 0, height: after.height ?? 0, bytes: output.length },
        removed: describeRemoved(parsed, facts),
        rotated: (tags.orientation ?? 1) !== 1,
      };
    }
    note = 'not re-encoded: it would not get noticeably smaller';
  }

  if (metadataClean) return note ? { ...unchanged, note } : unchanged;
  const output = stripped(true);
  const result: JpegPrepResult = {
    action: 'strip',
    output,
    before,
    after: { ...before, bytes: output.length },
    removed: describeRemoved(parsed, facts),
    rotated: false,
  };
  if (note) result.note = note;
  return result;
}
