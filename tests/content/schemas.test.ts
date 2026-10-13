import { describe, expect, it } from 'vitest';
import {
  indexFrontmatterSchema,
  normaliseInstagramHandle,
  parseIndexMd,
  parsePhotographersYaml,
  parsePhotosYaml,
  splitFrontmatter,
} from '../../src/lib/content/schemas.ts';

const problemsOf = (result: { ok: boolean; problems?: string[] }) => (result.ok ? [] : (result.problems ?? []));

describe('index.md frontmatter', () => {
  it('parses every field and keeps the story as raw Markdown', () => {
    const result = parseIndexMd(`---
title: "Pergelaran 2026"
date: 2026-09-20
endDate: 2026-09-23
venue: "UTown Green"
cover: day-1/@andi-pratama/IMG_0012.jpg
photographer: andi-pratama
order: 1
draft: false
hidden: true
sort: filename
---

A **short** story.

Second paragraph.
`);
    expect(result).toEqual({
      ok: true,
      value: {
        meta: {
          title: 'Pergelaran 2026',
          date: { year: 2026, month: 9, day: 20, hour: 0, minute: 0, second: 0, hasTime: false },
          endDate: { year: 2026, month: 9, day: 23, hour: 0, minute: 0, second: 0, hasTime: false },
          venue: 'UTown Green',
          cover: 'day-1/@andi-pratama/IMG_0012.jpg',
          photographer: 'andi-pratama',
          order: 1,
          draft: false,
          hidden: true,
          sort: 'filename',
        },
        story: 'A **short** story.\n\nSecond paragraph.',
      },
    });
  });

  it('applies defaults and accepts an index.md without frontmatter', () => {
    expect(parseIndexMd('Just a story.')).toEqual({ ok: true, value: { meta: { draft: false, hidden: false, sort: 'date' }, story: 'Just a story.' } });
    expect(parseIndexMd('---\n---\n')).toEqual({ ok: true, value: { meta: { draft: false, hidden: false, sort: 'date' } } });
  });

  it('copes with a byte-order mark and Windows line endings', () => {
    const result = parseIndexMd('\uFEFF---\r\ntitle: Day 1\r\n---\r\nStory\r\n');
    expect(result).toMatchObject({ ok: true, value: { meta: { title: 'Day 1' }, story: 'Story' } });
  });

  it('accepts unquoted numbers as titles and normalises photographer slugs', () => {
    const result = parseIndexMd('---\ntitle: 2026\nphotographer: "@Andi Pratama"\n---');
    expect(result).toMatchObject({ ok: true, value: { meta: { title: '2026', photographer: 'andi-pratama' } } });
  });

  it('treats blank values as not set', () => {
    expect(parseIndexMd('---\ntitle:\ncover: ""\n---')).toMatchObject({ ok: true, value: { meta: { draft: false } } });
  });

  it('accepts dates whether yaml produced a string or a Date', () => {
    const fromString = indexFrontmatterSchema.safeParse({ date: '2026-09-20' });
    const fromDate = indexFrontmatterSchema.safeParse({ date: new Date(Date.UTC(2026, 8, 20)) });
    expect(fromString.success && fromDate.success).toBe(true);
    expect(fromString.data?.date).toEqual(fromDate.data?.date);
  });

  it('rejects unknown fields, naming the field and suggesting the right one', () => {
    const problems = problemsOf(parseIndexMd('---\ntitel: "Day 1"\n---'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Unknown field "titel"');
    expect(problems[0]).toContain('Did you mean "title"?');
    expect(problems[0]).toContain('Allowed fields: title, date, endDate, venue, cover, photographer, order, draft, hidden, sort');
  });

  it('suggests the right field for a wrongly-cased name', () => {
    expect(problemsOf(parseIndexMd('---\nenddate: 2026-09-21\n---'))[0]).toContain('Did you mean "endDate"?');
  });

  it.each([
    ['draft: yes', '"draft" must be true or false'],
    ['hidden: "true"', '"hidden" must be true or false'],
    ['venue: [a, b]', '"venue" must be text'],
    ['sort: newest', '"sort" must be either date or filename'],
    ['order: first', '"order" must be a number'],
    ['date: 20-09-2026', '"date" "20-09-2026" is not a date'],
    ['date: 2026-09-20 10:00', '"date" must be a date without a time'],
    ['title: [a, b]', '"title" must be text'],
  ])('explains invalid values: %s', (yaml, expected) => {
    expect(problemsOf(parseIndexMd(`---\n${yaml}\n---`)).join('\n')).toContain(expected);
  });

  it('checks the date range', () => {
    expect(problemsOf(parseIndexMd('---\ndate: 2026-09-20\nendDate: 2026-09-19\n---'))[0]).toContain('"endDate" is before "date"');
    expect(problemsOf(parseIndexMd('---\nendDate: 2026-09-19\n---'))[0]).toContain('"date" is missing');
  });

  it('reports invalid YAML with the line number in the file', () => {
    const problems = problemsOf(parseIndexMd('---\ntitle: "Day 1"\ndate: [2026\n---'));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatch(/^Line [34]: /);
  });

  it('reports a frontmatter that is not a list of fields, and an unclosed frontmatter', () => {
    expect(problemsOf(parseIndexMd('---\n- a\n- b\n---'))[0]).toContain('list of fields');
    expect(problemsOf(parseIndexMd('---\ntitle: x\n'))[0]).toContain('no closing ---');
  });

  it('splits frontmatter after leading blank lines', () => {
    expect(splitFrontmatter('\n\n---\na: 1\n---\nbody')).toEqual({ ok: true, value: { yaml: 'a: 1', yamlStartLine: 4, body: 'body' } });
  });
});

describe('photos.yaml', () => {
  it('parses entries keyed exactly as written', () => {
    const result = parsePhotosYaml(`
"@andi-pratama/IMG_0012.jpg":
  caption: "Opening dance by the committee 💃"
"@sari-wijaya/DSC_0441.jpg":
  caption: "Group photo"
  date: 2026-09-20
  photographer: sari-wijaya
  alt: "Group of students in batik"
  hidden: false
`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value.keys()]).toEqual(['@andi-pratama/IMG_0012.jpg', '@sari-wijaya/DSC_0441.jpg']);
    expect(result.value.get('@sari-wijaya/DSC_0441.jpg')).toEqual({
      caption: 'Group photo',
      date: { year: 2026, month: 9, day: 20, hour: 0, minute: 0, second: 0, hasTime: false },
      photographer: 'sari-wijaya',
      alt: 'Group of students in batik',
      hidden: false,
    });
  });

  it('allows a date with a time, multi-line captions, empty captions and empty entries', () => {
    const result = parsePhotosYaml('a.jpg:\n  date: 2026-09-20 18:30\n  caption: |\n    Line one\n    Line two\nb.jpg:\nc.jpg:\n  caption: ""\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.get('a.jpg')).toMatchObject({ caption: 'Line one\nLine two', date: { hour: 18, minute: 30, hasTime: true } });
    expect(result.value.get('b.jpg')).toEqual({});
    expect(result.value.get('c.jpg')).toEqual({});
  });

  it('accepts an empty file or a file with only comments', () => {
    expect(parsePhotosYaml('')).toEqual({ ok: true, value: new Map(), problems: [] });
    expect(parsePhotosYaml('# nothing yet\n')).toEqual({ ok: true, value: new Map(), problems: [] });
  });

  it('keeps valid entries when others are invalid (so a typo never un-hides a photo)', () => {
    const result = parsePhotosYaml('a.jpg:\n  captoin: x\nb.jpg:\n  hidden: true\n');
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    expect(result.value.get('b.jpg')).toEqual({ hidden: true });
    expect(result.value.has('a.jpg')).toBe(false);
  });

  it('rejects unknown fields per entry with a suggestion', () => {
    const problems = problemsOf(parsePhotosYaml('"@a/IMG_1.jpg":\n  captoin: "Hi"\n'));
    expect(problems[0]).toContain('Entry "@a/IMG_1.jpg": Unknown field "captoin". Did you mean "caption"?');
  });

  it('explains an entry written as plain text instead of fields', () => {
    expect(problemsOf(parsePhotosYaml('IMG_1.jpg: "Nice photo"\n'))[0]).toContain('caption: "Nice photo"');
  });

  it.each([
    ['hidden: "yes"', '"hidden" must be true or false'],
    ['date: tomorrow', '"date" "tomorrow" is not a date'],
    ['photographer: "!!!"', '"photographer" must be a photographer name'],
  ])('explains invalid values: %s', (field, expected) => {
    expect(problemsOf(parsePhotosYaml(`IMG_1.jpg:\n  ${field}\n`)).join('\n')).toContain(expected);
  });

  it('reports invalid YAML, including duplicate keys', () => {
    expect(problemsOf(parsePhotosYaml('a.jpg:\n  caption: "x"\na.jpg:\n  caption: "y"\n'))[0]).toContain('Map keys must be unique');
    expect(problemsOf(parsePhotosYaml('a.jpg:\n\tcaption: x\n')).length).toBeGreaterThan(0);
  });

  it('rejects a top-level list', () => {
    expect(problemsOf(parsePhotosYaml('- a.jpg\n- b.jpg\n'))[0]).toContain('must list photos by path');
  });
});

describe('photographers.yaml', () => {
  it('parses names and Instagram handles, normalising slugs', () => {
    const result = parsePhotographersYaml(`
andi-pratama:
  name: "Andi Pratama"
  instagram: "andi.pratama"
"@Sari Wijaya":
  name: "Sari Wijaya"
nameless:
`);
    expect(result).toEqual({
      ok: true,
      value: new Map([
        ['andi-pratama', { name: 'Andi Pratama', instagram: 'andi.pratama' }],
        ['sari-wijaya', { name: 'Sari Wijaya' }],
        ['nameless', {}],
      ]),
      problems: [],
    });
  });

  it('keeps valid entries when others are invalid', () => {
    const result = parsePhotographersYaml('good:\n  name: "Good"\nbad:\n  instagram: "no spaces"\n');
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    expect([...result.value.keys()]).toEqual(['good']);
  });

  it('rejects invalid handles, unknown fields and duplicate slugs', () => {
    expect(problemsOf(parsePhotographersYaml('a:\n  instagram: "not a handle!"\n'))[0]).toContain('"instagram" must be an Instagram username');
    expect(problemsOf(parsePhotographersYaml('a:\n  nmae: "A"\n'))[0]).toContain('Did you mean "name"?');
    expect(problemsOf(parsePhotographersYaml('andi:\n  name: A\n"@Andi":\n  name: B\n'))[0]).toContain('listed twice');
    expect(problemsOf(parsePhotographersYaml('andi: "Andi"\n'))[0]).toContain('name: "Full Name"');
  });
});

describe('normaliseInstagramHandle', () => {
  it.each([
    ['andi.pratama', 'andi.pratama'],
    ['@Andi.Pratama', 'andi.pratama'],
    ['  @andi_p  ', 'andi_p'],
    ['https://www.instagram.com/andi.pratama/', 'andi.pratama'],
    ['instagram.com/andi.pratama?igsh=abc', 'andi.pratama'],
    ['http://m.instagram.com/andi', 'andi'],
  ])('%j → %j', (input, handle) => {
    expect(normaliseInstagramHandle(input)).toEqual({ ok: true, handle });
  });

  it.each([['andi pratama'], ['andi-pratama'], ['a'.repeat(31)], ['https://instagram.com/'], ['']])('rejects %j', (input) => {
    expect(normaliseInstagramHandle(input).ok).toBe(false);
  });
});

describe('YAML hint for text starting with @ or a backtick', () => {
  it('photos.yaml: tells the maintainer to quote @ paths', () => {
    const result = parsePhotosYaml('@andi-pratama/IMG_0012.jpg:\n  caption: hi\n');
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      'Line 1: text that starts with @ must be put in double quotes, for example "@andi-pratama/IMG_0012.jpg":',
    ]);
  });

  it('index.md: uses an index.md example and the real line number', () => {
    expect(problemsOf(parseIndexMd('---\ntitle: x\nphotographer: @andi\n---\n'))).toEqual([
      'Line 3: text that starts with @ must be put in double quotes, for example photographer: "@andi-pratama"',
    ]);
  });

  it('photographers.yaml', () => {
    expect(parsePhotographersYaml('@andi:\n  name: Andi\n').problems[0]).toContain('for example "@andi-pratama":');
  });

  it('backticks', () => {
    expect(parsePhotosYaml('a.jpg:\n  caption: `x`\n').problems[0]).toContain('starts with ` must be put in double quotes');
  });
});
