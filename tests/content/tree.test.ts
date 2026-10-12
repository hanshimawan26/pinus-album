import { describe, expect, it } from 'vitest';
import { formatDate } from '../../src/lib/dates.ts';
import { indexNodes, pathTo, photosInSubtree, siblingsOf } from '../../src/lib/content/tree.ts';
import type { AlbumNode } from '../../src/lib/content/types.ts';
import { build, index, sourceTree, type NodeSpec } from '../helpers/content.ts';

const slugs = (nodes: readonly AlbumNode[]) => nodes.map((node) => node.slug);
const photoPaths = (node: AlbumNode | undefined) => node?.photos.map((photo) => photo.relPath);
const event = (folder: string, date?: string, extra: Partial<NodeSpec> = {}): NodeSpec => ({
  folder,
  index: date ? index(`date: ${date}`) : undefined,
  images: ['@a/IMG_1.jpg'],
  ...extra,
});

describe('event ordering (TRD §4.3: newest date first)', () => {
  it('sorts events by date, newest first, undated last', () => {
    const { root } = build(
      sourceTree([event('old', '2025-01-10'), event('undated'), event('newest', '2026-09-20'), event('middle', '2026-03-01')]),
    );
    expect(slugs(root.children)).toEqual(['newest', 'middle', 'old', 'undated']);
  });

  it('uses the derived date (earliest photo) of events without an index.md date', () => {
    const { root } = build(
      sourceTree([
        event('a', '2026-01-01'),
        { folder: 'b', images: { 'IMG_1.jpg': { exif: '2026:06:01 10:00:00' } } },
      ]),
    );
    expect(slugs(root.children)).toEqual(['b', 'a']);
    expect(root.children[0]?.dateSource).toBe('photos');
  });

  it('breaks ties by order, then name', () => {
    const { root } = build(
      sourceTree([
        event('zeta', '2026-01-01'),
        { ...event('alpha', '2026-01-01'), index: index('date: 2026-01-01\norder: 2') },
        { ...event('beta', '2026-01-01'), index: index('date: 2026-01-01\norder: 1') },
      ]),
    );
    expect(slugs(root.children)).toEqual(['beta', 'alpha', 'zeta']);
  });
});

describe('section ordering (TRD §4.3: order → numeric prefix → date → name)', () => {
  const sections = (...children: NodeSpec[]) => build(sourceTree([{ folder: 'event', index: index('date: 2026-09-20'), children }])).root.children[0]!;

  it('sorts by order first', () => {
    const node = sections(
      { folder: '01-intro', index: index('order: 3') },
      { folder: 'b', index: index('order: 1') },
      { folder: 'a', index: index('order: 2') },
    );
    expect(slugs(node.children)).toEqual(['b', 'a', 'intro']);
  });

  it('then by numeric folder prefix, which is stripped from the slug', () => {
    const node = sections({ folder: '10-closing' }, { folder: '02-day-2' }, { folder: '01-day-1' });
    expect(slugs(node.children)).toEqual(['day-1', 'day-2', 'closing']);
    expect(node.children[0]?.slugPath).toEqual(['event', 'day-1']);
    expect(node.children[0]?.prefix).toBe(1);
  });

  it('then by date', () => {
    const node = sections(
      { folder: 'b', index: index('date: 2026-09-22') },
      { folder: 'a', index: index('date: 2026-09-23') },
      { folder: 'c', index: index('date: 2026-09-21') },
    );
    expect(slugs(node.children)).toEqual(['c', 'b', 'a']);
  });

  it('then by name, in natural order', () => {
    const node = sections({ folder: 'day-10' }, { folder: 'day-2' }, { folder: 'day-1' });
    expect(slugs(node.children)).toEqual(['day-1', 'day-2', 'day-10']);
  });

  it('puts sections missing a key after those that have it', () => {
    const node = sections(
      { folder: 'no-order' },
      { folder: 'ordered', index: index('order: 5') },
      { folder: '01-prefixed' },
      { folder: 'dated', index: index('date: 2026-09-20') },
    );
    expect(slugs(node.children)).toEqual(['ordered', 'prefixed', 'dated', 'no-order']);
  });
});

