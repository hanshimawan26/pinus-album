/** index.md `highlights:` and `featured:` (TRD §4.3, §4.8): parsing, the published tree, validation. */
import { describe, expect, it } from 'vitest';
import { parseIndexMd } from '../../src/lib/content/schemas.ts';
import { build, codes, index, sourceTree, type NodeSpec } from '../helpers/content.ts';

const photos = (count: number, prefix = '@alice/IMG_') =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}${i + 1}.jpg`, { exif: `2026:09:20 10:0${i}:00` }]));

const event = (folder: string, extra: Partial<NodeSpec> = {}): NodeSpec => ({
  folder,
  index: index('date: 2026-09-20'),
  images: photos(3),
  ...extra,
});

describe('parsing', () => {
  it('reads a list of paths, dropping blank entries', () => {
    const parsed = parseIndexMd(index('highlights:\n  - "@alice/IMG_2.jpg"\n  - ""\n  - day-1/@bob/IMG_9.jpg'));
    expect(parsed.ok && parsed.value.meta.highlights).toEqual(['@alice/IMG_2.jpg', 'day-1/@bob/IMG_9.jpg']);
  });

  it('treats an empty list as not set', () => {
    const parsed = parseIndexMd(index('highlights:'));
    expect(parsed.ok && parsed.value.meta.highlights).toBeUndefined();
  });

  it('explains a single path written without a list', () => {
    const parsed = parseIndexMd(index('highlights: "@alice/IMG_2.jpg"'));
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.problems.join(' ')).toContain('must be a list of photo paths');
  });

  it('reads featured: true', () => {
    const parsed = parseIndexMd(index('featured: true'));
    expect(parsed.ok && parsed.value.meta.featured).toBe(true);
  });
});

describe('the published tree', () => {
  it('keeps the listed order, including photos in sections, without repeats', () => {
    const { root } = build(
      sourceTree([
        event('event', {
          index: index('date: 2026-09-20\nhighlights:\n  - day-1/@bob/IMG_1.jpg\n  - "@alice/IMG_3.jpg"\n  - day-1/@bob/IMG_1.jpg'),
          children: [{ folder: 'day-1', index: index('date: 2026-09-20'), images: photos(2, '@bob/IMG_') }],
        }),
      ]),
    );
    expect(root.children[0]?.highlights.map((photo) => photo.file)).toEqual([
      'src/albums/event/day-1/@bob/IMG_1.jpg',
      'src/albums/event/@alice/IMG_3.jpg',
    ]);
  });

  it('leaves out hidden photos and photos in unpublished sections', () => {
    const { root } = build(
      sourceTree([
        event('event', {
          index: index('date: 2026-09-20\nhighlights:\n  - "@alice/IMG_1.jpg"\n  - "@alice/IMG_2.jpg"\n  - draft/@alice/IMG_1.jpg'),
          photos: '"@alice/IMG_1.jpg":\n  hidden: true\n',
          children: [event('draft', { index: index('date: 2026-09-20\ndraft: true') })],
        }),
      ]),
    );
    expect(root.children[0]?.highlights.map((photo) => photo.relPath)).toEqual(['@alice/IMG_2.jpg']);
  });

  it('is empty without a list, and marks featured events', () => {
    const { root } = build(sourceTree([event('a'), event('b', { index: index('date: 2026-09-20\nfeatured: true') })]));
    expect(root.children.map((node) => [node.slug, node.highlights.length, node.featured])).toEqual([
      ['a', 0, false],
      ['b', 0, true],
    ]);
  });
});

describe('validation', () => {
  it('a highlight that matches no photo is an error, with a letter-case hint', () => {
    const { issues } = build(sourceTree([event('event', { index: index('date: 2026-09-20\nhighlights:\n  - "@alice/img_2.jpg"') })]));
    expect(issues).toEqual([expect.objectContaining({ level: 'error', code: 'missing-highlight', file: 'src/albums/event/index.md' })]);
    expect(issues[0]?.message).toContain('Did you mean "@alice/IMG_2.jpg"?');
  });

  it('a hidden highlight is only a warning, so a takedown never blocks the build', () => {
    const { issues } = build(
      sourceTree([
        event('event', {
          index: index('date: 2026-09-20\nhighlights:\n  - "@alice/IMG_2.jpg"'),
          photos: '"@alice/IMG_2.jpg":\n  hidden: true\n',
        }),
      ]),
    );
    expect(issues).toEqual([expect.objectContaining({ level: 'warning', code: 'highlight-not-shown' })]);
    expect(issues[0]?.message).toContain('hidden in photos.yaml');
  });

  it('a highlight in a draft section is a warning', () => {
    const { issues } = build(
      sourceTree([
        event('event', {
          index: index('date: 2026-09-20\nhighlights:\n  - day-4/@alice/IMG_1.jpg'),
          children: [event('day-4', { index: index('title: "Day 4"\ndate: 2026-09-20\ndraft: true') })],
        }),
      ]),
    );
    expect(codes(issues)).toEqual(['highlight-not-shown']);
    expect(issues[0]?.message).toContain('"Day 4", which is a draft');
  });

  it('featured on a section is ignored, with a warning', () => {
    const { issues } = build(sourceTree([event('event', { children: [event('day-1', { index: index('date: 2026-09-20\nfeatured: true') })] })]));
    expect(issues).toEqual([expect.objectContaining({ level: 'warning', code: 'featured-ignored', file: 'src/albums/event/day-1/index.md' })]);
  });

  it('featured on more than one event warns on each', () => {
    const featured = index('date: 2026-09-20\nfeatured: true');
    const { issues } = build(sourceTree([event('a', { index: featured }), event('b', { index: featured })]));
    expect(codes(issues)).toEqual(['featured-ignored', 'featured-ignored']);
    expect(issues[0]?.message).toContain('features the newest of them');
  });
});
