/**
 * The few EXIF tags a web-ready master keeps, read from and written to a TIFF block (the
 * body of a JPEG's EXIF APP1 segment). PURE: bytes in, bytes out.
 *
 * photos:prep keeps only what the site uses or may use later, and drops everything else
 * (GPS position, camera serial numbers, maker notes, thumbnails, …):
 *
 * | Tag                  | Why it is kept                                               |
 * |----------------------|--------------------------------------------------------------|
 * | DateTimeOriginal     | the photo's date (TRD §4.6)                                  |
 * | OffsetTimeOriginal   | makes that date exact when the camera recorded its time zone |
 * | Orientation          | only while the pixels are still stored sideways              |
 * | Artist               | photographer fallback (TRD §4.6, P1)                         |
 * | ImageDescription     | caption fallback (TRD §4.6, P1)                              |
 * | Software             | only the photos:prep marker, so a prepared file is never     |
 * |                      | re-encoded again                                             |
 *
 * Text values are copied as raw bytes, never decoded and re-encoded, so a name with
 * accents survives any number of runs unchanged.
 */

/** Written into Software when photos:prep writes a file. */
export const PREP_MARKER = 'pinus-album photos:prep';

/** The kept tags. Text values are raw bytes without the terminating NUL. */
export interface KeptTags {
  dateTimeOriginal?: Uint8Array;
  offsetTimeOriginal?: Uint8Array;
  /** 2–8 only: 1 (upright) is the default and is not stored. */
  orientation?: number;
  artist?: Uint8Array;
  imageDescription?: Uint8Array;
  /** True when the Software tag is the photos:prep marker. */
  prepared?: boolean;
}

export interface TiffFacts {
  tags: KeptTags;
  /** The block has a GPS position (latitude or longitude), the same test as photos:check. */
  hasGps: boolean;
  /** Tags other than the kept ones were present (camera model, settings, maker notes, …). */
  hasOtherTags: boolean;
}

const TAG = {
  imageDescription: 0x010e,
  orientation: 0x0112,
  software: 0x0131,
  artist: 0x013b,
  exifIfd: 0x8769,
  gpsIfd: 0x8825,
  dateTimeOriginal: 0x9003,
  offsetTimeOriginal: 0x9011,
} as const;

/** Tags inside the GPS IFD. */
const GPS_LATITUDE = 0x0002;
const GPS_LONGITUDE = 0x0004;

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const ASCII = 2;
const SHORT = 3;
const LONG = 4;

/** Longest text value kept (bytes). Keeps the EXIF segment far below the 64 KB JPEG limit. */
export const MAX_TEXT_BYTES = 4000;

/** Text bytes with NULs, surrounding whitespace and an over-long tail removed; undefined when empty. */
export function cleanText(bytes: Uint8Array): Uint8Array | undefined {
  const nul = bytes.indexOf(0);
  let end = nul === -1 ? bytes.length : nul;
  let start = 0;
  const isSpace = (byte: number | undefined) => byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
  while (start < end && isSpace(bytes[start])) start++;
  while (end > start && isSpace(bytes[end - 1])) end--;
  if (end - start > MAX_TEXT_BYTES) {
    end = start + MAX_TEXT_BYTES;
    // Do not cut a UTF-8 character in half.
    while (end > start && ((bytes[end] ?? 0) & 0xc0) === 0x80) end--;
  }
  return end > start ? bytes.slice(start, end) : undefined;
}

const encoder = new TextEncoder();

/** UTF-8 text → cleaned bytes (for values carried over from XMP/IPTC). */
export const textBytes = (text: string): Uint8Array | undefined => cleanText(encoder.encode(text));

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** The value bytes (inline or at the offset). */
  value: Uint8Array;
}

