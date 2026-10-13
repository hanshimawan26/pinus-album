/**
 * Integration test over the committed demo content (TRD §12.1): it must load with zero
 * errors and demonstrate every metadata case.
 *
 * It looks only at the demo event folders (`DEMO_EVENTS`), so real albums next to them (with their own
 * warnings, drafts or newer dates) never break it, and it is skipped once the committee
 * deletes the demo folders (README: "Delete the demo content"). Real content is checked
 * by `npm run photos:check` and the build instead.
 */
import exifr from 'exifr';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEMO_IMAGES, renderDemoImage } from '../../scripts/demo-images.ts';
import { ALBUMS_DIR, DEMO_EVENTS } from '../../src/lib/config.ts';
import { loadAlbums, photosInSubtree, siblingsOf, siteLoadOptions, type AlbumNode, type Albums, type Photo } from '../../src/lib/content/index.ts';
import { formatDate, formatDateRange } from '../../src/lib/dates.ts';

const demoPresent = DEMO_EVENTS.every((event) => existsSync(`${ALBUMS_DIR}/${event}`));
/** The demo event a slug path (`demo-event-a/day-1`) or file (`src/albums/demo-event-a/…`) belongs to. */
const isDemoPath = (slugPath: string) => DEMO_EVENTS.includes(slugPath.split('/')[0] ?? '');
const isDemoFile = (file: string) => file.startsWith(`${ALBUMS_DIR}/`) && isDemoPath(file.slice(ALBUMS_DIR.length + 1));
/** The demo events, newest first (real events are left out). */
const demoEvents = (tree: Albums): AlbumNode[] => tree.root.children.filter((event) => isDemoPath(event.slug));
const demoNodes = (tree: Albums): AlbumNode[] => [...tree.nodes.entries()].filter(([path]) => isDemoPath(path)).map(([, node]) => node);
const demoPhotos = (tree: Albums): Photo[] => demoEvents(tree).flatMap((event) => photosInSubtree(event));

/** As `astro dev` sees it with SHOW_HIDDEN (drafts and the hidden demo albums included). */
let albums: Albums;
/** As the E2E build sees it: production (no drafts) with SHOW_HIDDEN. */
let published: Albums;
let photos: Photo[];
const photo = (file: string) => photos.find((p) => p.file === `src/albums/${file}`);

beforeAll(async () => {
  if (!demoPresent) return;
  albums = await loadAlbums({ includeDrafts: true, includeHidden: true });
  published = await loadAlbums({ includeDrafts: false, includeHidden: true });
  photos = demoPhotos(albums); // visible photos (drafts included, hidden ones not)
});

