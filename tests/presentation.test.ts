import { describe, expect, it } from 'vitest';
import { toAlbumDate, type AlbumDate } from '../src/lib/dates.ts';
import {
  allPhotosDescription,
  countLabel,
  jsonForScript,
  markdownToPlainText,
  nodeCounts,
  nodeDateLabel,
  nodeDescription,
  nodeIsoDay,
  truncateText,
} from '../src/lib/presentation.ts';

const day = (iso: string): AlbumDate => {
  const [year, month, date] = iso.split('-').map(Number) as [number, number, number];
  return toAlbumDate({ year, month, day: date, hour: 0, minute: 0, second: 0, hasTime: false }, 'Asia/Singapore');
};

describe('countLabel', () => {
  it('uses singular and plural', () => {
    expect(countLabel(1, 'photo')).toBe('1 photo');
    expect(countLabel(0, 'photo')).toBe('0 photos');
    expect(countLabel(1500, 'photo')).toBe('1,500 photos');
    expect(countLabel(2, 'person', 'people')).toBe('2 people');
  });
});

describe('node dates', () => {
  it('formats a single day and a range', () => {
    expect(nodeDateLabel({ date: day('2026-09-20') })).toBe('20 Sep 2026');
    expect(nodeDateLabel({ date: day('2026-09-18'), endDate: day('2026-09-20') })).toBe('18–20 Sep 2026');
  });

  it('is absent without a date (no "Unknown")', () => {
    expect(nodeDateLabel({})).toBeUndefined();
    expect(nodeIsoDay({})).toBeUndefined();
  });

  it('gives an ISO day only for single-day nodes', () => {
    expect(nodeIsoDay({ date: day('2026-09-20') })).toBe('2026-09-20');
    expect(nodeIsoDay({ date: day('2026-09-20'), endDate: day('2026-09-20') })).toBe('2026-09-20');
    expect(nodeIsoDay({ date: day('2026-09-18'), endDate: day('2026-09-20') })).toBeUndefined();
  });
});

describe('nodeCounts', () => {
  it('lists photos, then sections when there are any', () => {
    expect(nodeCounts({ photoCount: 34, sectionCount: 3 })).toEqual(['34 photos', '3 sections']);
    expect(nodeCounts({ photoCount: 12, sectionCount: 0 })).toEqual(['12 photos']);
    expect(nodeCounts({ photoCount: 1, sectionCount: 1 })).toEqual(['1 photo', '1 section']);
  });

  it('is empty for an empty node', () => {
    expect(nodeCounts({ photoCount: 0, sectionCount: 0 })).toEqual([]);
  });
});

describe('markdownToPlainText', () => {
  it('removes formatting, links and HTML', () => {
    expect(markdownToPlainText('**Demo content.** See [the photos](./x) and `code`.')).toBe('Demo content. See the photos and code.');
    expect(markdownToPlainText('# Title\n\n- one\n- two\n\n> quote <b>bold</b>')).toBe('Title one two quote bold');
    expect(markdownToPlainText('![alt text](a.jpg) _italic_ ~~gone~~')).toBe('alt text italic gone');
  });

  it('keeps underscores inside words', () => {
    expect(markdownToPlainText('snake_case_name')).toBe('snake_case_name');
  });
});

describe('truncateText', () => {
  it('keeps short text', () => {
    expect(truncateText('Short.', 160)).toBe('Short.');
  });

  it('cuts at a word boundary and adds an ellipsis', () => {
    const result = truncateText('The quick brown fox jumps over the lazy dog', 20);
    expect(result).toBe('The quick brown fox…');
    expect(result.length).toBeLessThanOrEqual(20);
  });
});

describe('nodeDescription', () => {
  const node = { title: 'Day 2', photoCount: 11, sectionCount: 0 };

  it('uses the start of the story', () => {
    expect(nodeDescription({ ...node, story: '**Demo content.** Placeholder story.' })).toBe('Demo content. Placeholder story.');
  });

  it('falls back to a summary without a story', () => {
    expect(nodeDescription({ ...node, date: day('2026-09-19') })).toBe(
      '11 photos from Day 2, 19 Sep 2026. Pinus Community, Indonesian Students Association at NUS.',
    );
    expect(nodeDescription({ title: 'Empty', photoCount: 0, sectionCount: 0 })).toBe(
      'Empty. Pinus Community, Indonesian Students Association at NUS.',
    );
  });

  it('stays within 160 characters', () => {
    expect(nodeDescription({ ...node, story: 'word '.repeat(100) }).length).toBeLessThanOrEqual(160);
  });
});

describe('jsonForScript', () => {
  it('cannot end the script element and round-trips', () => {
    const value = { caption: '</script><script>alert(1)</script> & <b>' };
    const text = jsonForScript(value);
    expect(text).not.toMatch(/[<>&]/);
    expect(JSON.parse(text)).toEqual(value);
  });

  it('escapes the JavaScript line separators', () => {
    const value = { caption: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c` };
    const text = jsonForScript(value);
    expect(text).not.toContain(String.fromCharCode(0x2028));
    expect(text).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(text)).toEqual(value);
  });

  it('keeps emoji and non-Latin text intact', () => {
    const value = { caption: 'Opening dance 💃 — Tari Saman' };
    expect(JSON.parse(jsonForScript(value))).toEqual(value);
  });
});

describe('allPhotosDescription', () => {
  it('names the count, the album and its dates', () => {
    const node = { title: 'Pinus ORI', date: day('2026-08-03'), endDate: day('2026-08-06'), photoCount: 118 };
    expect(allPhotosDescription(node)).toBe('All 118 photos from Pinus ORI, 3–6 Aug 2026. Pinus Community, Indonesian Students Association at NUS.');
    expect(allPhotosDescription({ title: 'Undated', photoCount: 2 })).toMatch(/^All 2 photos from Undated\. /);
  });
});
