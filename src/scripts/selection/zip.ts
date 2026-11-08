/**
 * Writes a ZIP file of already-compressed photos (TRD §6.4.1). PURE: bytes in, bytes out.
 *
 * Entries are "stored", not deflated: JPEGs do not shrink, so compressing would only cost time
 * on a phone. That is what makes this small enough to need no library. The classic ZIP format
 * caps a file at 4 GB and 65,535 entries, far above what a site on GitHub Pages can hold.
 */

type Bytes = Uint8Array<ArrayBuffer>;

export interface ZipFile {
  /** ASCII or UTF-8; file names here are built from slugs. */
  name: string;
  bytes: Bytes;
}

/** One little-endian number of a ZIP record: its width in bytes, then its value. */
type Field = readonly [width: 2 | 4, value: number];

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
const VERSION = 20; // 2.0: the lowest version every unzip tool accepts for UTF-8 names
const FLAG_UTF8_NAME = 0x0800;
const METHOD_STORED = 0;

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    crc = CRC_TABLE[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP stores local time, to two seconds, as a pair of 16-bit numbers. */
function dosTimestamp(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Writes `fields`, then `name` right after them. */
function record(fields: readonly Field[], name?: Bytes): Bytes {
  const length = fields.reduce((sum, [width]) => sum + width, 0);
  const output = new Uint8Array(length + (name?.length ?? 0));
  const view = new DataView(output.buffer);
  let offset = 0;
  for (const [width, value] of fields) {
    if (width === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
    offset += width;
  }
  if (name) output.set(name, offset);
  return output;
}

/**
 * The parts of a ZIP holding `files`, in order, ready for `new Blob(parts)`. Returned as parts so
 * the photos are not copied into one more array, which matters with hundreds of them on a phone.
 * `modified` is the date the extracted files show.
 */
export function zipParts(files: readonly ZipFile[], modified: Date): Bytes[] {
  const stamp = dosTimestamp(modified);
  const encoder = new TextEncoder();
  const parts: Bytes[] = [];
  const central: Bytes[] = [];
  let offset = 0;

  for (const file of files) {
    const name = new Uint8Array(encoder.encode(file.name));
    const crc = crc32(file.bytes);
    const shared: Field[] = [
      [2, VERSION],
      [2, FLAG_UTF8_NAME],
      [2, METHOD_STORED],
      [2, stamp.time],
      [2, stamp.date],
      [4, crc],
      [4, file.bytes.length],
      [4, file.bytes.length],
      [2, name.length],
      [2, 0], // extra field length
    ];
    const local = record([[4, LOCAL_HEADER], ...shared], name);
    parts.push(local, file.bytes);
    central.push(
      record(
        [
          [4, CENTRAL_HEADER],
          [2, VERSION],
          ...shared,
          [2, 0], // comment length
          [2, 0], // disk number
          [2, 0], // internal attributes
          [4, 0], // external attributes
          [4, offset],
        ],
        name,
      ),
    );
    offset += local.length + file.bytes.length;
  }

  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = record([
    [4, END_OF_CENTRAL],
    [2, 0], // this disk
    [2, 0], // disk with the central directory
    [2, files.length],
    [2, files.length],
    [4, centralSize],
    [4, offset],
    [2, 0], // comment length
  ]);
  return [...parts, ...central, end];
}