describe.skipIf(!demoPresent)('demo content', () => {
  it('is hidden from the website, in dev and in production, unless SHOW_HIDDEN is set', async () => {
    for (const dev of [false, true]) {
      const site = await loadAlbums(siteLoadOptions(dev, false));
      expect(demoEvents(site)).toEqual([]);
      expect(demoNodes(site)).toEqual([]);
    }
    expect(demoEvents(published).every((event) => event.hidden)).toBe(true);
    expect(demoEvents(await loadAlbums(siteLoadOptions(false, true)))).toHaveLength(2);
  });

  it('has a venue on Demo Event A only', () => {
    const [eventA, eventB] = demoEvents(published);
    expect(eventA?.venue).toBe('Demo Venue, Auditorium Hall 2, University Town Campus');
    expect(eventB?.venue).toBeUndefined();
  });

  it('has zero errors', () => {
    expect(albums.errors.filter((issue) => isDemoFile(issue.file))).toEqual([]);
  });

  it('has only the intentional warnings', () => {
    expect(albums.warnings.filter((issue) => isDemoFile(issue.file)).map((issue) => [issue.code, issue.file])).toEqual([
      ['date-out-of-range', 'src/albums/demo-event-a/day-3/PXL_0005.jpg'],
      ['no-cover', 'src/albums/demo-event-a/day-3/after-party'],
      ['no-date', 'src/albums/demo-event-b/IMG-20260815-WA0002.jpg'],
      ['no-photographer', 'src/albums/demo-event-b/IMG-20260815-WA0003.jpg'],
      ['no-date', 'src/albums/demo-event-b/IMG-20260815-WA0003.jpg'],
      ['location-in-photo', 'src/albums/demo-event-b/IMG-20260815-WA0006.jpg'],
    ]);
  });

  it('has the TRD §12.1 shape: event A with three sections of 10–20 images, flat event B with 12', () => {
    const [eventA, eventB] = demoEvents(published);
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
    expect(demoPhotos(albums)).toHaveLength(DEMO_IMAGES.length - 1); // every image but the hidden one
  });

  it('lists events newest first with dates, counts and covers', () => {
    const [eventA, eventB] = demoEvents(published);
    expect(formatDateRange(eventA!.date!, eventA!.endDate)).toBe('18–20 Sep 2026');
    expect(eventA).toMatchObject({ photoCount: 35, sectionCount: 3, dateSource: 'index.md' });
    expect(eventA?.cover?.file).toBe('src/albums/demo-event-a/day-2/@budi-demo/DSC_0102.jpg');
    expect(formatDate(eventB!.date!)).toBe('15 Aug 2026');
    expect(eventB).toMatchObject({ photoCount: 12, sectionCount: 0, dateSource: 'photos', sort: 'filename' });
  });

  it('has a draft section that only `astro dev` shows: no page, card, sibling link or count in production', () => {
    const day4 = albums.nodes.get('demo-event-a/day-4');
    expect(day4).toMatchObject({ draft: true, title: 'Day 4 (draft demo)', photoCount: 3 });
    expect(day4?.story).toContain('Demo content');
    expect(albums.nodes.get('demo-event-a')).toMatchObject({ photoCount: 38, sectionCount: 4 });
    expect(siblingsOf(albums.root, ['demo-event-a', 'day-3']).next?.slug).toBe('day-4');

    expect(published.nodes.has('demo-event-a/day-4')).toBe(false);
    expect(published.nodes.get('demo-event-a')).toMatchObject({ photoCount: 35, sectionCount: 3 });
    expect(siblingsOf(published.root, ['demo-event-a', 'day-3']).next).toBeUndefined();
    expect(demoPhotos(published).some((p) => p.file.includes('/day-4/'))).toBe(false);
    expect(demoNodes(albums).filter((node) => node.draft)).toHaveLength(1);
  });

  it('has a third level: a single-photo sub-section with a long title, and an empty one', () => {
    const day3 = published.nodes.get('demo-event-a/day-3');
    expect(day3?.children.map((child) => child.slug)).toEqual(['closing-photo', 'after-party']);
    expect(day3?.photos.length).toBeGreaterThan(0); // photos and sections in one node
    expect(day3).toMatchObject({ photoCount: 11, sectionCount: 2 });

    const closing = published.nodes.get('demo-event-a/day-3/closing-photo');
    expect(closing?.photos).toHaveLength(1);
    expect(closing?.title.length).toBeGreaterThan(60);
    expect(closing?.cover?.relPath).toBe('@dewi-demo/DSC_9001.jpg');

    const empty = published.nodes.get('demo-event-a/day-3/after-party');
    expect(empty).toMatchObject({ photoCount: 0, sectionCount: 0, photos: [], children: [] });
    expect(empty?.cover).toBeUndefined();
    expect(empty?.date).toBeUndefined();
  });

  it('has a caption with a long unbroken link, by a photographer with a long name and no Instagram', () => {
    const single = photo('demo-event-a/day-3/closing-photo/@dewi-demo/DSC_9001.jpg');
    expect(single?.caption).toMatch(/https:\/\/\S{60,}/);
    expect(single?.photographer).toMatchObject({ name: 'Dewi Kartika Sari Wulandari Putri (Demo)', initials: 'DD', listed: true });
    expect(single?.photographer?.instagram).toBeUndefined();
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

  it('has a long multi-paragraph caption, for the 3-line clamp and "more" in the viewer', () => {
    const long = photo('demo-event-a/day-1/@alice-demo/IMG_0005.jpg');
    expect(long?.caption?.length).toBeGreaterThan(200);
    expect(long?.caption).toContain('\n\n');
    expect(long).toMatchObject({ alt: 'Demo photo with a long caption', sources: { alt: 'photos.yaml' } });
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
    expect(demoPhotos(albums)).toHaveLength(DEMO_IMAGES.length - 1);
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
    for (const node of demoNodes(albums)) {
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
