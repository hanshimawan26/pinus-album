/**
 * Integration test over the committed demo content (TRD §12.1): it must load with zero
 * errors and demonstrate every metadata case.
 */
import exifr from 'exifr';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEMO_IMAGES, renderDemoImage } from '../../scripts/demo-images.ts';
import { loadAlbums, photosInSubtree, type Albums, type Photo } from '../../src/lib/content/index.ts';
import { formatDate, formatDateRange } from '../../src/lib/dates.ts';

let albums: Albums;
let photos: Photo[];
const photo = (file: string) => photos.find((p) => p.file === `src/albums/${file}`);

beforeAll(async () => {
  albums = await loadAlbums({ includeDrafts: true });
  photos = [];
  for (const node of albums.nodes.values()) photos.push(...node.photos); // published (visible) photos
});

describe('demo content', () => {
  it('has zero errors', () => {
    expect(albums.errors).toEqual([]);
  });

  it('has only the intentional warnings', () => {
    expect(albums.warnings.map((issue) => [issue.code, issue.file])).toEqual([
      ['date-out-of-range', 'src/albums/demo-event-a/day-3/PXL_0005.jpg'],
      ['no-date', 'src/albums/demo-event-b/IMG-20260815-WA0002.jpg'],
      ['no-photographer', 'src/albums/demo-event-b/IMG-20260815-WA0003.jpg'],
      ['no-date', 'src/albums/demo-event-b/IMG-20260815-WA0003.jpg'],
    ]);
  });

  it('has the TRD §12.1 shape: event A with three sections of 10–20 images, flat event B with 12', () => {
    const [eventA, eventB] = albums.root.children;
    expect(eventA?.title).toBe('Demo Event A');
    expect(eventA?.children.map((child) => child.slug)).toEqual(['day-1', 'day-2', 'day-3']);
    for (const section of eventA?.children ?? []) {
      const total = section.photos.length + (section.slug === 'day-2' ? 1 : 0); // + the hidden one
      expect(total).toBeGreaterThanOrEqual(10);
      expect(total).toBeLessThanOrEqual(20);
    }
    expect(eventB?.title).toBe('Demo Event B');
    expect(eventB?.children).toEqual([]);
    expect(eventB?.photos).toHaveLength(12);
    expect(albums.stats).toMatchObject({ photos: DEMO_IMAGES.length, hiddenPhotos: 1 });
  });

  it('lists events newest first with dates, counts and covers', () => {
    const [eventA, eventB] = albums.root.children;
    expect(formatDateRange(eventA!.date!, eventA!.endDate)).toBe('18–20 Sep 2026');
    expect(eventA).toMatchObject({ photoCount: 34, sectionCount: 3, dateSource: 'index.md' });
    expect(eventA?.cover?.file).toBe('src/albums/demo-event-a/day-2/@budi-demo/DSC_0102.jpg');
    expect(formatDate(eventB!.date!)).toBe('15 Aug 2026');
    expect(eventB).toMatchObject({ photoCount: 12, sectionCount: 0, dateSource: 'photos', sort: 'filename' });
  });

  it('derives title and date for a section without index.md (Day 1)', () => {
    const day1 = albums.nodes.get('demo-event-a/day-1');
    expect(day1).toMatchObject({ title: 'Day 1', dateSource: 'photos' });
    expect(day1?.story).toBeUndefined();
  });

  it('covers caption present and absent', () => {
    expect(photo('demo-event-a/day-1/@alice-demo/IMG_0001.jpg')?.caption).toBe('Demo caption: the registration desk opens.');
    expect(photo('demo-event-a/day-1/@budi-demo/IMG_0001.jpg')?.caption).toContain('\n');
    expect(photo('demo-event-a/day-1/@alice-demo/IMG_0002.jpg')?.caption).toBeUndefined();
  });

  it('covers every photographer source: folder, photos.yaml, index.md and missing', () => {
    expect(photo('demo-event-a/day-1/@alice-demo/IMG_0002.jpg')?.sources.photographer).toBe('folder');
    expect(photo('demo-event-a/day-1/@budi-demo/IMG_0003.jpg')?.sources.photographer).toBe('photos.yaml');
    expect(photo('demo-event-b/IMG-20260815-WA0001.jpg')?.sources.photographer).toBe('photos.yaml');
    expect(photo('demo-event-a/day-3/PXL_0001.jpg')?.sources.photographer).toBe('index.md');
    expect(photo('demo-event-b/IMG-20260815-WA0003.jpg')?.photographer).toBeUndefined();
  });

  it('covers every date source: photos.yaml, EXIF, node fallback and missing', () => {
    expect(photo('demo-event-a/day-2/@budi-demo/DSC_0103.jpg')?.sources.date).toBe('photos.yaml');
    expect(photo('demo-event-a/day-1/@alice-demo/IMG_0001.jpg')?.sources.date).toBe('exif');
    expect(photo('demo-event-a/day-2/@alice-demo/IMG_2005.jpg')).toMatchObject({ sources: { date: 'index.md' }, date: { day: '2026-09-19' } });
    expect(photo('demo-event-a/day-1/@budi-demo/IMG_0004.jpg')).toMatchObject({ sources: { date: 'index.md' }, date: { day: '2026-09-18' } });
    expect(photo('demo-event-b/IMG-20260815-WA0002.jpg')?.date).toBeUndefined();
  });

  it('covers alt text from photos.yaml, caption and generated', () => {
    expect(photo('demo-event-a/day-1/@budi-demo/IMG_0003.jpg')?.sources.alt).toBe('photos.yaml');
    expect(photo('demo-event-a/day-1/@alice-demo/IMG_0001.jpg')?.sources.alt).toBe('caption');
    expect(photo('demo-event-a/day-1/@alice-demo/IMG_0002.jpg')?.alt).toBe('Photo from Day 1 by Alice (Demo)');
    expect(photo('demo-event-b/IMG-20260815-WA0003.jpg')?.alt).toBe('Photo from Demo Event B');
  });

  it('hides exactly one photo from the site', () => {
    expect(photo('demo-event-a/day-2/@budi-demo/DSC_0106.jpg')).toBeUndefined();
    expect(photosInSubtree(albums.root)).toHaveLength(DEMO_IMAGES.length - 1);
  });

  it('covers photographers with and without Instagram, and one missing from photographers.yaml', () => {
    expect(albums.photographers.get('alice-demo')).toMatchObject({ listed: true, instagram: 'alice.demo.placeholder' });
    expect(albums.photographers.get('budi-demo')).toMatchObject({ listed: true, name: 'Budi (Demo)' });
    expect(albums.photographers.get('budi-demo')?.instagram).toBeUndefined();
    expect(albums.photographers.get('citra-demo')).toMatchObject({ listed: false, name: 'Citra Demo', initials: 'CD' });
  });

  it('has portrait, landscape and square images, and one rotated image reported upright', () => {
    const shapes = new Set(photos.map((p) => (p.width > p.height ? 'landscape' : p.width < p.height ? 'portrait' : 'square')));
    expect(shapes).toEqual(new Set(['landscape', 'portrait', 'square']));
    const rotated = photos.filter((p) => p.orientation !== 1);
    expect(rotated.map((p) => [p.relPath, p.orientation, p.width, p.height])).toEqual([['@alice-demo/IMG_0004.jpg', 6, 1067, 1600]]);
  });

  it('keeps demo images small', () => {
    for (const p of photos) expect(p.size).toBeLessThan(150 * 1024);
  });

  it('labels every demo story as demo content', () => {
    for (const node of albums.nodes.values()) {
      if (node.story) expect(node.story).toContain('Demo content');
    }
  });
});

describe('demo:images generator', () => {
  it('only targets demo-* folders', () => {
    for (const image of DEMO_IMAGES) expect(image.path).toMatch(/^demo-[^/]+\//);
  });

  it('is deterministic', async () => {
    const image = DEMO_IMAGES[0]!;
    expect((await renderDemoImage(image)).equals(await renderDemoImage(image))).toBe(true);
  });

  it('writes GPS tags into exactly one image (to prove stripping later)', async () => {
    const withGps = DEMO_IMAGES.filter((image) => image.gps);
    expect(withGps).toHaveLength(1);
    const metadata = await sharp(await renderDemoImage(withGps[0]!)).metadata();
    const gps = await exifr.gps(metadata.exif!.subarray(6));
    expect(gps?.latitude).toBeCloseTo(1.29, 1);
  });

  it('stores exactly one image sideways with EXIF orientation 6', async () => {
    const rotated = DEMO_IMAGES.filter((image) => image.rotated);
    expect(rotated).toHaveLength(1);
    const metadata = await sharp(await renderDemoImage(rotated[0]!)).metadata();
    expect([metadata.orientation, metadata.width, metadata.height]).toEqual([6, 1600, 1067]);
  });
});
