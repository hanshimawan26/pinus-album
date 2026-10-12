import { describe, expect, it } from 'vitest';
import { addMissingEntries, keyFor, NEW_FILE_HEADER } from '../../src/lib/authoring/photos-yaml.ts';
import { matchPhotoKeys } from '../../src/lib/content/resolve.ts';
import { parsePhotosYaml } from '../../src/lib/content/schemas.ts';

const PHOTOS = ['@andi/IMG_1.jpg', '@sari/IMG_1.jpg', 'PXL_1.jpg', '@andi/IMG_2.jpg'];

function added(existing: string | undefined, photos: readonly string[] = PHOTOS) {
  const result = addMissingEntries(existing, photos);
  if (!result.ok) throw new Error(result.problem);
  return result;
}

describe('keyFor', () => {
  it('uses the path relative to the node (TRD §4.4)', () => {
    expect(keyFor('@andi/IMG_1.jpg', PHOTOS)).toBe('@andi/IMG_1.jpg');
    expect(keyFor('PXL_1.jpg', PHOTOS)).toBe('PXL_1.jpg');
  });

  it('uses ./name for a loose photo whose name is also used in a photographer folder', () => {
    const photos = ['@andi/IMG_1.jpg', 'IMG_1.jpg'];
    expect(keyFor('IMG_1.jpg', photos)).toBe('./IMG_1.jpg');
    // …and that key really matches the loose photo.
    expect(matchPhotoKeys(new Map([['./IMG_1.jpg', {}]]), photos).matched.has('IMG_1.jpg')).toBe(true);
  });
});

