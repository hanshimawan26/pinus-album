/**
 * Adds an EXIF chunk to a WebP file. PURE: bytes in, bytes out.
 *
 * sharp can write EXIF itself, but libvips turns non-ASCII text into ASCII (`©` → `(C)`,
 * `à` → `a`) and adds tags of its own (resolution, colour space, pixel size). Writing the
 * chunk here keeps a photographer's name exact and the block limited to the credit.
 *
 * WebP is a RIFF container. A plain file holds one image chunk (`VP8 ` lossy, `VP8L`
 * lossless); metadata needs the extended layout, which starts with a `VP8X` chunk whose
 * flags announce the extras and which records the canvas size. The EXIF chunk goes after
 * the image data and holds a bare TIFF block (no `Exif\0\0` prefix).
 */

const EXIF_FLAG = 0x08;
const ALPHA_FLAG = 0x10;

interface Chunk {
  type: string;
  data: Uint8Array;
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, Math.min(bytes.length, start + length)));

function readChunks(webp: Uint8Array): Chunk[] {
  if (ascii(webp, 0, 4) !== 'RIFF' || ascii(webp, 8, 4) !== 'WEBP') throw new Error('not a WebP file');
  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  const chunks: Chunk[] = [];
  let pos = 12;
  while (pos + 8 <= webp.length) {
    const type = ascii(webp, pos, 4);
    const length = view.getUint32(pos + 4, true);
    if (pos + 8 + length > webp.length) throw new Error('truncated WebP chunk');
    chunks.push({ type, data: webp.subarray(pos + 8, pos + 8 + length) });
    pos += 8 + length + (length % 2); // chunks are padded to an even size
  }
  return chunks;
}

/** Canvas size and alpha of a plain WebP's image chunk. */
function imageFacts(chunk: Chunk): { width: number; height: number; alpha: boolean } {
  const { data } = chunk;
  if (chunk.type === 'VP8 ' && data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) {
    // Key frame header: 3-byte frame tag, start code, then 14-bit width and height.
    return { width: ((data[6] ?? 0) | ((data[7] ?? 0) << 8)) & 0x3fff, height: ((data[8] ?? 0) | ((data[9] ?? 0) << 8)) & 0x3fff, alpha: false };
  }
  if (chunk.type === 'VP8L' && data[0] === 0x2f) {
    // Signature, then 14 bits width − 1, 14 bits height − 1, 1 bit alpha_is_used.
    const bits = new DataView(data.buffer, data.byteOffset + 1, 4).getUint32(0, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, alpha: ((bits >>> 28) & 1) === 1 };
  }
  throw new Error(`unsupported WebP image chunk "${chunk.type}"`);
}

function vp8x(flags: number, width: number, height: number): Chunk {
  const data = new Uint8Array(10);
  data[0] = flags;
  const w = width - 1;
  const h = height - 1;
  data.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 4);
  return { type: 'VP8X', data };
}

function writeChunks(chunks: readonly Chunk[]): Uint8Array {
  const size = 4 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length + (chunk.data.length % 2), 0);
  const out = new Uint8Array(8 + size);
  const view = new DataView(out.buffer);
  out.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
  view.setUint32(4, size, true);
  out.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  let pos = 12;
  for (const chunk of chunks) {
    for (let i = 0; i < 4; i++) out[pos + i] = chunk.type.charCodeAt(i);
    view.setUint32(pos + 4, chunk.data.length, true);
    out.set(chunk.data, pos + 8);
    pos += 8 + chunk.data.length + (chunk.data.length % 2);
  }
  return out;
}

/** `webp` with its EXIF replaced by `tiff` (a TIFF block). Throws on a file that is not WebP. */
export function withWebpExif(webp: Uint8Array, tiff: Uint8Array): Uint8Array {
  const chunks = readChunks(webp).filter((chunk) => chunk.type !== 'EXIF');
  const header = chunks[0];
  if (!header) throw new Error('empty WebP file');
  let result: Chunk[];
  if (header.type === 'VP8X') {
    const data = header.data.slice();
    data[0] = (data[0] ?? 0) | EXIF_FLAG;
    result = [{ type: 'VP8X', data }, ...chunks.slice(1)];
  } else {
    const facts = imageFacts(header);
    result = [vp8x(EXIF_FLAG | (facts.alpha ? ALPHA_FLAG : 0), facts.width, facts.height), ...chunks];
  }
  // EXIF follows the image data and comes before XMP.
  const xmp = result.findIndex((chunk) => chunk.type === 'XMP ');
  const exif = { type: 'EXIF', data: tiff };
  if (xmp === -1) result.push(exif);
  else result.splice(xmp, 0, exif);
  return writeChunks(result);
}

/** The TIFF block of a WebP's EXIF chunk (an `Exif\0\0` prefix removed), or undefined. */
export function webpExif(webp: Uint8Array): Uint8Array | undefined {
  let chunks: Chunk[];
  try {
    chunks = readChunks(webp);
  } catch {
    return undefined;
  }
  const data = chunks.find((chunk) => chunk.type === 'EXIF')?.data;
  if (!data) return undefined;
  return ascii(data, 0, 6) === 'Exif\0\0' ? data.subarray(6) : data;
}

