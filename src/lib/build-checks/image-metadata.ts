/**
 * Finds embedded metadata blocks (EXIF, XMP, IPTC) in JPEG, PNG and WebP files by walking
 * their container structure. PURE: bytes in, findings out.
 *
 * Used by `npm run verify:dist` next to exifr, because exifr cannot read WebP, which is the
 * format of every published derivative. A structural check also catches a metadata block
 * that exifr would parse as empty (for example GPS tags in an otherwise bare EXIF block).
 */

export type ImageContainer = 'jpeg' | 'png' | 'webp' | 'gif' | 'unknown';
export type MetadataKind = 'EXIF' | 'XMP' | 'IPTC';

export interface MetadataScan {
  container: ImageContainer;
  /** Metadata blocks found, in file order, without duplicates. */
  blocks: MetadataKind[];
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, Math.min(bytes.length, start + length)));

const startsWith = (bytes: Uint8Array, offset: number, text: string): boolean => ascii(bytes, offset, text.length) === text;

export function detectContainer(bytes: Uint8Array): ImageContainer {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (startsWith(bytes, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) return 'webp';
  if (startsWith(bytes, 0, 'GIF8')) return 'gif';
  return 'unknown';
}

export function scanImageMetadata(bytes: Uint8Array): MetadataScan {
  const container = detectContainer(bytes);
  const found =
    container === 'jpeg' ? scanJpeg(bytes) : container === 'png' ? scanPng(bytes) : container === 'webp' ? scanWebp(bytes) : [];
  return { container, blocks: [...new Set(found)] };
}

/** JPEG: APP1 "Exif" / XMP and APP13 "Photoshop 3.0" (IPTC) segments before the image data. */
function scanJpeg(bytes: Uint8Array): MetadataKind[] {
  const found: MetadataKind[] = [];
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) break;
    const marker = bytes[pos + 1] ?? 0;
    if (marker === 0xff) {
      pos += 1; // fill byte
      continue;
    }
    // Start of scan or end of image: no more metadata segments follow.
    if (marker === 0xda || marker === 0xd9) break;
    // Markers without a length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    const length = ((bytes[pos + 2] ?? 0) << 8) | (bytes[pos + 3] ?? 0);
    const data = pos + 4;
    if (marker === 0xe1) {
      if (startsWith(bytes, data, 'Exif\0')) found.push('EXIF');
      else if (startsWith(bytes, data, 'http://ns.adobe.com/')) found.push('XMP');
    } else if (marker === 0xed && startsWith(bytes, data, 'Photoshop 3.0')) {
      found.push('IPTC');
    }
    if (length < 2) break;
    pos += 2 + length;
  }
  return found;
}

const readUint32BE = (bytes: Uint8Array, pos: number): number =>
  (((bytes[pos] ?? 0) << 24) >>> 0) + ((bytes[pos + 1] ?? 0) << 16) + ((bytes[pos + 2] ?? 0) << 8) + (bytes[pos + 3] ?? 0);

const readUint32LE = (bytes: Uint8Array, pos: number): number =>
  (bytes[pos] ?? 0) + ((bytes[pos + 1] ?? 0) << 8) + ((bytes[pos + 2] ?? 0) << 16) + (((bytes[pos + 3] ?? 0) << 24) >>> 0);

/** PNG: `eXIf` chunks, and text chunks holding XMP or ImageMagick-style raw EXIF/IPTC profiles. */
function scanPng(bytes: Uint8Array): MetadataKind[] {
  const found: MetadataKind[] = [];
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const length = readUint32BE(bytes, pos);
    const type = ascii(bytes, pos + 4, 4);
    const data = pos + 8;
    if (type === 'eXIf') found.push('EXIF');
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const keyword = ascii(bytes, data, Math.min(length, 80)).split('\0')[0] ?? '';
      if (keyword === 'XML:com.adobe.xmp') found.push('XMP');
      else if (/^Raw profile type (exif|APP1)$/i.test(keyword)) found.push('EXIF');
      else if (/^Raw profile type (iptc|8bim)$/i.test(keyword)) found.push('IPTC');
    }
    if (type === 'IEND') break;
    pos = data + length + 4; // data + CRC
  }
  return found;
}

/** WebP (RIFF): `EXIF` and `XMP ` chunks. */
function scanWebp(bytes: Uint8Array): MetadataKind[] {
  const found: MetadataKind[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const type = ascii(bytes, pos, 4);
    const length = readUint32LE(bytes, pos + 4);
    if (type === 'EXIF') found.push('EXIF');
    if (type === 'XMP ') found.push('XMP');
    pos += 8 + length + (length % 2); // chunks are padded to an even size
  }
  return found;
}
