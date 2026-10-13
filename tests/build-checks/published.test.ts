import { describe, expect, it } from 'vitest';
import { albumPathOf, comparePublished, expectedAlbumPages, viewerPhotoSlugs } from '../../src/lib/build-checks/published.ts';
import { build, index, sourceTree } from '../helpers/content.ts';
import { indexNodes } from '../../src/lib/content/tree.ts';

const page = (photos: unknown[]) =>
  `<main><script type="application/json" id="viewer-data">${JSON.stringify({ context: 'Day 1', photos })}</script></main>`;

describe('albumPathOf', () => {
  it('maps album pages in dist/ to slug paths', () => {
    expect(albumPathOf('albums/demo-event-a/index.html')).toBe('demo-event-a');
    expect(albumPathOf('albums/demo-event-a/day-3/closing-photo/index.html')).toBe('demo-event-a/day-3/closing-photo');
    expect(albumPathOf('index.html')).toBeUndefined();
    expect(albumPathOf('404.html')).toBeUndefined();
    expect(albumPathOf('_astro/x.webp')).toBeUndefined();
  });
});

describe('viewerPhotoSlugs', () => {
  it('reads the photo slugs from the viewer data, or none without a grid', () => {
    expect(viewerPhotoSlugs(page([{ slug: 'alice-img-1' }, { slug: 'budi-img-2' }]))).toEqual(['alice-img-1', 'budi-img-2']);
    expect(viewerPhotoSlugs('<main><h1>Sections only</h1></main>')).toEqual([]);
  });

  it('throws on invalid JSON (reported by the link check)', () => {
    expect(() => viewerPhotoSlugs('<script type="application/json">{oops</script>')).toThrow();
  });
});

describe('comparePublished', () => {
  const expected = [
    { path: 'event', photoSlugs: [] },
    { path: 'event/day-1', photoSlugs: ['a', 'b'] },
  ];

  it('passes when pages match the published albums exactly', () => {
    expect(
      comparePublished(expected, [
        { path: 'event', photoSlugs: [] },
        { path: 'event/day-1', photoSlugs: ['b', 'a'] },
      ]),
    ).toEqual([]);
  });

  it('reports a page for a draft (or deleted) album', () => {
    const problems = comparePublished(expected, [
      { path: 'event', photoSlugs: [] },
      { path: 'event/day-1', photoSlugs: ['a', 'b'] },
      { path: 'event/day-4', photoSlugs: ['c'] },
    ]);
    expect(problems).toEqual([{ path: 'event/day-4', message: expect.stringContaining('a draft') }]);
  });

  it('reports a hidden photo in the viewer data, a missing photo, and a missing page', () => {
    const problems = comparePublished(expected, [{ path: 'event/day-1', photoSlugs: ['a', 'hidden-one'] }]);
    expect(problems).toEqual([
      { path: 'event', message: expect.stringContaining('has no page') },
      { path: 'event/day-1', message: expect.stringContaining('#hidden-one') },
      { path: 'event/day-1', message: expect.stringContaining('missing published photos: #b') },
    ]);
  });

  it('reports a photo listed twice', () => {
    const problems = comparePublished([{ path: 'x', photoSlugs: ['a'] }], [{ path: 'x', photoSlugs: ['a', 'a'] }]);
    expect(problems).toEqual([{ path: 'x', message: expect.stringContaining('more than once') }]);
  });
});

describe('expectedAlbumPages', () => {
  it('expects every album with its own photos, plus an "All photos" page for albums with sections', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'ori',
          index: index('date: 2026-08-03'),
          children: [
            { folder: 'day-1', images: { '@a/IMG_1.jpg': { exif: '2026:08:03 10:00:00' } } },
            { folder: 'day-2', images: { '@a/IMG_1.jpg': { exif: '2026:08:04 10:00:00' } } },
          ],
        },
        { folder: 'flat', images: ['@a/IMG_1.jpg'] },
      ]),
    );
    expect(expectedAlbumPages(indexNodes(root).values())).toEqual([
      { path: 'ori', photoSlugs: [] },
      { path: 'ori/all', photoSlugs: ['day-1/a-img-1', 'day-2/a-img-1'] },
      { path: 'ori/day-1', photoSlugs: ['a-img-1'] },
      { path: 'ori/day-2', photoSlugs: ['a-img-1'] },
      { path: 'flat', photoSlugs: ['a-img-1'] },
    ]);
  });
});