describe('photo ordering (TRD §4.3)', () => {
  it('sorts by resolved date/time, then path; undated photos last', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'e',
          photos: '"@b/IMG_1.jpg":\n  date: 2026-09-20 08:00\n',
          images: {
            '@a/IMG_3.jpg': { exif: '2026:09:20 12:00:00' },
            '@a/IMG_2.jpg': { exif: '2026:09:20 09:00:00' },
            '@b/IMG_1.jpg': {},
            '@b/IMG_9.jpg': {},
            '@a/IMG_1.jpg': { exif: '2026:09:20 09:00:00' },
          },
        },
      ]),
    );
    expect(photoPaths(root.children[0])).toEqual(['@b/IMG_1.jpg', '@a/IMG_1.jpg', '@a/IMG_2.jpg', '@a/IMG_3.jpg', '@b/IMG_9.jpg']);
  });

  it('places photos dated by a calendar date (index.md fallback) at the start of that day', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'e',
          index: index('date: 2026-09-20'),
          images: { 'late.jpg': { exif: '2026:09:20 23:00:00' }, 'no-exif.jpg': {}, 'early.jpg': { exif: '2026:09:20 00:30:00' } },
        },
      ]),
    );
    expect(photoPaths(root.children[0])).toEqual(['no-exif.jpg', 'early.jpg', 'late.jpg']);
  });

  it('sorts by path (natural order) with sort: filename', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'e',
          index: index('sort: filename'),
          images: {
            'IMG_10.jpg': { exif: '2026:01:01 00:00:00' },
            'IMG_2.jpg': { exif: '2026:12:01 00:00:00' },
            '@z/IMG_1.jpg': {},
          },
        },
      ]),
    );
    expect(photoPaths(root.children[0])).toEqual(['@z/IMG_1.jpg', 'IMG_2.jpg', 'IMG_10.jpg']);
  });
});

describe('counts', () => {
  const tree = sourceTree([
    {
      folder: 'event',
      index: index('date: 2026-09-20'),
      images: ['own.jpg'],
      photos: 'own.jpg:\n  hidden: true\n',
      children: [
        { folder: 'day-1', images: ['a.jpg', 'b.jpg'], children: [{ folder: 'morning', images: ['c.jpg'] }] },
        { folder: 'day-2', images: ['d.jpg', 'e.jpg'], photos: 'e.jpg:\n  hidden: true\n' },
        { folder: 'day-3', index: index('draft: true'), images: ['f.jpg', 'g.jpg'] },
      ],
    },
  ]);

  it('counts all published descendant photos, excluding hidden photos and drafts', () => {
    const eventNode = build(tree).root.children[0]!;
    expect(eventNode.photoCount).toBe(4); // a, b, c, d
    expect(eventNode.photos).toEqual([]);
    expect(eventNode.children.map((child) => child.photoCount)).toEqual([3, 1]);
  });

  it('counts direct published children as sections', () => {
    const eventNode = build(tree).root.children[0]!;
    expect(eventNode.sectionCount).toBe(2);
    expect(eventNode.children[0]?.sectionCount).toBe(1);
  });

  it('includes drafts when includeDrafts is true', () => {
    const eventNode = build(tree, true).root.children[0]!;
    expect(eventNode.photoCount).toBe(6);
    expect(eventNode.sectionCount).toBe(3);
    expect(eventNode.children[2]?.draft).toBe(true);
  });
});

describe('drafts', () => {
  const tree = sourceTree([
    event('published', '2026-09-20', {
      children: [{ folder: 'draft-section', index: index('draft: true'), images: ['x.jpg'], children: [{ folder: 'inner', images: ['y.jpg'] }] }],
    }),
    event('draft-event', '2026-10-01', { index: index('date: 2026-10-01\ndraft: true') }),
  ]);

  it('excludes draft nodes and their whole subtree in production', () => {
    const { root } = build(tree);
    expect(slugs(root.children)).toEqual(['published']);
    expect(root.children[0]?.children).toEqual([]);
    expect([...indexNodes(root).keys()]).toEqual(['', 'published']);
  });

  it('includes them in dev', () => {
    const { root } = build(tree, true);
    expect(slugs(root.children)).toEqual(['draft-event', 'published']);
    expect([...indexNodes(root).keys()]).toContain('published/draft-section/inner');
  });
});

