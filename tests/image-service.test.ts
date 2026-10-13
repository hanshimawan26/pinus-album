/**
 * The site's image service: Astro's sharp service, plus the photographer credit on images
 * that ask for one (viewer images, see images.ts).
 */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { readCredit } from '../src/lib/authoring/exif-block.ts';
import { scanImageMetadata } from '../src/lib/build-checks/image-metadata.ts';
import { webpExif } from '../src/lib/credit/webp-exif.ts';
import service from '../src/lib/image-service.ts';

const imageConfig = { service: { entrypoint: './src/lib/image-service.ts', config: {} }, endpoint: { route: '/_image' } } as never;
const logger = { warn: () => {}, info: () => {}, error: () => {} } as never;

const source = () =>
  sharp({ create: { width: 1200, height: 900, channels: 3, background: '#808080' } })
    .jpeg()
    .withExif({ IFD0: { Artist: 'Camera Owner' } })
    .toBuffer();

const viewerTransform = { src: 'photo.jpg', width: 800, height: 600, fit: 'cover', format: 'webp' };

describe('image service', () => {
  it('credits an image that asks for it, at the requested size', async () => {
    const { data, format } = await service.transform(await source(), { ...viewerTransform, credit: 'Andi Pratama' }, imageConfig, logger);
    expect(format).toBe('webp');
    expect(await sharp(data).metadata()).toMatchObject({ width: 800, height: 600 });
    expect(readCredit(webpExif(data)!)).toEqual({ artist: 'Andi Pratama', copyright: '© Andi Pratama', hasOtherTags: false });
  });

  it('leaves every other image to Astro’s sharp service: no credit, no metadata', async () => {
    const { data } = await service.transform(await source(), { ...viewerTransform, width: 480, height: 480 }, imageConfig, logger);
    expect(await sharp(data).metadata()).toMatchObject({ width: 480, height: 480 });
    expect(scanImageMetadata(data).blocks).toEqual([]);
  });

  it('hashes the credit, so a new name gives new files', () => {
    expect(service.propertiesToHash).toContain('credit');
  });

  // getURL needs Astro's import.meta.env, which only exists inside Astro (`npm run dev`).
  it('reads the credit back from the dev server’s image URL', async () => {
    const url = new URL('http://localhost/_image?href=%2Fphoto.jpg&w=800&h=600&f=webp&fit=cover&credit=Tom+%26+Jerry');
    expect(await service.parseURL(url, imageConfig, logger)).toMatchObject({ width: 800, height: 600, credit: 'Tom & Jerry' });
    url.searchParams.delete('credit');
    expect(await service.parseURL(url, imageConfig, logger)).not.toHaveProperty('credit');
  });
});
