import { describe, expect, it } from 'vitest';
import { CONTENT_WARNING_BYTES, LARGE_IMAGE_BYTES } from '../../src/lib/content/validate.ts';
import type { Issue } from '../../src/lib/content/types.ts';
import { build, codes, index, sourceTree, type NodeSpec } from '../helpers/content.ts';

const issuesFor = (events: NodeSpec[], options?: Parameters<typeof sourceTree>[1]) => build(sourceTree(events, options)).issues;

/** A node that is valid and warning-free on its own. */
const clean = (folder: string, extra: Partial<NodeSpec> = {}): NodeSpec => ({
  folder,
  index: index('date: 2026-09-20'),
  images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00' } },
  ...extra,
});

describe('a clean album', () => {
  it('has no issues', () => {
    expect(issuesFor([clean('event', { children: [clean('day-1')] })])).toEqual([]);
  });
});

describe('errors (TRD §4.8)', () => {
  it('invalid frontmatter in index.md', () => {
    const issues = issuesFor([clean('event', { index: index('titel: "Oops"') })]);
    expect(issues).toEqual([
      expect.objectContaining({ level: 'error', code: 'invalid-index-md', file: 'src/albums/event/index.md' }),
    ]);
    expect(issues[0]?.message).toContain('Unknown field "titel"');
  });

  it('invalid YAML in index.md', () => {
    expect(codes(issuesFor([clean('event', { index: '---\ntitle: "unclosed\n---' })]))).toContain('invalid-index-md');
  });

  it('invalid YAML or fields in photos.yaml', () => {
    const issues = issuesFor([clean('event', { photos: '"@alice/IMG_1.jpg":\n  hidden: maybe\n' })]);
    expect(issues).toEqual([expect.objectContaining({ code: 'invalid-photos-yaml', file: 'src/albums/event/photos.yaml' })]);
    expect(codes(issuesFor([clean('event', { photos: 'a: [' })]))).toEqual(['invalid-photos-yaml']);
  });

  it('an invalid photos.yaml entry does not stop the other entries from being checked and applied', () => {
    const { root, issues } = build(
      sourceTree([
        clean('event', {
          photos: '"@alice/IMG_1.jpg":\n  captoin: x\n"@alice/IMG_2.jpg":\n  hidden: true\n"@alice/img_3.jpg":\n  caption: y\n',
          images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00' }, '@alice/IMG_2.jpg': { exif: '2026:09:20 10:00:00' }, '@alice/IMG_3.jpg': { exif: '2026:09:20 10:00:00' } },
        }),
      ]),
    );
    expect(codes(issues)).toEqual(['invalid-photos-yaml', 'photos-yaml-no-match']);
    expect(root.children[0]?.photos.map((photo) => photo.relPath)).toEqual(['@alice/IMG_1.jpg', '@alice/IMG_3.jpg']);
  });

  it('invalid photographers.yaml', () => {
    const issues = issuesFor([clean('event')], { photographers: 'alice:\n  instagram: "no spaces allowed"\n' });
    expect(issues).toEqual([expect.objectContaining({ code: 'invalid-photographers-yaml', file: 'src/albums/photographers.yaml' })]);
  });

  it('photos.yaml key that matches no file', () => {
    const issues = issuesFor([clean('event', { photos: '"@alice/IMG_404.jpg":\n  caption: "x"\n' })]);
    expect(issues).toEqual([expect.objectContaining({ level: 'error', code: 'photos-yaml-no-match', file: 'src/albums/event/photos.yaml' })]);
    expect(issues[0]?.message).toContain('"@alice/IMG_404.jpg" does not match any photo');
  });

  it('photos.yaml key that differs only in letter case explains case sensitivity', () => {
    const [issue] = issuesFor([clean('event', { photos: '"@alice/img_1.JPG":\n  caption: "x"\n' })]);
    expect(issue?.code).toBe('photos-yaml-no-match');
    expect(issue?.message).toContain('Did you mean "@alice/IMG_1.jpg"?');
    expect(issue?.message).toContain('Linux');
  });

  it('photos.yaml key that points into a sub-folder', () => {
    const [issue] = issuesFor([clean('event', { photos: '"day-1/@alice/IMG_1.jpg":\n  caption: x\n', children: [clean('day-1')] })]);
    expect(issue?.message).toContain('day-1/photos.yaml');
  });

  it('ambiguous bare file name in photos.yaml', () => {
    const [issue, ...rest] = issuesFor([
      clean('event', {
        photos: 'IMG_1.jpg:\n  caption: "Which one?"\n',
        images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00' }, '@budi/IMG_1.jpg': { exif: '2026:09:20 11:00:00' } },
      }),
    ]);
    expect(rest).toEqual([]);
    expect(issue).toMatchObject({ level: 'error', code: 'photos-yaml-ambiguous', file: 'src/albums/event/photos.yaml' });
    expect(issue?.message).toContain('"@alice/IMG_1.jpg", "@budi/IMG_1.jpg"');
  });

  it('the same photo listed twice in photos.yaml', () => {
    const issues = issuesFor([clean('event', { photos: 'IMG_1.jpg:\n  caption: a\n"@alice/IMG_1.jpg":\n  caption: b\n' })]);
    expect(codes(issues)).toEqual(['photos-yaml-duplicate']);
  });

  it('duplicate photo slug in a node', () => {
    const issues = issuesFor([
      clean('event', {
        images: { '@alice/IMG 1.jpg': { exif: '2026:09:20 10:00:00' }, '@alice/img-1.png': { exif: '2026:09:20 10:00:00' } },
      }),
    ]);
    expect(issues).toEqual([expect.objectContaining({ level: 'error', code: 'duplicate-photo-slug' })]);
    expect(issues[0]?.message).toContain('#alice-img-1');
  });

  it('duplicate sibling node slugs (01-day-1 and day-1)', () => {
    const issues = issuesFor([clean('event', { children: [clean('01-day-1'), clean('day-1')] })]);
    expect(issues).toEqual([expect.objectContaining({ level: 'error', code: 'duplicate-node-slug', file: 'src/albums/event/day-1' })]);
    expect(issues[0]?.message).toContain('"01-day-1" and "day-1"');
  });

  it('duplicate top-level event slugs', () => {
    expect(codes(issuesFor([clean('Event'), clean('event')]))).toEqual(['duplicate-node-slug']);
  });

  it('folder name without plain letters or digits (including non-Latin names)', () => {
    expect(codes(issuesFor([clean('event', { children: [clean('!!!')] })]))).toEqual(['invalid-folder-name']);
    const [issue] = issuesFor([clean('event', { children: [clean('日本')] })]);
    expect(issue).toMatchObject({ level: 'error', code: 'invalid-folder-name' });
    expect(issue?.message).toContain('no plain letters (a–z) or digits');
  });

  it('photo file name without plain letters or digits (no deep link possible)', () => {
    const issues = issuesFor([
      clean('event', { images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00' }, '_.jpg': { exif: '2026:09:20 11:00:00' }, '照片.jpg': { exif: '2026:09:20 12:00:00' } } }),
    ]).filter((issue) => issue.level === 'error');
    expect(issues.map((issue) => [issue.code, issue.file])).toEqual([
      ['invalid-file-name', 'src/albums/event/_.jpg'],
      ['invalid-file-name', 'src/albums/event/照片.jpg'],
    ]);
    expect(issues[1]?.message).toContain('"照片.jpg"');
  });

  it('unsupported image format: HEIC, with conversion instructions', () => {
    const [issue] = issuesFor([clean('event', { strays: [{ kind: 'heic', path: '@alice/IMG_2.HEIC' }] })]);
    expect(issue).toMatchObject({ level: 'error', code: 'unsupported-format', file: 'src/albums/event/@alice/IMG_2.HEIC' });
    expect(issue?.message).toContain('Convert it to JPEG');
  });

  it('unsupported image format: other image types', () => {
    const [issue] = issuesFor([clean('event', { strays: [{ kind: 'unsupported-image', path: 'anim.GIF' }] })]);
    expect(issue).toMatchObject({ code: 'unsupported-format' });
    expect(issue?.message).toContain('".gif" images are not supported');
  });

  it('unsupported image format: content does not match the extension', () => {
    const [issue] = issuesFor([clean('event', { images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00', format: 'heif' } } })]);
    expect(issue).toMatchObject({ code: 'unsupported-format', file: 'src/albums/event/@alice/IMG_1.jpg' });
    expect(issue?.message).toContain('really a HEIF image');
  });

  it('unreadable image', () => {
    const issues = issuesFor([clean('event', { images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00' }, 'broken.jpg': { readError: 'corrupt header' } } })]);
    expect(issues).toEqual([expect.objectContaining({ level: 'error', code: 'unreadable-image', file: 'src/albums/event/broken.jpg' })]);
  });

  it('cover that does not exist', () => {
    const [issue] = issuesFor([clean('event', { index: index('date: 2026-09-20\ncover: "@alice/IMG_404.jpg"') })]);
    expect(issue).toMatchObject({ level: 'error', code: 'missing-cover', file: 'src/albums/event/index.md' });
  });

  it('cover that differs only in letter case', () => {
    const [issue] = issuesFor([clean('event', { index: index('date: 2026-09-20\ncover: "@alice/img_1.jpg"') })]);
    expect(issue?.message).toContain('Did you mean "@alice/IMG_1.jpg"?');
  });

  it('cover that is a hidden photo', () => {
    const [issue] = issuesFor([
      clean('event', {
        index: index('date: 2026-09-20\ncover: "@alice/IMG_2.jpg"'),
        photos: '"@alice/IMG_2.jpg":\n  hidden: true\n',
        images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00' }, '@alice/IMG_2.jpg': { exif: '2026:09:20 10:00:00' } },
      }),
    ]);
    expect(issue).toMatchObject({ code: 'missing-cover' });
    expect(issue?.message).toContain('hidden');
  });

  it('cover pointing into a sub-folder is valid', () => {
    expect(issuesFor([clean('event', { index: index('date: 2026-09-20\ncover: day-1/@alice/IMG_1.jpg'), children: [clean('day-1')] })])).toEqual([]);
  });

  it('misplaced files and folders', () => {
    const issues = issuesFor(
      [clean('event', { strays: [{ kind: 'nested-in-photographer-folder', path: '@alice/extra' }, { kind: 'invalid-photographer-folder', path: '@' }] })],
      { rootStrays: [{ kind: 'outside-event', path: 'IMG_9.jpg' }] },
    );
    expect(codes(issues)).toEqual(['misplaced-file', 'misplaced-file', 'misplaced-file']);
    expect(issues.map((issue) => issue.file)).toEqual(['src/albums/IMG_9.jpg', 'src/albums/event/@', 'src/albums/event/@alice/extra']);
  });

  it('also validates draft nodes', () => {
    const issues = issuesFor([clean('event', { children: [clean('wip', { index: index('draft: true\ntitel: x') })] })]);
    expect(codes(issues)).toEqual(['invalid-index-md']);
  });
});

describe('warnings (TRD §4.8)', () => {
  it('photo with no photographer', () => {
    const issues = issuesFor([clean('event', { images: { 'IMG_1.jpg': { exif: '2026:09:20 10:00:00' } } })]);
    expect(issues).toEqual([expect.objectContaining({ level: 'warning', code: 'no-photographer', file: 'src/albums/event/IMG_1.jpg' })]);
  });

  it('photo with no date', () => {
    const issues = issuesFor([clean('event', { index: undefined, images: ['@alice/IMG_1.jpg'] })]);
    expect(issues).toEqual([expect.objectContaining({ level: 'warning', code: 'no-date', file: 'src/albums/event/@alice/IMG_1.jpg' })]);
  });

  it('does not warn about hidden photos', () => {
    const issues = issuesFor([clean('event', { index: undefined, photos: 'IMG_2.jpg:\n  hidden: true\n', images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00' }, 'IMG_2.jpg': {} } })]);
    expect(issues).toEqual([]);
  });

  describe('EXIF date outside the node dates', () => {
    const exifPhoto = (exif: string) => ({ '@alice/IMG_1.jpg': { exif } });

    it('warns when the EXIF day is outside the node’s own date/endDate', () => {
      const [issue, ...rest] = issuesFor([clean('event', { index: index('date: 2026-09-20\nendDate: 2026-09-23'), images: exifPhoto('2020:01:01 10:00:00') })]);
      expect(rest).toEqual([]);
      expect(issue).toMatchObject({ level: 'warning', code: 'date-out-of-range', file: 'src/albums/event/@alice/IMG_1.jpg' });
      expect(issue?.message).toContain('1 Jan 2020');
      expect(issue?.message).toContain('20–23 Sep 2026');
    });

    it('treats the range as inclusive calendar days in TIMEZONE', () => {
      const tree = (exif: string) => [clean('event', { index: index('date: 2026-09-20\nendDate: 2026-09-23'), images: exifPhoto(exif) })];
      expect(issuesFor(tree('2026:09:23 23:59:00'))).toEqual([]);
      expect(issuesFor(tree('2026:09:20 00:00:00'))).toEqual([]);
      expect(codes(issuesFor(tree('2026:09:24 00:00:00')))).toEqual(['date-out-of-range']);
      expect(codes(issuesFor(tree('2026:09:19 23:59:00')))).toEqual(['date-out-of-range']);
    });

    it('uses date only (a single day) when there is no endDate', () => {
      expect(codes(issuesFor([clean('event', { images: exifPhoto('2026:09:21 08:00:00') })]))).toEqual(['date-out-of-range']);
    });

    it('uses the nearest ancestor that sets a date when the node has none', () => {
      const issues = issuesFor([
        clean('event', {
          index: index('date: 2026-09-20\nendDate: 2026-09-21'),
          children: [{ folder: 'day-1', images: exifPhoto('2026:09:25 10:00:00') }],
        }),
      ]);
      expect(codes(issues)).toEqual(['date-out-of-range']);
      expect(issues[0]?.message).toContain('src/albums/event/index.md');
    });

    it('uses the section’s own date rather than the event range', () => {
      const issues = issuesFor([
        clean('event', {
          index: index('date: 2026-09-20\nendDate: 2026-09-23'),
          children: [clean('day-1', { index: index('date: 2026-09-20'), images: exifPhoto('2026:09:22 10:00:00') })],
        }),
      ]);
      expect(codes(issues)).toEqual(['date-out-of-range']);
    });

    it('does not check photos when no ancestor sets a date, or when the date comes from photos.yaml', () => {
      expect(codes(issuesFor([clean('event', { index: undefined, images: exifPhoto('2020:01:01 10:00:00') })]))).toEqual([]);
      const override = clean('event', { photos: '"@alice/IMG_1.jpg":\n  date: 2020-01-01\n', images: exifPhoto('2026:09:20 10:00:00') });
      expect(issuesFor([override])).toEqual([]);
    });
  });

  it('image over 2 MB', () => {
    const tree = (size: number) => [clean('event', { images: { '@alice/IMG_1.jpg': { exif: '2026:09:20 10:00:00', size } } })];
    expect(issuesFor(tree(LARGE_IMAGE_BYTES))).toEqual([]);
    const [issue] = issuesFor(tree(LARGE_IMAGE_BYTES + 1));
    expect(issue).toMatchObject({ level: 'warning', code: 'large-image', file: 'src/albums/event/@alice/IMG_1.jpg' });
  });

  it('node with no cover (no visible photos in the folder or below)', () => {
    const issues = issuesFor([
      clean('event', { children: [{ folder: 'empty', index: index('date: 2026-09-20') }] }),
      { folder: 'all-hidden', index: index('date: 2026-09-20'), photos: '"@alice/IMG_1.jpg":\n  hidden: true\n', images: ['@alice/IMG_1.jpg'] },
    ]);
    expect(issues).toEqual([
      expect.objectContaining({ level: 'warning', code: 'no-cover', file: 'src/albums/all-hidden' }),
      expect.objectContaining({ level: 'warning', code: 'no-cover', file: 'src/albums/event/empty' }),
    ]);
  });

  it('total content over 700 MB', () => {
    expect(issuesFor([clean('event')], { totalBytes: CONTENT_WARNING_BYTES })).toEqual([]);
    expect(issuesFor([clean('event')], { totalBytes: CONTENT_WARNING_BYTES + 1 })).toEqual([
      expect.objectContaining({ level: 'warning', code: 'content-too-large', file: 'src/albums' }),
    ]);
  });

  it('ignored files: videos', () => {
    const issues = issuesFor([clean('event', { strays: [{ kind: 'video', path: 'clip.mov' }] })]);
    expect(issues).toEqual([expect.objectContaining({ level: 'warning', code: 'ignored-file' })]);
  });
});

describe('metadata files that are not read (errors: they may carry hidden or draft)', () => {
  const messageFor = (issues: readonly Issue[], suffix: string) => issues.find((issue) => issue.file.endsWith(suffix))?.message;

  it('misnamed metadata files, including the .txt ending Windows Notepad adds', () => {
    const issues = issuesFor([
      clean('event', {
        strays: [
          { kind: 'misnamed-metadata', path: 'photos.yml' },
          { kind: 'misnamed-metadata', path: 'Index.md' },
          { kind: 'misnamed-metadata', path: 'photos.yaml.txt' },
        ],
      }),
    ]);
    expect(issues.map((issue) => [issue.level, issue.code])).toEqual([
      ['error', 'misnamed-file'],
      ['error', 'misnamed-file'],
      ['error', 'misnamed-file'],
    ]);
    expect(messageFor(issues, 'photos.yml')).toContain('must be exactly "photos.yaml"');
    expect(messageFor(issues, 'Index.md')).toContain('"index.md"');
    expect(messageFor(issues, 'photos.yaml.txt')).toContain('".txt" ending');
    expect(messageFor(issues, 'photos.yml')).not.toContain('.txt');
  });

  it('index.md or photos.yaml inside an @photographer folder', () => {
    const issues = issuesFor([
      clean('event', {
        strays: [
          { kind: 'metadata-in-photographer-folder', path: '@andi/photos.yaml' },
          { kind: 'metadata-in-photographer-folder', path: '@andi/index.md' },
        ],
      }),
    ]);
    expect(issues.map((issue) => [issue.level, issue.code])).toEqual([
      ['error', 'misplaced-file'],
      ['error', 'misplaced-file'],
    ]);
    expect(messageFor(issues, '@andi/photos.yaml')).toContain('"@andi/IMG_0012.jpg"');
    expect(messageFor(issues, '@andi/index.md')).toContain('Move it up one level');
  });

  it('index.md or photos.yaml directly in the albums folder, and photographers.yaml inside an event', () => {
    const issues = issuesFor([clean('event', { strays: [{ kind: 'photographers-yaml-in-node', path: 'photographers.yaml' }] })], {
      rootStrays: [
        { kind: 'metadata-in-albums-folder', path: 'index.md' },
        { kind: 'metadata-in-albums-folder', path: 'photos.yaml' },
      ],
    });
    expect(issues.map((issue) => [issue.level, issue.code, issue.file])).toEqual([
      ['error', 'misplaced-file', 'src/albums/event/photographers.yaml'],
      ['error', 'misplaced-file', 'src/albums/index.md'],
      ['error', 'misplaced-file', 'src/albums/photos.yaml'],
    ]);
    expect(messageFor(issues, 'albums/photos.yaml')).toContain('Move it into the event folder');
    expect(messageFor(issues, 'event/photographers.yaml')).toContain('src/albums/photographers.yaml');
  });
});

describe('issue list', () => {
  it('puts errors before warnings, then sorts by file', () => {
    const issues = issuesFor([
      clean('b-event', { images: { 'IMG_1.jpg': { exif: '2026:09:20 10:00:00' } } }),
      clean('a-event', { photos: 'nope.jpg:\n  caption: x\n', images: { 'IMG_1.jpg': { exif: '2026:09:20 10:00:00' } } }),
    ]);
    expect(issues.map((issue) => [issue.level, issue.file])).toEqual([
      ['error', 'src/albums/a-event/photos.yaml'],
      ['warning', 'src/albums/a-event/IMG_1.jpg'],
      ['warning', 'src/albums/b-event/IMG_1.jpg'],
    ]);
  });

  it('uses repo-relative POSIX paths and plain-English messages', () => {
    for (const issue of issuesFor([clean('event', { photos: 'x.jpg:\n  caption: a\n', images: ['IMG_1.jpg'] })])) {
      expect(issue.file).toMatch(/^src\/albums\//);
      expect(issue.file).not.toContain('\\');
      expect(issue.message.length).toBeGreaterThan(20);
    }
  });
});
