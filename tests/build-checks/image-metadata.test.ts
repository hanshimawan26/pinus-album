/**
 * The metadata scanner behind `npm run verify:dist`, against images generated with sharp:
 * with metadata (as camera files have) and without (as Astro's derivatives must be).
 */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { detectContainer, scanImageMetadata } from '../../src/lib/build-checks/image-metadata.ts';

const XMP = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF></x:xmpmeta>';

const base = () => sharp({ create: { width: 32, height: 24, channels: 3, background: '#334e97' } });
const withExif = () =>
  base().withExif({ IFD0: { Software: 'test' }, IFD2: { DateTimeOriginal: '2026:09:20 10:00:00' }, IFD3: { GPSLatitudeRef: 'N' } });

describe('scanImageMetadata', () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    it(`finds EXIF in ${format}`, async () => {
      const bytes = await withExif().toFormat(format).toBuffer();
      expect(scanImageMetadata(bytes)).toEqual({ container: format, blocks: ['EXIF'] });
    });

    it(`finds XMP in ${format}`, async () => {
      const bytes = await base().withXmp(XMP).toFormat(format).toBuffer();
      expect(scanImageMetadata(bytes).blocks).toContain('XMP');
    });

    it(`finds nothing in a stripped ${format} (sharp's default, as used by Astro)`, async () => {
      const bytes = await sharp(await withExif().toFormat(format).toBuffer()).toFormat(format).toBuffer();
      expect(scanImageMetadata(bytes)).toEqual({ container: format, blocks: [] });
    });
  }

  it('finds an IPTC (Photoshop) segment in a JPEG', () => {
    const payload = Buffer.from('Photoshop 3.0\0', 'latin1');
    const segment = Buffer.concat([Buffer.from([0xff, 0xed, 0, payload.length + 2]), payload]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), segment, Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])]);
    expect(scanImageMetadata(jpeg).blocks).toEqual(['IPTC']);
  });

  it('does not loop on a truncated or malformed file', () => {
    expect(scanImageMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0]))).toEqual({ container: 'jpeg', blocks: [] });
    expect(scanImageMetadata(Buffer.from('RIFF\0\0\0\0WEBPEXIF', 'latin1'))).toEqual({ container: 'webp', blocks: [] });
  });
});

describe('detectContainer', () => {
  it('recognises formats from their signatures', () => {
    expect(detectContainer(Buffer.from('GIF89a', 'latin1'))).toBe('gif');
    expect(detectContainer(Buffer.from('<svg/>', 'latin1'))).toBe('unknown');
  });
});