describe('addMissingEntries', () => {
  it('creates a file with a short explanation and one empty caption per photo, in the given order', () => {
    const result = added(undefined);
    expect(result.added).toEqual(PHOTOS);
    expect(result.text).toBe(
      `${NEW_FILE_HEADER}\n\n"@andi/IMG_1.jpg":\n  caption: ""\n\n"@sari/IMG_1.jpg":\n  caption: ""\n\n"PXL_1.jpg":\n  caption: ""\n\n"@andi/IMG_2.jpg":\n  caption: ""\n`,
    );
  });

  it('writes a file the content engine reads without problems, and blank captions change nothing', () => {
    const parsed = parsePhotosYaml(added(undefined).text);
    expect(parsed.problems).toEqual([]);
    expect([...parsed.value.values()]).toEqual(PHOTOS.map(() => ({})));
    const match = matchPhotoKeys(parsed.value, PHOTOS);
    expect([match.unmatched, match.ambiguous, match.duplicates]).toEqual([[], [], []]);
  });

  it('never changes existing text: entries, order, comments, quoting and blank lines stay byte-for-byte', () => {
    const existing = [
      '# Day 1 captions',
      '',
      "PXL_1.jpg:   # bare name, unquoted",
      "  caption: 'Sunrise'",
      '',
      '"@andi/IMG_2.jpg":',
      '  caption: |-',
      '    Two',
      '    lines',
      '  hidden: true',
      '# trailing comment',
    ].join('\n');
    const result = added(existing);
    expect(result.added).toEqual(['@andi/IMG_1.jpg', '@sari/IMG_1.jpg']);
    expect(result.text.startsWith(`${existing}\n\n`)).toBe(true);
    expect(result.text.slice(existing.length)).toBe('\n\n"@andi/IMG_1.jpg":\n  caption: ""\n\n"@sari/IMG_1.jpg":\n  caption: ""\n');
  });

  it('keeps Windows line endings (CRLF) when the file uses them', () => {
    const existing = '# Captions\r\n"PXL_1.jpg":\r\n  caption: "x"\r\n';
    const result = added(existing);
    expect(result.text.startsWith(existing)).toBe(true);
    expect(result.text.slice(existing.length)).not.toMatch(/[^\r]\n/);
    expect(parsePhotosYaml(result.text).problems).toEqual([]);
  });

  it('counts every existing key, including bare names and entries with mistakes', () => {
    const existing = 'IMG_2.jpg:\n  caption: "bare name"\n"@andi/IMG_1.jpg":\n  captoin: "typo"\n';
    expect(added(existing).added).toEqual(['@sari/IMG_1.jpg', 'PXL_1.jpg']);
  });

  it('skips the photos of an ambiguous key instead of adding a second entry for them', () => {
    const result = added('IMG_1.jpg:\n  caption: "which one?"\n');
    expect(result.added).toEqual(['PXL_1.jpg', '@andi/IMG_2.jpg']);
    expect(result.skipped).toEqual([{ key: 'IMG_1.jpg', candidates: ['@andi/IMG_1.jpg', '@sari/IMG_1.jpg'], reason: 'ambiguous' }]);
  });

  it('skips a photo whose key differs only in capitals: fixing that key later must not create a duplicate', () => {
    const result = added('"@andi/img_2.jpg":\n  caption: "Dance"\npxl_1.jpg:\n  caption: "Stage"\n');
    expect(result.added).toEqual(['@andi/IMG_1.jpg', '@sari/IMG_1.jpg']);
    expect(result.skipped).toEqual([
      { key: '@andi/img_2.jpg', candidates: ['@andi/IMG_2.jpg'], reason: 'case', suggestion: '@andi/IMG_2.jpg' },
      { key: 'pxl_1.jpg', candidates: ['PXL_1.jpg'], reason: 'case', suggestion: 'PXL_1.jpg' },
    ]);
    // Following photos:check's suggestion leaves every photo with exactly one entry.
    const fixed = result.text.replace('@andi/img_2.jpg', '@andi/IMG_2.jpg').replace('pxl_1.jpg', 'PXL_1.jpg');
    const entries = parsePhotosYaml(fixed).value;
    const match = matchPhotoKeys(entries, PHOTOS);
    expect([match.unmatched, match.duplicates, match.matched.size]).toEqual([[], [], PHOTOS.length]);
  });

  it('does not report a mis-capitalised key for a photo that already has a correct entry', () => {
    const result = added('PXL_1.jpg:\n  caption: "Stage"\npxl_1.jpg:\n  caption: "old"\n');
    expect(result.skipped).toEqual([]);
    expect(result.added).not.toContain('PXL_1.jpg');
  });

  it('is idempotent: a second run adds nothing and returns the text unchanged', () => {
    const first = added('# only a comment\n');
    expect(first.text.startsWith('# only a comment\n\n')).toBe(true);
    const second = added(first.text);
    expect(second.added).toEqual([]);
    expect(second.text).toBe(first.text);
  });

  it('treats an empty file like a new one', () => {
    expect(added('').text.startsWith(NEW_FILE_HEADER)).toBe(true);
    expect(added('  \n').text.startsWith(NEW_FILE_HEADER)).toBe(true);
  });

  it('adds nothing for a node without photos', () => {
    expect(added(undefined, [])).toEqual({ ok: true, text: '', added: [], skipped: [] });
  });

  it('refuses to touch a file with a YAML mistake, and says where it is', () => {
    const result = addMissingEntries('"@andi/IMG_1.jpg":\n  caption: "unclosed\n', PHOTOS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem).toMatch(/photos\.yaml has a mistake.*Line \d/);
  });

  it('refuses a file that is not a block list of photos', () => {
    expect(addMissingEntries('{ "PXL_1.jpg": { caption: "x" } }\n', PHOTOS).ok).toBe(false);
    expect(addMissingEntries('- just a list\n', PHOTOS).ok).toBe(false);
  });

  it('refuses when appending would change existing entries (unusual indentation)', () => {
    const result = addMissingEntries('  "PXL_1.jpg":\n    caption: "indented"\n', PHOTOS);
    expect(result.ok).toBe(false);
  });

  it('quotes keys that YAML would otherwise misread', () => {
    const result = added(undefined, ['@a/we"ird #1.jpg']);
    expect(parsePhotosYaml(result.text).value.has('@a/we"ird #1.jpg')).toBe(true);
  });
});
