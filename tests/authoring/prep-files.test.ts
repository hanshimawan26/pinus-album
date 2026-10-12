/**
 * photos:prep on a folder: a fixture tree generated with sharp in a temp folder, processed in
 * place, then read back by the content engine.
 */
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listPrepCandidates, prepFile, type PrepOutcome } from '../../src/lib/authoring/prep-files.ts';
import { describeOutcome, formatBytes, needsAttention, summarise, summaryLines } from '../../src/lib/authoring/prep-report.ts';
import { readImageInfo } from '../../src/lib/content/exif.ts';
import { loadAlbums } from '../../src/lib/content/index.ts';
import { makeJpeg } from '../helpers/images.ts';

let tmp: string;
let albums: string;
let event: string;

async function put(path: string, content: string | Buffer) {
  const target = join(event, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, content);
  return target;
}

const prepAll = async (options: { dryRun?: boolean } = {}) => {
  const outcomes: PrepOutcome[] = [];
  for (const file of await listPrepCandidates(event)) outcomes.push(await prepFile(file, options));
  return outcomes;
};

const byName = (outcomes: readonly PrepOutcome[], name: string) => outcomes.find((outcome) => outcome.absPath.endsWith(name));

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'pinus-album-prep-'));
  albums = join(tmp, 'albums');
  event = join(albums, 'event');
  await put('index.md', '---\ntitle: "Event"\ndate: 2026-09-20\n---\n');
  await put('@andi/phone.jpg', await makeJpeg({ width: 4032, height: 3024, orientation: 6, date: '2026:09:20 18:30:00', offset: '+08:00', gps: true, camera: true }));
  await put('@andi/whatsapp.jpg', await makeJpeg({ width: 1600, height: 1200 }));
  await put('@sari/edited.jpg', await makeJpeg({ width: 1200, height: 800, date: '2026:09:20 11:00:00', gps: true, xmp: { creator: 'Sari' } }));
  await put('day-2/IMG_9.JPG', await makeJpeg({ width: 3000, height: 2000, date: '2026:09:21 09:00:00' }));
  await put('poster.png', await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#ff0000' } }).png().toBuffer());
  await put('small.webp', await sharp({ create: { width: 300, height: 200, channels: 3, background: '#00ff00' } }).webp().toBuffer());
  await put('IMG_1234.HEIC', 'fake heic');
  await put('renamed.jpg', await sharp({ create: { width: 64, height: 64, channels: 3, background: '#123456' } }).heif({ compression: 'av1' }).toBuffer());
  await put('broken.jpg', 'not an image at all');
  await put('anim.gif', 'fake gif');
  await put('notes.txt', 'not an image');
  await put('.hidden/skip.jpg', await makeJpeg({ width: 3000, height: 3000 }));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('listPrepCandidates', () => {
  it('finds images recursively, sorted, skipping dot-folders and non-images', async () => {
    const names = (await listPrepCandidates(event)).map((file) => file.slice(event.length + 1).replaceAll('\\', '/'));
    expect(names).toEqual([
      '@andi/phone.jpg',
      '@andi/whatsapp.jpg',
      '@sari/edited.jpg',
      'IMG_1234.HEIC',
      'anim.gif',
      'broken.jpg',
      'day-2/IMG_9.JPG',
      'poster.png',
      'renamed.jpg',
      'small.webp',
    ]);
  });

  it('accepts a single file', async () => {
    const file = join(event, '@andi', 'whatsapp.jpg');
    expect(await listPrepCandidates(file)).toEqual([file]);
  });
});

describe('prepFile', () => {
  it('a dry run reports the plan but writes nothing', async () => {
    const file = join(event, '@andi', 'phone.jpg');
    const before = await readFile(file);
    const outcome = await prepFile(file, { dryRun: true });
    expect(outcome).toMatchObject({ kind: 'jpeg', written: false, result: { action: 'resize' } });
    expect((await readFile(file)).equals(before)).toBe(true);
  });

  it('processes every file in place and reports each one', async () => {
    const outcomes = await prepAll();
    expect(byName(outcomes, 'phone.jpg')).toMatchObject({ kind: 'jpeg', written: true, result: { action: 'resize', rotated: true } });
    expect(byName(outcomes, 'whatsapp.jpg')).toMatchObject({ kind: 'jpeg', written: false, result: { action: 'none' } });
    expect(byName(outcomes, 'edited.jpg')).toMatchObject({ kind: 'jpeg', written: true, result: { action: 'strip' } });
    expect(byName(outcomes, 'IMG_9.JPG')).toMatchObject({ kind: 'jpeg', written: true, result: { action: 'resize' } });
    expect(byName(outcomes, 'poster.png')).toMatchObject({ kind: 'other-format', format: 'png', oversize: true, hasGps: false });
    expect(byName(outcomes, 'small.webp')).toMatchObject({ kind: 'other-format', format: 'webp', oversize: false });
    expect(byName(outcomes, 'IMG_1234.HEIC')).toMatchObject({ kind: 'heic', disguised: false });
    expect(byName(outcomes, 'renamed.jpg')).toMatchObject({ kind: 'heic', disguised: true });
    expect(byName(outcomes, 'broken.jpg')).toMatchObject({ kind: 'error' });
    expect(byName(outcomes, 'anim.gif')).toMatchObject({ kind: 'unsupported' });
    // PNG/WebP are never changed; the temp file never stays behind.
    expect((await stat(join(event, 'poster.png'))).size).toBeGreaterThan(0);
    await expect(stat(join(event, '@andi', 'phone.jpg.photos-prep-tmp'))).rejects.toThrow();
  });

  it('the content engine reads the prepared photo upright, with its date and without GPS', async () => {
    const info = await readImageInfo(join(event, '@andi', 'phone.jpg'));
    expect(info).toMatchObject({ format: 'jpeg', width: 1800, height: 2400, orientation: 1, exifDateTimeOriginal: '2026:09:20 18:30:00', exifOffsetTimeOriginal: '+08:00' });
    expect(info.hasGps).toBeUndefined();
    const loaded = await loadAlbums({ root: albums });
    expect(loaded.warnings.filter((issue) => issue.code === 'location-in-photo')).toEqual([]);
  });

  it('is idempotent: a second run writes nothing and every JPEG is already web-ready', async () => {
    const before = new Map<string, Buffer>();
    for (const file of await listPrepCandidates(event)) before.set(file, await readFile(file));
    const outcomes = await prepAll();
    for (const outcome of outcomes) {
      if (outcome.kind === 'jpeg') expect(outcome).toMatchObject({ written: false, result: { action: 'none' } });
    }
    for (const [file, bytes] of before) expect((await readFile(file)).equals(bytes)).toBe(true);
  });

  it('leaves the files in dot-folders alone', async () => {
    expect((await sharp(await readFile(join(event, '.hidden', 'skip.jpg'))).metadata()).width).toBe(3000);
  });
});

describe('generated demo images', () => {
  it('are never changed: npm run demo:images owns them, and one keeps its GPS on purpose', async () => {
    const file = join(albums, 'demo-event', 'IMG_1.jpg');
    await mkdir(join(albums, 'demo-event'), { recursive: true });
    const bytes = await makeJpeg({ width: 3000, height: 2000, gps: true });
    await writeFile(file, bytes);
    const outcome = await prepFile(file, { albumsAbs: albums });
    expect(outcome).toEqual({ kind: 'demo', absPath: file });
    expect(await readFile(file)).toEqual(bytes);
    expect(describeOutcome(outcome, false)).toMatchObject({ label: 'skipped', tone: 'ok' });
    const summary = summarise([outcome]);
    expect(needsAttention(summary)).toBe(false);
    expect(summaryLines(summary, false).map((line) => line.text)).toContain('1 generated demo image left as is (photos:prep never changes the demo folders).');
    // Without the albums folder (a folder outside the project), nothing is treated as demo.
    expect((await prepFile(file, { dryRun: true })).kind).toBe('jpeg');
  });
});

describe('report', () => {
  it('formats sizes in binary units, as photos:check and file browsers do', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(812 * 1024)).toBe('812 KB');
    expect(formatBytes(5.14 * 1024 * 1024)).toBe('5.1 MB');
  });

  it('says what to do with HEIC files, other formats and unreadable files', () => {
    const heic = describeOutcome({ kind: 'heic', absPath: 'x.heic', disguised: true }, false);
    expect(heic).toMatchObject({ label: 'convert', tone: 'attention' });
    expect(heic.detail).toContain('really a HEIC/HEIF photo with a JPEG name');
    const png = describeOutcome(
      { kind: 'other-format', absPath: 'a.png', format: 'png', snapshot: { width: 3000, height: 2000, bytes: 3_000_000 }, oversize: true, hasGps: true },
      false,
    );
    expect(png).toMatchObject({ label: 'check', tone: 'attention' });
    expect(png.detail).toMatch(/^PNG, 3000×2000, 2\.9 MB: left as is; too big .*GPS location/);
    expect(describeOutcome({ kind: 'error', absPath: 'b.jpg', message: 'could not be read' }, false)).toMatchObject({ label: 'error', tone: 'error' });
    expect(summaryLines(summarise([]), false)).toEqual([{ text: 'No JPEG photos found.', tone: 'info' }]);
  });

  it('summarises the run and says what still needs attention', async () => {
    const outcomes = [
      ...(await prepAll()),
      await prepFile(await put('@andi/new.jpg', await makeJpeg({ width: 2600, height: 1000, gps: true }))),
    ];
    const summary = summarise(outcomes);
    expect(summary).toMatchObject({ jpegs: 5, resized: 1, unchanged: 4, gpsRemoved: 1, heic: 2, unsupported: 1, errors: 1, otherFormatsToCheck: 1 });
    expect(needsAttention(summary)).toBe(true);
    const lines = summaryLines(summary, false);
    expect(lines[0]?.text).toMatch(/^5 JPEG photos: 1 resized, 4 already web-ready\./);
    expect(lines.map((line) => line.text)).toEqual(
      expect.arrayContaining(['GPS location removed from 1 photo.', expect.stringContaining('2 HEIC photos must be converted to JPEG')]),
    );
    expect(describeOutcome(outcomes.at(-1)!, false)).toMatchObject({ label: 'resized', tone: 'changed' });
    expect(describeOutcome(outcomes.at(-1)!, false).detail).toMatch(/^2600×1000 → 2400×923, .*removed GPS location/);
    expect(describeOutcome(outcomes.at(-1)!, true).label).toBe('would resize');
  });
});
