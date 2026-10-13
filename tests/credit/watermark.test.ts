/**
 * The watermark drawn with sharp: it lands in the bottom-right corner, leaves the rest of
 * the photo alone, and the output keeps its size and carries only the credit's EXIF.
 */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { readCredit } from '../../src/lib/authoring/exif-block.ts';
import { scanImageMetadata } from '../../src/lib/build-checks/image-metadata.ts';
import { creditFor } from '../../src/lib/credit/credit.ts';
import { encodeCredited, watermarkOverlays } from '../../src/lib/credit/watermark.ts';
import { webpExif } from '../../src/lib/credit/webp-exif.ts';

const GREY = { r: 128, g: 128, b: 128 };
const photo = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: GREY } }).png();

/** Mean absolute difference from plain grey inside a region of a decoded image. */
async function changeIn(image: Uint8Array, region: { left: number; top: number; width: number; height: number }): Promise<number> {
  const { data } = await sharp(image).extract(region).raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const value of data) sum += Math.abs(value - 128);
  return sum / data.length;
}

describe('encodeCredited', () => {
  it('draws the credit in the bottom-right corner only', async () => {
    const credited = await encodeCredited(sharp(await photo(800, 533).toBuffer()), creditFor('Andi Pratama')!, { quality: 90 });
    expect(await sharp(credited).metadata()).toMatchObject({ format: 'webp', width: 800, height: 533 });
    expect(await changeIn(credited, { left: 560, top: 493, width: 240, height: 40 })).toBeGreaterThan(5);
    expect(await changeIn(credited, { left: 0, top: 0, width: 400, height: 400 })).toBeLessThan(1);
  });

  it('carries only the EXIF credit (no other metadata)', async () => {
    const credited = await encodeCredited(sharp(await photo(400, 300).toBuffer()), creditFor('Sari Wíjaya')!);
    expect(scanImageMetadata(credited).blocks).toEqual(['EXIF']);
    expect(readCredit(webpExif(credited)!)).toEqual({ artist: 'Sari Wíjaya', copyright: '© Sari Wíjaya', hasOtherTags: false });
  });
});

describe('watermarkOverlays', () => {
  it('keeps a very long name inside a narrow image', async () => {
    const name = '© A Photographer With A Remarkably Long Name Indeed';
    const layers = await watermarkOverlays(300, 450, name);
    for (const layer of layers) {
      const { width = 0, height = 0 } = await sharp(layer.input as Buffer).metadata();
      expect(layer.left!).toBeGreaterThanOrEqual(0);
      expect(layer.left! + width).toBeLessThanOrEqual(300);
      expect(layer.top! + height).toBeLessThanOrEqual(450);
    }
    // sharp itself refuses overlays larger than the image.
    await expect(photo(300, 450).composite(layers).toBuffer()).resolves.toBeDefined();
  });
});