describe('covers', () => {
  it('uses index.md cover, which may point into a descendant', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'event',
          index: index('cover: 02-day-2/@b/IMG_7.jpg'),
          children: [
            { folder: '01-day-1', images: ['@a/IMG_1.jpg'] },
            { folder: '02-day-2', images: ['@b/IMG_6.jpg', '@b/IMG_7.jpg'] },
          ],
        },
      ]),
    );
    expect(root.children[0]?.cover?.file).toBe('src/albums/event/02-day-2/@b/IMG_7.jpg');
  });

  it('defaults to the first visible photo of the node, in display order', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'event',
          photos: '"@a/IMG_1.jpg":\n  hidden: true\n',
          images: { '@a/IMG_2.jpg': { exif: '2026:09:20 12:00:00' }, '@a/IMG_1.jpg': { exif: '2026:09:20 08:00:00' }, '@a/IMG_3.jpg': { exif: '2026:09:20 10:00:00' } },
        },
      ]),
    );
    expect(root.children[0]?.cover?.relPath).toBe('@a/IMG_3.jpg');
  });

  it('falls back to the cover of the first child that has one', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'event',
          children: [{ folder: '01-empty' }, { folder: '02-day-2', images: ['IMG_9.jpg'] }, { folder: '03-day-3', images: ['IMG_1.jpg'] }],
        },
      ]),
    );
    expect(root.children[0]?.cover?.file).toBe('src/albums/event/02-day-2/IMG_9.jpg');
    expect(root.children[0]?.children[0]?.cover).toBeUndefined();
  });

  it('falls back when the cover is missing, hidden or inside an excluded draft', () => {
    const { root } = build(
      sourceTree([
        { folder: 'a', index: index('cover: nope.jpg'), images: ['IMG_1.jpg'] },
        { folder: 'b', index: index('cover: IMG_2.jpg'), photos: 'IMG_2.jpg:\n  hidden: true\n', images: ['IMG_1.jpg', 'IMG_2.jpg'] },
        {
          folder: 'c',
          index: index('cover: draft/IMG_9.jpg'),
          children: [{ folder: 'draft', index: index('draft: true'), images: ['IMG_9.jpg'] }, { folder: 'live', images: ['IMG_1.jpg'] }],
        },
      ]),
    );
    const covers = Object.fromEntries(root.children.map((child) => [child.slug, child.cover?.relPath]));
    expect(covers).toEqual({ a: 'IMG_1.jpg', b: 'IMG_1.jpg', c: 'IMG_1.jpg' });
  });
});

