/**
 * photos:prep on one image (in memory), and the pure rules behind it (TRD §7, §9).
 * Fixtures are generated with sharp at test time.
 */
import exifr from 'exifr';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PREP_MARKER } from '../../src/lib/authoring/exif-block.ts';
import { parseJpeg, sameBytes } from '../../src/lib/authoring/jpeg.ts';
import { embeddedText, prepareJpeg } from '../../src/lib/authoring/prep.ts';
import { isOversize, planJpeg, PREP_LIMITS, recompressionPays } from '../../src/lib/authoring/prep-rules.ts';
import { bandColour, makeJpeg } from '../helpers/images.ts';

const allTags = (bytes: Uint8Array) =>
  exifr.parse(Buffer.from(bytes), { tiff: true, exif: true, gps: true, xmp: true, iptc: true, reviveValues: false, translateValues: false });

/** Run prep until it reports no change; return every result. */
async function prepRepeatedly(input: Uint8Array) {
  const first = await prepareJpeg(input);
  const second = await prepareJpeg(first.output ?? input);
  return { first, second, output: first.output ?? input };
}

describe('planJpeg (the rules)', () => {
  const facts = { width: 2400, height: 1600, bytes: 500_000, prepared: false, metadataClean: true };

  it('resizes anything over 2400 px on the long side, portrait or landscape', () => {
    expect(planJpeg({ ...facts, width: 2401 })).toBe('resize');
    expect(planJpeg({ ...facts, width: 3024, height: 4032, prepared: true })).toBe('resize');
  });

  it('re-encodes a heavy file once, never a file photos:prep already wrote', () => {
    expect(planJpeg({ ...facts, bytes: PREP_LIMITS.recompressAboveBytes + 1 })).toBe('recompress');
    expect(planJpeg({ ...facts, bytes: PREP_LIMITS.recompressAboveBytes + 1, prepared: true })).toBe('none');
    expect(planJpeg({ ...facts, bytes: PREP_LIMITS.recompressAboveBytes })).toBe('none');
  });

  it('only strips metadata (no re-encode) when that is all there is to do', () => {
    expect(planJpeg({ ...facts, metadataClean: false })).toBe('strip');
    expect(planJpeg(facts)).toBe('none');
  });

  it('keeps a re-encode only when it saves at least 10%', () => {
    expect(recompressionPays(1000, 900)).toBe(true);
    expect(recompressionPays(1000, 901)).toBe(false);
  });

  it('flags PNG/WebP files over the size or pixel limit', () => {
    expect(isOversize(2401, 10, 1, 2)).toBe(true);
    expect(isOversize(100, 10, 3, 2)).toBe(true);
    expect(isOversize(2400, 10, 2, 2)).toBe(false);
  });
});

