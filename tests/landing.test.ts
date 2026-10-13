/** Home page landing blocks (src/lib/landing.ts): featured event, chapters, spotlight, picks. */
import { describe, expect, it } from 'vitest';
import { buildLanding, CHAPTER_PHOTOS, MORE_EVENTS, spreadEvenly, type Landing } from '../src/lib/landing.ts';
import { build, index, sourceTree, type NodeSpec } from './helpers/content.ts';

/** `count` photos by `who`, one minute apart on `day` (YYYY:MM:DD). */
const photos = (count: number, who = 'alice', day = '2026:09:20') =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`@${who}/IMG_${String(i + 1).padStart(2, '0')}.jpg`, { exif: `${day} 10:${String(i).padStart(2, '0')}:00` }]),
  );

const event = (folder: string, date: string, extra: Partial<NodeSpec> = {}): NodeSpec => ({
  folder,
  index: index(`date: ${date}`),
  images: photos(8, 'alice', date.replaceAll('-', ':')),
  ...extra,
});

const landingOf = (events: NodeSpec[]): Landing | undefined => buildLanding(build(sourceTree(events)).root);

/** Every photo file the landing shows, in page order. */
const shown = (landing: Landing) => [
  landing.hero.photo.file,
  ...landing.chapters.flatMap((chapter) => chapter.photos.map(({ photo }) => photo.file)),
  ...(landing.spotlight ? [landing.spotlight.photo.file] : []),
  ...landing.moreEvents.flatMap((chapter) => chapter.photos.map(({ photo }) => photo.file)),
];

describe('spreadEvenly', () => {
  it('takes the first item and then every n/count-th', () => {
    expect(spreadEvenly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4)).toEqual([0, 2, 5, 7]);
  });

  it('returns everything when the pool is small enough, and nothing for a count of 0', () => {
    expect(spreadEvenly([1, 2], 5)).toEqual([1, 2]);
    expect(spreadEvenly([1, 2], 0)).toEqual([]);
  });
});

describe('buildLanding', () => {
  it('is undefined while no event has photos', () => {
    expect(landingOf([{ folder: 'empty', index: index('date: 2026-09-20') }])).toBeUndefined();
  });

  it('features the newest event, with its cover as the hero', () => {
    const landing = landingOf([event('older', '2026-08-01'), event('newer', '2026-09-20')]);
    expect(landing?.featured.slug).toBe('newer');
    expect(landing?.hero.photo.file).toBe(landing?.featured.cover?.file);
    expect(landing?.moreEvents.map((chapter) => chapter.node.slug)).toEqual(['older']);
  });

  it('features the event with featured: true instead, and keeps the others newest first', () => {
    const landing = landingOf([
      event('oldest', '2026-07-01', { index: index('date: 2026-07-01\nfeatured: true') }),
      event('middle', '2026-08-01'),
      event('newest', '2026-09-20'),
    ]);
    expect(landing?.featured.slug).toBe('oldest');
    expect(landing?.moreEvents.map((chapter) => chapter.node.slug)).toEqual(['newest', 'middle']);
  });

  it('makes one chapter per section of the featured event, numbered', () => {
    const landing = landingOf([
      {
        folder: 'event',
        index: index('date: 2026-09-20\nendDate: 2026-09-21'),
        children: [event('day-1', '2026-09-20'), event('day-2', '2026-09-21')],
      },
    ]);
    expect(landing?.chapters.map((chapter) => [chapter.kind, chapter.node.slug, chapter.position])).toEqual([
      ['section', 'day-1', { index: 1, total: 2 }],
      ['section', 'day-2', { index: 2, total: 2 }],
    ]);
    for (const chapter of landing?.chapters ?? []) expect(chapter.photos.length).toBe(CHAPTER_PHOTOS);
    expect(landing?.chapters[0]?.photos[0]?.albumPath).toEqual(['event', 'day-1']);
    expect(landing?.chapters[0]?.photos[0]?.titles).toEqual(['Event', 'Day 1']);
  });

  it('gives a featured event without sections one "highlights" chapter', () => {
    const landing = landingOf([event('event', '2026-09-20')]);
    expect(landing?.chapters.map((chapter) => chapter.kind)).toEqual(['highlights']);
  });

  it('never shows a photo twice', () => {
    const landing = landingOf([
      { folder: 'event', index: index('date: 2026-09-20'), children: [event('day-1', '2026-09-20'), event('day-2', '2026-09-21')] },
      event('earlier', '2026-08-01'),
    ]);
    const files = shown(landing as Landing);
    expect(new Set(files).size).toBe(files.length);
  });

  it('picks the cover first, then photos spread evenly over the album in date order', () => {
    const landing = landingOf([
      event('event', '2026-09-20', { index: index('date: 2026-09-20\ncover: "@alice/IMG_08.jpg"'), images: photos(12) }),
      event('earlier', '2026-08-01', { index: index('date: 2026-08-01\ncover: "@alice/IMG_10.jpg"'), images: photos(12, 'alice', '2026:08:01') }),
    ]);
    const picks = landing?.moreEvents[0]?.photos.map(({ photo }) => photo.relPath);
    expect(picks?.[0]).toBe('@alice/IMG_10.jpg');
    expect(picks).toEqual(['@alice/IMG_10.jpg', '@alice/IMG_01.jpg', '@alice/IMG_03.jpg', '@alice/IMG_06.jpg', '@alice/IMG_09.jpg']);
  });

  it('uses highlights: in the listed order, and its first as the spotlight', () => {
    const list = ['IMG_05', 'IMG_02', 'IMG_07'].map((name) => `  - "@alice/${name}.jpg"`).join('\n');
    const landing = landingOf([event('event', '2026-09-20', { index: index(`date: 2026-09-20\nhighlights:\n${list}`) })]);
    expect(landing?.spotlight?.photo.relPath).toBe('@alice/IMG_05.jpg');
    expect(landing?.chapters[0]?.photos.map(({ photo }) => photo.relPath)).toEqual(['@alice/IMG_02.jpg', '@alice/IMG_07.jpg']);
  });

  it('without highlights:, the spotlight is the first photo with a caption', () => {
    const landing = landingOf([event('event', '2026-09-20', { photos: '"@alice/IMG_06.jpg":\n  caption: "The best moment"\n' })]);
    expect(landing?.spotlight?.photo.relPath).toBe('@alice/IMG_06.jpg');
  });

  it(`shows at most ${MORE_EVENTS} more events`, () => {
    const events = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01'].map((date, i) => event(`e${i}`, date));
    expect(landingOf(events)?.moreEvents.length).toBe(MORE_EVENTS);
  });
});
