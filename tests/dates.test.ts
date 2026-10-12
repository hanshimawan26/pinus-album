import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import {
  compareAlbumDates,
  exifToAlbumDate,
  formatDate,
  formatDateRange,
  instantToDay,
  isDayWithin,
  isValidTimeZone,
  parseExifDateTime,
  parseUtcOffset,
  parseYamlDate,
  toAlbumDate,
  zoneOffsetMinutes,
  type LocalDateTime,
} from '../src/lib/dates.ts';

const SG = 'Asia/Singapore';
const day = (year: number, month: number, d: number): LocalDateTime => ({
  year, month, day: d, hour: 0, minute: 0, second: 0, hasTime: false,
});

describe('parseYamlDate', () => {
  it('accepts unquoted dates parsed as strings (yaml default YAML 1.2 schema)', () => {
    const value = YAML.parse('date: 2026-09-20').date;
    expect(typeof value).toBe('string');
    expect(parseYamlDate(value)).toEqual({ ok: true, value: day(2026, 9, 20) });
  });

  it('accepts dates parsed as Date objects (yaml YAML 1.1 schema)', () => {
    const value = YAML.parse('date: 2026-09-20', { schema: 'yaml-1.1' }).date;
    expect(value).toBeInstanceOf(Date);
    expect(parseYamlDate(value)).toEqual({ ok: true, value: day(2026, 9, 20) });
  });

  it('reads a Date with a time of day as a wall-clock time', () => {
    const value = YAML.parse('date: 2026-09-20 18:30:00', { schema: 'yaml-1.1' }).date;
    expect(parseYamlDate(value, { allowTime: true })).toEqual({
      ok: true,
      value: { year: 2026, month: 9, day: 20, hour: 18, minute: 30, second: 0, hasTime: true },
    });
  });

  it('accepts a time only when allowed', () => {
    expect(parseYamlDate('2026-09-20 18:30', { allowTime: true })).toMatchObject({ ok: true, value: { hour: 18, minute: 30, hasTime: true } });
    expect(parseYamlDate('2026-09-20T08:05:09', { allowTime: true })).toMatchObject({ ok: true, value: { hour: 8, minute: 5, second: 9 } });
    const rejected = parseYamlDate('2026-09-20 18:30');
    expect(rejected.ok).toBe(false);
  });

  it.each([['2026-02-30'], ['20-09-2026'], ['20 Sep 2026'], ['2026-13-01'], ['']])('rejects %j with a format hint', (input) => {
    const result = parseYamlDate(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('YYYY-MM-DD');
  });

  it('rejects non-date values', () => {
    expect(parseYamlDate(2026).ok).toBe(false);
    expect(parseYamlDate(new Date('nope')).ok).toBe(false);
    expect(parseYamlDate('2026-09-20 25:00', { allowTime: true }).ok).toBe(false);
  });
});

describe('EXIF parsing', () => {
  it('parses DateTimeOriginal', () => {
    expect(parseExifDateTime('2026:09:20 18:30:05')).toEqual({
      year: 2026, month: 9, day: 20, hour: 18, minute: 30, second: 5, hasTime: true,
    });
  });

  it.each([['0000:00:00 00:00:00'], ['    '], ['garbage'], ['2026:02:30 10:00:00'], [undefined]])('ignores %j', (input) => {
    expect(parseExifDateTime(input)).toBeUndefined();
  });

  it('parses OffsetTimeOriginal into minutes', () => {
    expect(parseUtcOffset('+08:00')).toBe(480);
    expect(parseUtcOffset('-05:30')).toBe(-330);
    expect(parseUtcOffset('+0700')).toBe(420);
    expect(parseUtcOffset('Z')).toBeUndefined();
    expect(parseUtcOffset('+15:00')).toBeUndefined();
  });
});

describe('time zones (Intl only)', () => {
  it('knows valid zone names', () => {
    expect(isValidTimeZone(SG)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });

  it('computes zone offsets, including daylight saving time', () => {
    expect(zoneOffsetMinutes(Date.UTC(2026, 8, 20), SG)).toBe(480);
    expect(zoneOffsetMinutes(Date.UTC(2026, 6, 1), 'Europe/London')).toBe(60);
    expect(zoneOffsetMinutes(Date.UTC(2026, 0, 15), 'Europe/London')).toBe(0);
  });

  it('gives the calendar day of an instant in the zone', () => {
    expect(instantToDay(Date.UTC(2026, 8, 20, 16, 30), SG)).toBe('2026-09-21');
    expect(instantToDay(Date.UTC(2026, 8, 20, 15, 59), SG)).toBe('2026-09-20');
  });
});

describe('toAlbumDate', () => {
  it('interprets EXIF wall-clock times in TIMEZONE', () => {
    const date = exifToAlbumDate('2026:09:20 23:30:00', undefined, SG);
    expect(date).toEqual({ instant: Date.UTC(2026, 8, 20, 15, 30), day: '2026-09-20', hasTime: true });
  });

  it('uses OffsetTimeOriginal for the instant and still shows the day in TIMEZONE', () => {
    // 23:30 in Jakarta (+07:00) is 00:30 the next day in Singapore.
    const date = exifToAlbumDate('2026:09:20 23:30:00', '+07:00', SG);
    expect(date).toEqual({ instant: Date.UTC(2026, 8, 20, 16, 30), day: '2026-09-21', hasTime: true });
  });

  it('ignores an unparseable offset', () => {
    expect(exifToAlbumDate('2026:09:20 10:00:00', 'bogus', SG)?.instant).toBe(Date.UTC(2026, 8, 20, 2));
  });

  it('keeps calendar dates exact, at midnight in TIMEZONE', () => {
    expect(toAlbumDate(day(2026, 9, 20), SG)).toEqual({ instant: Date.UTC(2026, 8, 19, 16), day: '2026-09-20', hasTime: false });
    expect(toAlbumDate(day(2026, 9, 20), 'America/Los_Angeles').day).toBe('2026-09-20');
  });

  it('handles daylight saving zones', () => {
    const summer = { ...day(2026, 7, 1), hour: 12, hasTime: true };
    expect(toAlbumDate(summer, 'Europe/London').instant).toBe(Date.UTC(2026, 6, 1, 11));
  });

  it('returns undefined for missing EXIF dates', () => {
    expect(exifToAlbumDate(undefined, undefined, SG)).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats a date as "20 Sep 2026" (fixed English month abbreviations)', () => {
    expect(formatDate('2026-09-20')).toBe('20 Sep 2026');
    expect(formatDate('2027-01-01')).toBe('1 Jan 2027');
    expect(formatDate(toAlbumDate(day(2026, 9, 20), SG))).toBe('20 Sep 2026');
  });

  it('formats the date in TIMEZONE, not in UTC', () => {
    expect(formatDate(exifToAlbumDate('2026:09:21 01:00:00', undefined, SG)!)).toBe('21 Sep 2026');
  });

  it.each([
    ['2026-09-20', undefined, '20 Sep 2026'],
    ['2026-09-20', '2026-09-20', '20 Sep 2026'],
    ['2026-09-20', '2026-09-23', '20–23 Sep 2026'],
    ['2026-09-30', '2026-10-02', '30 Sep – 2 Oct 2026'],
    ['2026-12-30', '2027-01-02', '30 Dec 2026 – 2 Jan 2027'],
    ['2026-09-23', '2026-09-20', '23 Sep 2026'],
  ])('range %s → %s is %j', (start, end, expected) => {
    expect(formatDateRange(start, end)).toBe(expected);
  });
});

describe('comparing', () => {
  it('sorts by instant with undefined last', () => {
    const a = toAlbumDate(day(2026, 9, 20), SG);
    const b = toAlbumDate(day(2026, 9, 21), SG);
    expect([b, undefined, a].sort(compareAlbumDates)).toEqual([a, b, undefined]);
  });

  it('checks calendar-day ranges inclusively', () => {
    expect(isDayWithin('2026-09-20', '2026-09-20', '2026-09-23')).toBe(true);
    expect(isDayWithin('2026-09-23', '2026-09-20', '2026-09-23')).toBe(true);
    expect(isDayWithin('2026-09-24', '2026-09-20', '2026-09-23')).toBe(false);
    expect(isDayWithin('2026-09-20', '2026-09-20')).toBe(true);
  });
});