class TiffReader {
  readonly #bytes: Uint8Array;
  readonly #view: DataView;
  readonly #little: boolean;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const order = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0);
    if (order !== 'II' && order !== 'MM') throw new Error('not a TIFF block');
    this.#little = order === 'II';
    if (this.u16(2) !== 42) throw new Error('not a TIFF block');
  }

  u16(offset: number): number {
    return this.#view.getUint16(offset, this.#little);
  }

  u32(offset: number): number {
    return this.#view.getUint32(offset, this.#little);
  }

  get firstIfd(): number {
    return this.u32(4);
  }

  /** Entries of the IFD at `offset`; entries whose value lies outside the block are skipped. */
  ifd(offset: number): Entry[] {
    if (offset < 8 || offset + 2 > this.#bytes.length) return [];
    const count = this.u16(offset);
    const entries: Entry[] = [];
    for (let i = 0; i < count; i++) {
      const at = offset + 2 + i * 12;
      if (at + 12 > this.#bytes.length) break;
      const tag = this.u16(at);
      const type = this.u16(at + 2);
      const valueCount = this.u32(at + 4);
      const size = (TYPE_SIZE[type] ?? 1) * valueCount;
      const start = size <= 4 ? at + 8 : this.u32(at + 8);
      if (start + size > this.#bytes.length) continue;
      entries.push({ tag, type, count: valueCount, value: this.#bytes.subarray(start, start + size) });
    }
    return entries;
  }

  number(entry: Entry): number | undefined {
    const view = new DataView(entry.value.buffer, entry.value.byteOffset, entry.value.byteLength);
    if (entry.type === SHORT && entry.value.length >= 2) return view.getUint16(0, this.#little);
    if (entry.type === LONG && entry.value.length >= 4) return view.getUint32(0, this.#little);
    return undefined;
  }
}

const sameText = (bytes: Uint8Array | undefined, text: string) =>
  bytes !== undefined && bytes.length === text.length && [...bytes].every((byte, i) => byte === text.charCodeAt(i));

/** Read the kept tags (and whether anything else was there) from a TIFF block. Never throws. */
export function readTiff(tiff: Uint8Array): TiffFacts {
  const facts: TiffFacts = { tags: {}, hasGps: false, hasOtherTags: false };
  let reader: TiffReader;
  try {
    reader = new TiffReader(tiff);
  } catch {
    facts.hasOtherTags = tiff.length > 0;
    return facts;
  }
  const { tags } = facts;
  const text = (entry: Entry) => (entry.type === ASCII || entry.type === 7 ? cleanText(entry.value) : undefined);
  const ifd0Offset = reader.firstIfd;

  for (const entry of reader.ifd(ifd0Offset)) {
    switch (entry.tag) {
      case TAG.imageDescription: {
        const value = text(entry);
        if (value) tags.imageDescription = value;
        break;
      }
      case TAG.artist: {
        const value = text(entry);
        if (value) tags.artist = value;
        break;
      }
      case TAG.orientation: {
        const value = reader.number(entry);
        if (value !== undefined && value >= 2 && value <= 8) tags.orientation = value;
        break;
      }
      case TAG.software:
        if (sameText(text(entry), PREP_MARKER)) tags.prepared = true;
        else facts.hasOtherTags = true;
        break;
      case TAG.gpsIfd: {
        // A position means latitude or longitude, as in content/exif.ts (photos:check). Many
        // phones write a GPS section with only a version or time while location is off.
        const offset = reader.number(entry);
        const gpsTags = offset === undefined ? [] : reader.ifd(offset).map((gpsEntry) => gpsEntry.tag);
        if (gpsTags.includes(GPS_LATITUDE) || gpsTags.includes(GPS_LONGITUDE)) facts.hasGps = true;
        else facts.hasOtherTags = true;
        break;
      }
      case TAG.exifIfd: {
        const offset = reader.number(entry);
        for (const exifEntry of offset === undefined ? [] : reader.ifd(offset)) {
          if (exifEntry.tag === TAG.dateTimeOriginal) {
            const value = text(exifEntry);
            if (value) tags.dateTimeOriginal = value;
          } else if (exifEntry.tag === TAG.offsetTimeOriginal) {
            const value = text(exifEntry);
            if (value) tags.offsetTimeOriginal = value;
          } else {
            facts.hasOtherTags = true;
          }
        }
        break;
      }
      default:
        facts.hasOtherTags = true;
    }
  }
  // IFD1 holds an embedded thumbnail: a second, unstripped copy of the photo.
  try {
    const ifd0Count = reader.u16(ifd0Offset);
    if (reader.u32(ifd0Offset + 2 + ifd0Count * 12) !== 0) facts.hasOtherTags = true;
  } catch {
    facts.hasOtherTags = true;
  }
  return facts;
}

// ---------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------

interface OutEntry {
  tag: number;
  type: number;
  count: number;
  /** Value bytes, or a LONG offset filled in later (`pointer`). */
  bytes: Uint8Array;
  pointer?: 'exif';
}

const asciiEntry = (tag: number, value: Uint8Array): OutEntry => {
  const bytes = new Uint8Array(value.length + 1);
  bytes.set(value);
  return { tag, type: ASCII, count: bytes.length, bytes };
};

/**
 * The complete APP1 payload (`Exif\0\0` + little-endian TIFF) holding exactly `tags`, or
 * undefined when there is nothing to store. Deterministic: the same tags always give the
 * same bytes, which is what makes photos:prep idempotent.
 */
export function buildExifApp1(tags: KeptTags): Uint8Array | undefined {
  const ifd0: OutEntry[] = [];
  const exif: OutEntry[] = [];
  if (tags.imageDescription) ifd0.push(asciiEntry(TAG.imageDescription, tags.imageDescription));
  if (tags.orientation !== undefined && tags.orientation >= 2 && tags.orientation <= 8) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, tags.orientation, true);
    ifd0.push({ tag: TAG.orientation, type: SHORT, count: 1, bytes });
  }
  if (tags.prepared) ifd0.push(asciiEntry(TAG.software, encoder.encode(PREP_MARKER)));
  if (tags.artist) ifd0.push(asciiEntry(TAG.artist, tags.artist));
  if (tags.dateTimeOriginal) exif.push(asciiEntry(TAG.dateTimeOriginal, tags.dateTimeOriginal));
  if (tags.offsetTimeOriginal) exif.push(asciiEntry(TAG.offsetTimeOriginal, tags.offsetTimeOriginal));
  if (exif.length > 0) ifd0.push({ tag: TAG.exifIfd, type: LONG, count: 1, bytes: new Uint8Array(4), pointer: 'exif' });
  if (ifd0.length === 0) return undefined;

  const ifdSize = (entries: readonly OutEntry[]) => 2 + entries.length * 12 + 4;
  const ifd0Offset = 8;
  const exifOffset = ifd0Offset + ifdSize(ifd0);
  let dataOffset = exifOffset + (exif.length > 0 ? ifdSize(exif) : 0);
  const external = [...ifd0, ...exif].filter((entry) => entry.bytes.length > 4);
  const dataSize = external.reduce((sum, entry) => sum + entry.bytes.length + (entry.bytes.length % 2), 0);

  const tiff = new Uint8Array(dataOffset + dataSize);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49]); // "II": little-endian
  view.setUint16(2, 42, true);
  view.setUint32(4, ifd0Offset, true);

  const writeIfd = (offset: number, entries: readonly OutEntry[]) => {
    view.setUint16(offset, entries.length, true);
    entries.forEach((entry, i) => {
      const at = offset + 2 + i * 12;
      view.setUint16(at, entry.tag, true);
      view.setUint16(at + 2, entry.type, true);
      view.setUint32(at + 4, entry.count, true);
      if (entry.pointer === 'exif') {
        view.setUint32(at + 8, exifOffset, true);
      } else if (entry.bytes.length <= 4) {
        tiff.set(entry.bytes, at + 8);
      } else {
        view.setUint32(at + 8, dataOffset, true);
        tiff.set(entry.bytes, dataOffset);
        dataOffset += entry.bytes.length + (entry.bytes.length % 2); // values start on even offsets
      }
    });
    view.setUint32(offset + 2 + entries.length * 12, 0, true); // no next IFD (no thumbnail)
  };
  // TIFF wants entries in ascending tag order; the pushes above already are.
  writeIfd(ifd0Offset, ifd0);
  if (exif.length > 0) writeIfd(exifOffset, exif);

  const app1 = new Uint8Array(6 + tiff.length);
  app1.set([0x45, 0x78, 0x69, 0x66, 0, 0]); // "Exif\0\0"
  app1.set(tiff, 6);
  return app1;
}