describe('titles, dates and stories', () => {
  it('derives the title from the folder name and the date from the earliest photo (TRD §4.2 rule 7)', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'event',
          index: index('title: "Event"\ndate: 2026-09-18'),
          children: [
            {
              folder: '01-day-1',
              images: { 'b.jpg': { exif: '2026:09:19 10:00:00' }, 'a.jpg': { exif: '2026:09:18 22:00:00' } },
            },
          ],
        },
      ]),
    );
    const day = root.children[0]?.children[0];
    expect(day?.title).toBe('Day 1');
    expect(day?.dateSource).toBe('photos');
    expect(formatDate(day!.date!)).toBe('18 Sep 2026');
  });

  it('does not derive a section date from photos that only inherited the event date', () => {
    // Sections without index.md (rule 7). Day B holds a WhatsApp photo without EXIF, which
    // falls back to the event's start date; that must not make Day B "18 Sep" or sort it first.
    const { root } = build(
      sourceTree([
        {
          folder: 'event',
          index: index('date: 2026-09-18\nendDate: 2026-09-20'),
          children: [
            { folder: 'day-a', images: { '@a/IMG_1.jpg': { exif: '2026:09:18 10:00:00' } } },
            { folder: 'day-b', images: { '@a/IMG_2.jpg': { exif: '2026:09:20 10:00:00' }, 'WA0001.jpg': {} } },
            { folder: 'day-c', images: { '@a/IMG_3.jpg': { exif: '2026:09:19 10:00:00' } } },
            { folder: 'day-d', images: { 'WA0002.jpg': {} } },
          ],
        },
      ]),
    );
    const sections = root.children[0]!.children;
    expect(sections.map((section) => [section.slug, section.date && formatDate(section.date)])).toEqual([
      ['day-a', '18 Sep 2026'],
      ['day-c', '19 Sep 2026'],
      ['day-b', '20 Sep 2026'],
      // Only inherited dates: no date of its own (absent data disappears), sorted last.
      ['day-d', undefined],
    ]);
    // The photo itself still shows the event date (TRD §4.6 fallback).
    expect(sections[2]?.photos.find((photo) => photo.relPath === 'WA0001.jpg')?.sources.date).toBe('index.md');
  });

  it('derives a date from children, including a child index.md date', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'event',
          index: index('title: "No date here"'),
          children: [
            { folder: 'day-2', index: index('date: 2026-09-21'), images: ['WA0001.jpg'] },
            { folder: 'day-1', images: { 'IMG_1.jpg': { exif: '2026:09:22 10:00:00' } } },
          ],
        },
      ]),
    );
    expect(root.children[0]?.date?.day).toBe('2026-09-21');
    expect(root.children[0]?.dateSource).toBe('photos');
  });

  it('ignores hidden photos when deriving a date', () => {
    const { root } = build(
      sourceTree([
        {
          folder: 'e',
          photos: 'a.jpg:\n  hidden: true\n',
          images: { 'a.jpg': { exif: '2020:01:01 10:00:00' }, 'b.jpg': { exif: '2026:09:18 10:00:00' } },
        },
      ]),
    );
    expect(root.children[0]?.date?.day).toBe('2026-09-18');
  });

  it('uses index.md title, dates and story when present', () => {
    const { root } = build(
      sourceTree([{ folder: 'e', index: index('title: "Pergelaran"\ndate: 2026-09-20\nendDate: 2026-09-23', '\nThe **story**.\n'), images: ['a.jpg'] }]),
    );
    const node = root.children[0]!;
    expect(node).toMatchObject({ title: 'Pergelaran', dateSource: 'index.md', story: 'The **story**.' });
    expect([node.date?.day, node.endDate?.day]).toEqual(['2026-09-20', '2026-09-23']);
  });

  it('has no date at all when nothing provides one', () => {
    const { root } = build(sourceTree([{ folder: 'e', images: ['a.jpg'] }]));
    expect(root.children[0]?.date).toBeUndefined();
    expect(root.children[0]?.dateSource).toBeUndefined();
  });
});

describe('photo slugs (TRD §4.7)', () => {
  it('are path-based and do not change when photos are added', () => {
    const before = build(sourceTree([{ folder: 'e', images: ['@andi-pratama/IMG_0012.jpg'] }])).root.children[0]!;
    const after = build(sourceTree([{ folder: 'e', images: ['@andi-pratama/IMG_0001.jpg', '@andi-pratama/IMG_0012.jpg'] }])).root.children[0]!;
    const slugOf = (node: AlbumNode) => node.photos.find((photo) => photo.relPath.endsWith('0012.jpg'))?.slug;
    expect(slugOf(before)).toBe('andi-pratama-img-0012');
    expect(slugOf(after)).toBe('andi-pratama-img-0012');
  });
});

describe('lookups', () => {
  const { root } = build(
    sourceTree([
      event('event', '2026-09-20', { children: [{ folder: '01-day-1' }, { folder: '02-day-2' }, { folder: '03-day-3' }] }),
    ]),
  );

  it('indexes every node by slug path', () => {
    expect([...indexNodes(root).keys()]).toEqual(['', 'event', 'event/day-1', 'event/day-2', 'event/day-3']);
  });

  it('finds the path from the event down to a node (breadcrumbs)', () => {
    expect(pathTo(root, ['event', 'day-2'])?.map((node) => node.title)).toEqual(['Event', 'Day 2']);
    expect(pathTo(root, ['event', 'missing'])).toBeUndefined();
  });

  it('finds previous and next siblings', () => {
    expect(slugs(Object.values(siblingsOf(root, ['event', 'day-2'])))).toEqual(['day-1', 'day-3']);
    expect(siblingsOf(root, ['event', 'day-1']).previous).toBeUndefined();
    expect(siblingsOf(root, ['event', 'day-3']).next).toBeUndefined();
    expect(siblingsOf(root, ['nope'])).toEqual({});
  });

  it('lists the photos of a subtree', () => {
    expect(photosInSubtree(root).map((photo) => photo.relPath)).toEqual(['@a/IMG_1.jpg']);
  });
});
