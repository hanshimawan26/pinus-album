import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import exifr from 'exifr';
import { describe, expect, it } from 'vitest';
import { buildExifApp1, cleanText, MAX_TEXT_BYTES, PREP_MARKER, readTiff, textBytes } from '../../src/lib/authoring/exif-block.ts';
import { exifTiffOf, parseJpeg } from '../../src/lib/authoring/jpeg.ts';
import { readImageInfo } from '../../src/lib/content/exif.ts';
import { bytesText, makeJpeg } from '../helpers/images.ts';

const text = (value: string) => new TextEncoder().encode(value);
const tiffOf = async (options: Parameters<typeof makeJpeg>[0]) => exifTiffOf(parseJpeg(await makeJpeg(options)).segments)!;

describe('readTiff', () => {
  it('reads the kept tags and notices GPS and other tags', async () => {
    const facts = readTiff(
      await tiffOf({ width: 8, height: 8, date: '2026:09:20 10:00:00', offset: '+08:00', artist: 'Andi', description: 'Dance', gps: true, camera: true, orientation: 6 }),
    );
    expect(bytesText(facts.tags.dateTimeOriginal)).toBe('2026:09:20 10:00:00');
    expect(bytesText(facts.tags.offsetTimeOriginal)).toBe('+08:00');
    expect(bytesText(facts.tags.artist)).toBe('Andi');
    expect(bytesText(facts.tags.imageDescription)).toBe('Dance');
    expect(facts.tags.orientation).toBe(6);
    expect(facts.tags.prepared).toBeUndefined();
    expect(facts.hasGps).toBe(true);
    expect(facts.hasOtherTags).toBe(true);
  });

  it('counts a GPS section without a position (only a GPS date) as other data, not a location, like photos:check', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pinus-gps-'));
    try {
      for (const gps of [true, 'no-position', false] as const) {
        const jpeg = await makeJpeg({ width: 8, height: 8, gps });
        const file = join(dir, `${String(gps)}.jpg`);
        await writeFile(file, jpeg);
        const facts = readTiff(exifTiffOf(parseJpeg(jpeg).segments) ?? new Uint8Array());
        expect(facts.hasGps).toBe(gps === true);
        // photos:check (content/exif.ts) must give the same answer for the same file.
        expect((await readImageInfo(file)).hasGps ?? false).toBe(facts.hasGps);
        if (gps === 'no-position') expect(facts.hasOtherTags).toBe(true);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reads big-endian (Motorola) blocks, as many cameras write them', () => {
    // MM, IFD0 at 8 with one entry: Orientation (SHORT) = 3, then no next IFD.
    const tiff = new Uint8Array([0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 0]);
    expect(readTiff(tiff)).toEqual({ tags: { orientation: 3 }, hasGps: false, hasOtherTags: false });
  });

  it('never throws on damaged data', () => {
    expect(readTiff(text('garbage')).hasOtherTags).toBe(true);
    expect(readTiff(new Uint8Array([0x49, 0x49, 42, 0, 0xff, 0xff, 0, 0])).tags).toEqual({});
  });
});

describe('buildExifApp1', () => {
  it('writes only the given tags, readable by exifr and by readTiff', async () => {
    const app1 = buildExifApp1({
      dateTimeOriginal: text('2026:09:20 10:00:00'),
      offsetTimeOriginal: text('+08:00'),
      artist: text('Sari Wíjaya'),
      imageDescription: text('Group photo 🎉'),
      orientation: 6,
      prepared: true,
    })!;
    expect(new TextDecoder().decode(app1.subarray(0, 4))).toBe('Exif');
    const tiff = app1.subarray(6);
    const parsed = await exifr.parse(tiff, { reviveValues: false, translateValues: false });
    expect(parsed).toEqual({
      ImageDescription: 'Group photo 🎉',
      Orientation: 6,
      Software: PREP_MARKER,
      Artist: 'Sari Wíjaya',
      DateTimeOriginal: '2026:09:20 10:00:00',
      OffsetTimeOriginal: '+08:00',
    });
    const facts = readTiff(tiff);
    expect(facts).toMatchObject({ hasGps: false, hasOtherTags: false, tags: { orientation: 6, prepared: true } });
    expect(bytesText(facts.tags.artist)).toBe('Sari Wíjaya');
  });

  it('is deterministic, and reading then writing again gives the same bytes', () => {
    const tags = { dateTimeOriginal: text('2026:09:20 10:00:00'), artist: text('Andi'), prepared: true };
    const first = buildExifApp1(tags)!;
    const again = buildExifApp1(readTiff(first.subarray(6)).tags)!;
    expect(Buffer.from(again).equals(Buffer.from(first))).toBe(true);
  });

  it('writes nothing when there is nothing to keep, and never writes orientation 1', () => {
    expect(buildExifApp1({})).toBeUndefined();
    expect(buildExifApp1({ orientation: 1 })).toBeUndefined();
  });

  it('writes a date without an EXIF sub-IFD only when needed', async () => {
    const app1 = buildExifApp1({ prepared: true })!;
    expect(await exifr.parse(app1.subarray(6), { reviveValues: false })).toEqual({ Software: PREP_MARKER });
  });
});

describe('text values', () => {
  it('drops NULs, surrounding spaces and blank values (cameras pad Artist with spaces)', () => {
    expect(bytesText(cleanText(text('  Andi  \0\0')))).toBe('Andi');
    expect(cleanText(text('        '))).toBeUndefined();
    expect(textBytes('')).toBeUndefined();
  });

  it('limits very long values without cutting a character in half', () => {
    const long = textBytes('é'.repeat(MAX_TEXT_BYTES))!;
    expect(long.length).toBeLessThanOrEqual(MAX_TEXT_BYTES);
    expect(bytesText(long)).toBe('é'.repeat(long.length / 2));
  });
});
