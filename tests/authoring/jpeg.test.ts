import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  APP0,
  APP1,
  APP2,
  APP14,
  COM,
  exifTiffOf,
  isKeptSegment,
  parseJpeg,
  sameBytes,
  serialiseJpeg,
  withMetadataOnly,
} from '../../src/lib/authoring/jpeg.ts';
import { makeJpeg } from '../helpers/images.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

describe('parseJpeg / serialiseJpeg', () => {
  it('round-trips a baseline JPEG byte for byte', async () => {
    const input = await makeJpeg({ width: 64, height: 48, date: '2026:09:20 10:00:00', gps: true });
    const parsed = parseJpeg(input);
    expect(parsed.segments[0]?.marker).toBe(APP1);
    expect(parsed.trailing).toHaveLength(0);
    expect(sameBytes(serialiseJpeg(parsed), input)).toBe(true);
  });

  it('round-trips a progressive JPEG (several scans with tables between them)', async () => {
    const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 50 } } })
      .jpeg({ progressive: true, mozjpeg: true })
      .toBuffer();
    const parsed = parseJpeg(input);
    expect(sameBytes(serialiseJpeg(parsed), input)).toBe(true);
    expect(parsed.scan.at(-1)).toBe(0xd9);
  });

  it('separates data appended after the end of the image', async () => {
    const image = await makeJpeg({ width: 32, height: 32 });
    const parsed = parseJpeg(concat(image, bytes('MOTION-PHOTO-VIDEO')));
    expect(new TextDecoder().decode(parsed.trailing)).toBe('MOTION-PHOTO-VIDEO');
    expect(sameBytes(serialiseJpeg({ segments: parsed.segments, scan: parsed.scan }), image)).toBe(true);
  });

  it('rejects files that are not JPEGs, or are cut off', async () => {
    expect(() => parseJpeg(bytes('not a jpeg'))).toThrow(/not a JPEG/);
    const image = await makeJpeg({ width: 32, height: 32, date: '2026:09:20 10:00:00' });
    expect(() => parseJpeg(image.subarray(0, 10))).toThrow(/damaged JPEG/);
  });

  it('finds the EXIF TIFF block', async () => {
    const parsed = parseJpeg(await makeJpeg({ width: 32, height: 32, date: '2026:09:20 10:00:00' }));
    const tiff = exifTiffOf(parsed.segments);
    expect(String.fromCharCode(...(tiff ?? []).slice(0, 2))).toMatch(/II|MM/);
    expect(exifTiffOf(parseJpeg(await makeJpeg({ width: 32, height: 32 })).segments)).toBeUndefined();
  });
});

describe('isKeptSegment', () => {
  const segment = (marker: number, data: string) => ({ marker, data: bytes(data) });

  it('keeps image data and the segments needed to show the pixels correctly', () => {
    expect(isKeptSegment(segment(0xdb, 'quant'))).toBe(true);
    expect(isKeptSegment(segment(0xc0, 'frame'))).toBe(true);
    expect(isKeptSegment(segment(APP0, 'JFIF\0...'))).toBe(true);
    expect(isKeptSegment(segment(APP2, 'ICC_PROFILE\0...'))).toBe(true);
    expect(isKeptSegment(segment(APP14, 'Adobe...'))).toBe(true);
  });

  it('drops metadata: EXIF, XMP, IPTC, MPF, other APPn and comments', () => {
    expect(isKeptSegment(segment(APP1, 'Exif\0\0...'))).toBe(false);
    expect(isKeptSegment(segment(APP1, 'http://ns.adobe.com/xap/1.0/\0<x/>'))).toBe(false);
    expect(isKeptSegment(segment(0xed, 'Photoshop 3.0\0'))).toBe(false);
    expect(isKeptSegment(segment(APP2, 'MPF\0'))).toBe(false);
    expect(isKeptSegment(segment(APP0, 'JFXX\0thumbnail'))).toBe(false);
    expect(isKeptSegment(segment(0xe9, 'vendor'))).toBe(false);
    expect(isKeptSegment(segment(COM, 'a comment'))).toBe(false);
  });
});

describe('withMetadataOnly', () => {
  it('replaces all metadata with the given EXIF block, keeps the image data exactly', async () => {
    const input = await makeJpeg({ width: 48, height: 32, date: '2026:09:20 10:00:00', gps: true, xmp: { description: 'x' } });
    const parsed = parseJpeg(input);
    const exif = concat(bytes('Exif\0\0'), bytes('II*\0'), new Uint8Array([8, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const output = parseJpeg(withMetadataOnly(parsed, exif));
    expect(output.segments.filter((s) => s.marker === APP1)).toHaveLength(1);
    expect(sameBytes(exifTiffOf(output.segments)!, exif.subarray(6))).toBe(true);
    expect(sameBytes(output.scan, parsed.scan)).toBe(true);
    expect((await sharp(withMetadataOnly(parsed, exif)).metadata()).width).toBe(48);
  });

  it('puts the EXIF block after a JFIF header, and can drop EXIF entirely', async () => {
    const parsed = parseJpeg(await makeJpeg({ width: 32, height: 32 }));
    const jfif = { marker: APP0, data: bytes('JFIF\0\x01\x01\0\0\x01\0\x01\0\0') };
    const withJfif = { ...parsed, segments: [jfif, ...parsed.segments, { marker: COM, data: bytes('hello') }] };
    const exif = concat(bytes('Exif\0\0'), bytes('II*\0'), new Uint8Array([8, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const markers = parseJpeg(withMetadataOnly(withJfif, exif)).segments.map((s) => s.marker);
    expect(markers.slice(0, 2)).toEqual([APP0, APP1]);
    expect(markers).not.toContain(COM);
    expect(parseJpeg(withMetadataOnly(withJfif, undefined)).segments.map((s) => s.marker)).not.toContain(APP1);
  });
});
