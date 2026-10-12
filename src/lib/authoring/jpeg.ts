/**
 * JPEG file structure: split a JPEG into its marker segments and put it back together.
 * PURE: bytes in, bytes out. Used by photos:prep to remove metadata **without re-encoding**
 * (the pixels are never touched, so there is no quality loss).
 *
 * A JPEG is `SOI`, a run of marker segments (APPn metadata, tables, frame header), then
 * one or more scans of entropy-coded image data, then `EOI`. Anything after `EOI` is not
 * part of the image (phones append motion-photo videos, HDR gain maps or vendor data there).
 */

/** One marker segment before the first scan, e.g. APP1 (EXIF) or DQT. */
export interface JpegSegment {
  /** Marker byte after 0xFF: 0xE1 = APP1, 0xDB = DQT, 0xC0 = SOF0, … */
  marker: number;
  /** Segment payload, without the marker and the 2-byte length. */
  data: Uint8Array;
}

export interface ParsedJpeg {
  /** Segments between SOI and the first SOS, in file order. */
  segments: JpegSegment[];
  /** From the first SOS marker up to and including EOI: the image data, kept as is. */
  scan: Uint8Array;
  /** Bytes after EOI (not part of the image). */
  trailing: Uint8Array;
}

export const APP0 = 0xe0;
export const APP1 = 0xe1;
export const APP2 = 0xe2;
export const APP14 = 0xee;
export const COM = 0xfe;
const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

const latin1 = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));

/** Does the segment payload start with this ASCII signature (e.g. `Exif\0\0`, `ICC_PROFILE\0`)? */
export function startsWithSignature(data: Uint8Array, signature: string): boolean {
  return latin1(data, 0, signature.length) === signature;
}

export const isJpeg = (bytes: Uint8Array): boolean => bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === SOI;

/** Markers that stand alone (no length field): TEM and RST0–7. SOI/EOI are handled separately. */
const isStandalone = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/**
 * Split a JPEG into segments, image data and trailing bytes.
 * Throws a readable error when the file is not a structurally valid JPEG.
 */
export function parseJpeg(bytes: Uint8Array): ParsedJpeg {
  if (!isJpeg(bytes)) throw new Error('not a JPEG file (no start-of-image marker)');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const segments: JpegSegment[] = [];
  let offset = 2;

  for (;;) {
    if (offset >= bytes.length || bytes[offset] !== 0xff) throw new Error(`damaged JPEG: expected a marker at byte ${offset}`);
    while (bytes[offset + 1] === 0xff) offset++; // fill bytes
    const marker = bytes[offset + 1] ?? 0;
    if (marker === SOS) break;
    if (marker === EOI) throw new Error('damaged JPEG: the file ends before any image data');
    if (isStandalone(marker)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) throw new Error('damaged JPEG: a segment is cut off');
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) throw new Error('damaged JPEG: a segment is cut off');
    segments.push({ marker, data: bytes.slice(offset + 4, offset + 2 + length) });
    offset += 2 + length;
  }

  const scanStart = offset;
  const scanEnd = findEndOfImage(bytes, view, scanStart);
  return { segments, scan: bytes.slice(scanStart, scanEnd), trailing: bytes.slice(scanEnd) };
}

/**
 * Offset just after EOI. Walks scans and the segments between them (progressive JPEGs have
 * several scans with tables in between). Inside entropy-coded data, 0xFF is followed by 0x00
 * (a stuffed byte) or a restart marker; anything else is a real marker. A file that ends
 * without EOI (truncated by some apps) keeps all its bytes.
 */