describe('prepareJpeg', () => {
  it('scales a large photo down to 2400 px on the long side at quality 85', async () => {
    const input = await makeJpeg({ width: 4000, height: 3000, date: '2026:09:20 10:00:00', quality: 95 });
    const { first, second } = await prepRepeatedly(input);
    expect(first.action).toBe('resize');
    expect(first.before).toMatchObject({ width: 4000, height: 3000, bytes: input.length });
    expect(first.after).toMatchObject({ width: 2400, height: 1800, bytes: first.output!.length });
    const metadata = await sharp(first.output!).metadata();
    expect([metadata.width, metadata.height, metadata.format]).toEqual([2400, 1800, 'jpeg']);
    expect(second.action).toBe('none');
  });

  it('turns a sideways photo upright in its pixels and drops the Orientation tag', async () => {
    // Stored 3200×2400 with orientation 6: shown upright it is 2400×3200, red on top.
    const input = await makeJpeg({ width: 2400, height: 3200, orientation: 6, marked: true, date: '2026:09:20 10:00:00' });
    expect((await sharp(input).metadata()).orientation).toBe(6);
    const result = await prepareJpeg(input);
    expect(result).toMatchObject({ action: 'resize', rotated: true, before: { width: 2400, height: 3200 }, after: { width: 1800, height: 2400 } });
    const metadata = await sharp(result.output!).metadata();
    expect(metadata.orientation).toBeUndefined();
    expect([metadata.width, metadata.height]).toEqual([1800, 2400]);
    const top = await bandColour(result.output!, 0.05, 0.4);
    const bottom = await bandColour(result.output!, 0.6, 0.95);
    expect(top.r).toBeGreaterThan(200);
    expect(top.b).toBeLessThan(60);
    expect(bottom.b).toBeGreaterThan(200);
  });

  it('keeps the Orientation tag when only metadata is removed (pixels untouched)', async () => {
    // Upright 600×800 (red on top), stored turned with orientation 8.
    const input = await makeJpeg({ width: 600, height: 800, orientation: 8, gps: true, marked: true });
    const result = await prepareJpeg(input);
    expect(result).toMatchObject({ action: 'strip', rotated: false, before: { width: 600, height: 800 }, after: { width: 600, height: 800 } });
    expect((await sharp(result.output!).metadata()).orientation).toBe(8);
    expect((await bandColour(result.output!, 0.05, 0.4)).r).toBeGreaterThan(200);
  });

  it('keeps the camera date and time zone, and drops GPS and camera details', async () => {
    const input = await makeJpeg({ width: 3000, height: 2000, date: '2026:09:20 18:30:00', offset: '+08:00', gps: true, camera: true });
    const result = await prepareJpeg(input);
    expect(result.removed).toEqual(expect.arrayContaining(['GPS location', 'camera and software details']));
    expect(await allTags(result.output!)).toEqual({ Software: PREP_MARKER, DateTimeOriginal: '2026:09:20 18:30:00', OffsetTimeOriginal: '+08:00' });
    expect(await exifr.gps(Buffer.from(result.output!))).toBeUndefined();
  });

  it('keeps Artist and ImageDescription, and moves an XMP caption and creator into them', async () => {
    const exifOnly = await prepareJpeg(await makeJpeg({ width: 600, height: 400, artist: 'Andi Pratama', description: 'Opening dance', gps: true }));
    expect(await allTags(exifOnly.output!)).toMatchObject({ Artist: 'Andi Pratama', ImageDescription: 'Opening dance' });

    const xmp = await prepareJpeg(await makeJpeg({ width: 600, height: 400, xmp: { description: 'Group photo é', creator: 'Sari Wijaya' } }));
    expect(xmp.removed).toEqual(expect.arrayContaining(['XMP', 'GPS location']));
    expect(await allTags(xmp.output!)).toEqual({ ImageDescription: 'Group photo é', Software: PREP_MARKER, Artist: 'Sari Wijaya' });
  });

  it('removes metadata without re-encoding: the image data stays byte-identical', async () => {
    const input = await makeJpeg({ width: 1200, height: 800, date: '2026:09:20 10:00:00', gps: true, xmp: { description: 'x' } });
    const result = await prepareJpeg(input);
    expect(result.action).toBe('strip');
    expect(sameBytes(parseJpeg(result.output!).scan, parseJpeg(input).scan)).toBe(true);
    expect(result.output!.length).toBeLessThan(input.length);
  });

  it('removes data appended after the image (motion-photo videos and the like)', async () => {
    const image = await makeJpeg({ width: 400, height: 300 });
    const input = Buffer.concat([image, Buffer.alloc(5000, 'fake motion photo video')]);
    const result = await prepareJpeg(input);
    expect(result.action).toBe('strip');
    expect(result.removed).toContain('extra data after the image (for example a motion-photo video)');
    expect(result.output!.length).toBeLessThan(input.length);
  });

  it('re-encodes a heavy file within 2400 px once, and keeps it only when it is smaller', async () => {
    const heavy = await makeJpeg({ width: 2000, height: 1500, noise: true, quality: 100, gps: true });
    expect(heavy.length).toBeGreaterThan(PREP_LIMITS.recompressAboveBytes);
    const { first, second } = await prepRepeatedly(heavy);
    expect(first.action).toBe('recompress');
    expect(first.after.bytes).toBeLessThan(heavy.length * 0.9);
    expect(first.after).toMatchObject({ width: 2000, height: 1500 });
    expect(second.action).toBe('none');
    expect(first.removed).toContain('GPS location');
  });

  it('leaves a web-ready file alone: no new bytes, no rewrite', async () => {
    const input = await makeJpeg({ width: 1600, height: 1067 });
    const result = await prepareJpeg(input);
    expect(result).toMatchObject({ action: 'none', removed: [], before: { width: 1600, height: 1067 } });
    expect(result.output).toBeUndefined();
  });

  it('is idempotent: a second run changes nothing, whatever the first run did', async () => {
    const inputs = [
      await makeJpeg({ width: 4000, height: 3000, orientation: 6, date: '2026:09:20 10:00:00', gps: true, xmp: { description: 'x' } }),
      await makeJpeg({ width: 1000, height: 800, date: '2026:09:20 10:00:00', artist: '   ', camera: true }),
      await makeJpeg({ width: 2000, height: 1500, noise: true, quality: 100 }),
      await makeJpeg({ width: 500, height: 500 }),
    ];
    for (const input of inputs) {
      const { second } = await prepRepeatedly(input);
      expect(second.action).toBe('none');
      expect(second.output).toBeUndefined();
    }
  });

  it('rejects files that are not JPEGs', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer();
    await expect(prepareJpeg(png)).rejects.toThrow(/not a JPEG/);
  });
});

describe('embeddedText', () => {
  it('reads XMP and IPTC value shapes', () => {
    expect(embeddedText('  Dance ')).toBe('Dance');
    expect(embeddedText({ lang: 'x-default', value: 'Dance' })).toBe('Dance');
    expect(embeddedText(['Andi', 'Sari'])).toBe('Andi, Sari');
    expect(embeddedText('')).toBeUndefined();
    expect(embeddedText(undefined)).toBeUndefined();
  });
});
