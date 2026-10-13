import { describe, expect, it } from 'vitest';
import { allPhotosOf, allPhotosPath, hasAllPhotosPage } from '../src/lib/all-photos.ts';
import type { AlbumNode } from '../src/lib/content/types.ts';
import { build, index, sourceTree } from './helpers/content.ts';

/**
 * Pinus ORI-like event: its own (undated) photo, Day 1 and Day 2 with EXIF times, and a
 * sub-section inside Day 2. Day 1 is listed after Day 2 by `order`, so section order and
 * date order differ.
 */
const { root } = build(
  sourceTree([
    {
      folder: 'ori',
      index: index('title: "Pinus ORI"\ndate: 2026-08-03'),
      images: { '@eizel/IMG_1.jpg': {} },
      children: [
        {
          folder: 'day-1',
          index: index('title: "Day 1"\norder: 2'),
          images: {
            '@rayhan/IMG_1.jpg': { exif: '2026:08:03 09:00:00' },
            '@eizel/IMG_1.jpg': { exif: '2026:08:03 08:00:00' },
          },
        },
        {
          folder: 'day-2',
          index: index('title: "Day 2"\norder: 1'),
          images: { '@rayhan/IMG_1.jpg': { exif: '2026:08:04 10:00:00' } },
          children: [{ folder: 'beach', index: index('title: "Beach"'), images: { '@rayhan/IMG_2.jpg': { exif: '2026:08:04 09:00:00' } } }],
        },
      ],
    },
  ]),
);
const event = root.children[0] as AlbumNode;
const day1 = event.children.find((child) => child.slug === 'day-1') as AlbumNode;

describe('hasAllPhotosPage (TRD §6.3 item 7: albums with sections)', () => {
  it('is true for an event or section with sections and photos', () => {
    expect(hasAllPhotosPage(event)).toBe(true);
    expect(hasAllPhotosPage(event.children.find((child) => child.slug === 'day-2') as AlbumNode)).toBe(true);
  });

  it('is false without sections, without photos, and for the root', () => {
    expect(hasAllPhotosPage(day1)).toBe(false);
    expect(hasAllPhotosPage({ depth: 1, children: [day1], photoCount: 0 })).toBe(false);
    expect(hasAllPhotosPage(root)).toBe(false);
  });
});

describe('allPhotosPath', () => {
  it('is the album path plus "all"', () => {
    expect(allPhotosPath(event)).toEqual(['ori', 'all']);
  });
});

describe('allPhotosOf', () => {
  const photos = allPhotosOf(event, ['Pinus ORI']);

  it('lists every photo of the event and its sections, oldest first', () => {
    // The event's own photo has no EXIF date: it falls back to the event's date (midnight),
    // so it sorts before the first timed photo of that day.
    expect(photos.map((item) => item.slug)).toEqual([
      'eizel-img-1',
      'day-1/eizel-img-1',
      'day-1/rayhan-img-1',
      'day-2/beach/rayhan-img-2',
      'day-2/rayhan-img-1',
    ]);
  });

  it('gives deep-link slugs that are unique even when sections reuse file names', () => {
    const slugs = photos.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('names each photo\'s own section in its context line', () => {
    expect(photos.map((item) => item.context)).toEqual([
      'Pinus ORI',
      'Day 1 · Pinus ORI',
      'Day 1 · Pinus ORI',
      'Beach · Day 2 · Pinus ORI',
      'Day 2 · Pinus ORI',
    ]);
  });

  it('keeps album order for photos with the same date', () => {
    const { root: sameDay } = build(
      sourceTree([
        {
          folder: 'e',
          index: index('date: 2026-08-03'),
          children: [
            { folder: '01-b', images: ['@x/IMG_1.jpg'] },
            { folder: '02-a', images: ['@x/IMG_1.jpg'] },
          ],
        },
      ]),
    );
    expect(allPhotosOf(sameDay.children[0] as AlbumNode, ['E']).map((item) => item.slug)).toEqual(['b/x-img-1', 'a/x-img-1']);
  });

  it('puts photos without any date last', () => {
    const { root: undated } = build(
      sourceTree([
        {
          folder: 'e',
          children: [
            { folder: '01-a', images: ['@x/IMG_1.jpg'] },
            { folder: '02-b', images: { '@x/IMG_1.jpg': { exif: '2026:08:03 10:00:00' } } },
          ],
        },
      ]),
    );
    expect(allPhotosOf(undated.children[0] as AlbumNode, ['E']).map((item) => item.slug)).toEqual(['b/x-img-1', 'a/x-img-1']);
  });
});
