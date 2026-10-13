/**
 * Adding the credit's EXIF chunk to the WebP files sharp writes: plain lossy (`VP8 `),
 * plain lossless (`VP8L`) and extended (`VP8X`, as sharp writes for images with alpha).
 */
import exifr from 'exifr';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildCreditTiff, readCredit } from '../../src/lib/authoring/exif-block.ts';
import { scanImageMetadata } from '../../src/lib/build-checks/image-metadata.ts';
import { webpExif, withWebpExif } from '../../src/lib/credit/webp-exif.ts';

const tiff = buildCreditTiff({ artist: 'Sari Wíjaya', copyright: '© Sari Wíjaya' });

const opaque = () => sharp({ create: { width: 33, height: 21, channels: 3, background: '#334e97' } });
const transparent = () => sharp({ create: { width: 33, height: 21, channels: 4, background: { r: 51, g: 78, b: 151, alpha: 0.5 } } });

const cases = {
  'lossy (VP8)': () => opaque().webp().toBuffer(),
  'lossless (VP8L)': () => opaque().webp({ lossless: true }).toBuffer(),
  'lossless with alpha (VP8L)': () => transparent().webp({ lossless: true }).toBuffer(),
  'lossy with alpha (VP8X)': () => transparent().webp().toBuffer(),
};

describe('withWebpExif', () => {
  for (const [name, make] of Object.entries(cases)) {
    it(`adds the credit to a ${name} file that still decodes at the same size`, async () => {
      const original = await make();
      const before = await sharp(original).metadata();
      const credited = withWebpExif(original, tiff);
      const after = await sharp(credited).metadata();
      expect(after).toMatchObject({ format: 'webp', width: 33, height: 21, hasAlpha: before.hasAlpha });
      expect(scanImageMetadata(credited).blocks).toEqual(['EXIF']);
      expect(readCredit(webpExif(credited)!)).toEqual({ artist: 'Sari Wíjaya', copyright: '© Sari Wíjaya', hasOtherTags: false });
      expect(await sharp(credited).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
      // Other readers find it too (sharp hands the EXIF chunk over as `Exif\0\0` + TIFF).
      expect(await exifr.parse(after.exif!, { reviveValues: false })).toMatchObject({ Artist: 'Sari Wíjaya' });
    });
  }

  it('replaces an EXIF chunk the file already has', async () => {
    const withCameraExif = await opaque().webp().withExif({ IFD0: { Make: 'Camera' } }).toBuffer();
    const credited = withWebpExif(withCameraExif, tiff);
    expect(readCredit(webpExif(credited)!)).toMatchObject({ artist: 'Sari Wíjaya', hasOtherTags: false });
    expect(scanImageMetadata(credited).blocks).toEqual(['EXIF']);
  });

  it('refuses a file that is not WebP', async () => {
    const png = await opaque().png().toBuffer();
    expect(() => withWebpExif(png, tiff)).toThrow(/not a WebP/);
  });
});

describe('webpExif', () => {
  it('is undefined without an EXIF chunk or for another format', async () => {
    expect(webpExif(await opaque().webp().toBuffer())).toBeUndefined();
    expect(webpExif(await opaque().jpeg().toBuffer())).toBeUndefined();
  });
});