function findEndOfImage(bytes: Uint8Array, view: DataView, start: number): number {
  let offset = start;
  while (offset + 4 <= bytes.length) {
    // `offset` is at a marker with a length (SOS or a table between scans).
    const length = view.getUint16(offset + 2);
    const isScan = bytes[offset + 1] === SOS;
    offset += 2 + length;
    if (!isScan) {
      if (bytes[offset] !== 0xff) return bytes.length;
      while (bytes[offset + 1] === 0xff) offset++;
      if (bytes[offset + 1] === EOI) return offset + 2;
      continue;
    }
    // Skip entropy-coded data up to the next real marker.
    for (;;) {
      if (offset + 1 >= bytes.length) return bytes.length;
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const next = bytes[offset + 1] ?? 0;
      if (next === 0x00 || next === 0xff || isStandalone(next)) {
        offset += next === 0xff ? 1 : 2;
        continue;
      }
      if (next === EOI) return offset + 2;
      break; // another segment (DHT, SOS, DRI, …)
    }
  }
  return bytes.length;
}

/** Reassemble a JPEG from its parts. `parseJpeg` followed by `serialiseJpeg` is lossless. */
export function serialiseJpeg(parsed: { segments: readonly JpegSegment[]; scan: Uint8Array; trailing?: Uint8Array }): Uint8Array {
  const trailing = parsed.trailing ?? new Uint8Array(0);
  const size = 2 + parsed.segments.reduce((sum, segment) => sum + 4 + segment.data.length, 0) + parsed.scan.length + trailing.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  out[0] = 0xff;
  out[1] = SOI;
  let offset = 2;
  for (const segment of parsed.segments) {
    if (segment.data.length + 2 > 0xffff) throw new Error('a JPEG segment is too large');
    out[offset] = 0xff;
    out[offset + 1] = segment.marker;
    view.setUint16(offset + 2, segment.data.length + 2);
    out.set(segment.data, offset + 4);
    offset += 4 + segment.data.length;
  }
  out.set(parsed.scan, offset);
  out.set(trailing, offset + parsed.scan.length);
  return out;
}

/** The TIFF block inside the first EXIF APP1 segment (after `Exif\0\0`), if any. */
export function exifTiffOf(segments: readonly JpegSegment[]): Uint8Array | undefined {
  const app1 = segments.find((segment) => segment.marker === APP1 && startsWithSignature(segment.data, 'Exif\0\0'));
  return app1?.data.subarray(6);
}

/**
 * Segments a web-ready master keeps: the image itself (tables, frame header, …), plus the
 * three APP segments needed to show the pixels correctly:
 * - APP0 `JFIF` (pixel density, harmless),
 * - APP2 `ICC_PROFILE` (colour profile: without it, wide-gamut phone photos change colour),
 * - APP14 `Adobe` (tells decoders how the colour channels are stored).
 * Everything else that carries metadata is dropped: EXIF (rebuilt separately with only the
 * kept tags), XMP, IPTC/Photoshop, MPF and other APPn segments, and comments.
 */
export function isKeptSegment(segment: JpegSegment): boolean {
  const { marker, data } = segment;
  if (marker === APP0) return startsWithSignature(data, 'JFIF\0');
  if (marker === APP2) return startsWithSignature(data, 'ICC_PROFILE\0');
  if (marker === APP14) return startsWithSignature(data, 'Adobe');
  if (marker >= 0xe0 && marker <= 0xef) return false;
  return marker !== COM;
}

/**
 * The same JPEG with only the kept segments, the given EXIF block (if any) and no trailing
 * data. The EXIF APP1 goes first, after a JFIF APP0 when there is one.
 * @param exif complete APP1 payload (`Exif\0\0` + TIFF), or undefined for none
 */
export function withMetadataOnly(parsed: ParsedJpeg, exif: Uint8Array | undefined): Uint8Array {
  const kept = parsed.segments.filter(isKeptSegment);
  const jfif = kept.filter((segment) => segment.marker === APP0);
  const rest = kept.filter((segment) => segment.marker !== APP0);
  const exifSegment = exif ? [{ marker: APP1, data: exif }] : [];
  return serialiseJpeg({ segments: [...jfif, ...exifSegment, ...rest], scan: parsed.scan });
}

/** Byte-wise equality of two arrays. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
