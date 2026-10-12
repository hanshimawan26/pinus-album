/**
 * Dates for the album (TRD §4.6). PURE: no filesystem, no Astro, no timezone library.
 *
 * Two kinds of input exist:
 * - **Calendar dates** from YAML (`2026-09-20`): a day, with no time and no zone.
 * - **Wall-clock times** from EXIF `DateTimeOriginal` (`2026:09:20 18:30:00`): no zone, so
 *   they are interpreted in the configured TIMEZONE, unless EXIF `OffsetTimeOriginal`
 *   gives the real offset.
 *
 * Both become an {@link AlbumDate}: an instant for sorting plus the calendar day in TIMEZONE
 * for display ("20 Sep 2026") and range checks. Zone maths uses `Intl` only.
 */

/** A date and optional time of day, without a zone. Months are 1-based. */
export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** False for calendar dates such as `2026-09-20`. */
  hasTime: boolean;
}

/** A resolved date: sortable and displayable. */
export interface AlbumDate {
  /** Epoch milliseconds. Calendar dates use midnight in TIMEZONE. For sorting only. */
  instant: number;
  /** Calendar day in TIMEZONE, `YYYY-MM-DD`. Used for display and range checks. */
  day: string;
  /** False when only the day is known (YAML calendar dates). */
  hasTime: boolean;
}

export type DateParseResult = { ok: true; value: LocalDateTime } | { ok: false; error: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isRealTime(hour: number, minute: number, second: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

/** True if `timeZone` is an IANA zone name this runtime knows (e.g. `Asia/Singapore`). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------

const YAML_DATE_HINT = 'Write it as YYYY-MM-DD, for example 2026-09-20';

/**
 * Parse a date value from YAML. The `yaml` package returns unquoted dates as strings with
 * its default (YAML 1.2) schema, but as `Date` objects (UTC midnight) with the YAML 1.1
 * schema; both are accepted. A `Date` with a non-midnight UTC time is read as a wall-clock
 * time, matching "values without a zone are in TIMEZONE".
 */
export function parseYamlDate(value: unknown, options: { allowTime?: boolean } = {}): DateParseResult {
  const allowTime = options.allowTime ?? false;
  const hint = allowTime ? `${YAML_DATE_HINT}, or with a time: 2026-09-20 18:30` : YAML_DATE_HINT;
  let local: LocalDateTime | undefined;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { ok: false, error: `is not a valid date. ${hint}.` };
    const hasTime =
      value.getUTCHours() + value.getUTCMinutes() + value.getUTCSeconds() + value.getUTCMilliseconds() > 0;
    local = {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      hour: value.getUTCHours(),
      minute: value.getUTCMinutes(),
      second: value.getUTCSeconds(),
      hasTime,
    };
  } else if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
    if (!match) return { ok: false, error: `"${value}" is not a date. ${hint}.` };
    const [, y, mo, d, h, mi, s] = match;
    local = {
      year: Number(y),
      month: Number(mo),
      day: Number(d),
      hour: Number(h ?? 0),
      minute: Number(mi ?? 0),
      second: Number(s ?? 0),
      hasTime: h !== undefined,
    };
  } else {
    return { ok: false, error: `must be a date. ${hint}.` };
  }

  if (!isRealCalendarDate(local.year, local.month, local.day)) {
    return { ok: false, error: `${formatLocalDate(local)} is not a real calendar date. ${hint}.` };
  }
  if (!isRealTime(local.hour, local.minute, local.second)) {
    return { ok: false, error: `has an invalid time of day. ${hint}.` };
  }
  if (local.hasTime && !allowTime) {
    return { ok: false, error: `must be a date without a time. ${hint}.` };
  }
  return { ok: true, value: local };
}

/**
 * Parse EXIF `DateTimeOriginal` (`"2026:09:20 18:30:00"`). Returns undefined for missing,
 * blank (`"0000:00:00 00:00:00"`) or malformed values.
 */
export function parseExifDateTime(raw: string | undefined): LocalDateTime | undefined {
  if (typeof raw !== 'string') return undefined;
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [
    number, number, number, number, number, number,
  ];
  if (!isRealCalendarDate(year, month, day) || !isRealTime(hour, minute, second)) return undefined;
  return { year, month, day, hour, minute, second, hasTime: true };
}

/** Parse EXIF `OffsetTimeOriginal` (`"+08:00"`) into minutes east of UTC. */
export function parseUtcOffset(raw: string | undefined): number | undefined {
  if (typeof raw !== 'string') return undefined;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(raw.trim());
  if (!match) return undefined;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  if (minutes > 14 * 60 || Number(match[3]) > 59) return undefined;
  return match[1] === '-' ? -minutes : minutes;
}

// ---------------------------------------------------------------------------------------
// Zone maths (Intl only)
// ---------------------------------------------------------------------------------------

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock parts of an instant in a zone. */
function zonedParts(instant: number, timeZone: string): LocalDateTime {
  const parts: Record<string, number> = {};
  for (const part of zoneFormatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
    hasTime: true,
  };
}

function localAsUtc(local: LocalDateTime): number {
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (Singapore: +480). */
export function zoneOffsetMinutes(instant: number, timeZone: string): number {
  const wholeSeconds = Math.floor(instant / 1000) * 1000;
  return (localAsUtc(zonedParts(wholeSeconds, timeZone)) - wholeSeconds) / 60_000;
}

/** The instant at which the wall clock in `timeZone` shows `local`. */
export function zonedTimeToInstant(local: LocalDateTime, timeZone: string): number {
  const guess = localAsUtc(local);
  const firstOffset = zoneOffsetMinutes(guess, timeZone);
  const instant = guess - firstOffset * 60_000;
  const secondOffset = zoneOffsetMinutes(instant, timeZone);
  return secondOffset === firstOffset ? instant : guess - secondOffset * 60_000;
}

/** Calendar day (`YYYY-MM-DD`) of an instant, in `timeZone`. */
export function instantToDay(instant: number, timeZone: string): string {
  return formatLocalDate(zonedParts(instant, timeZone));
}

function formatLocalDate(local: Pick<LocalDateTime, 'year' | 'month' | 'day'>): string {
  return `${pad(local.year, 4)}-${pad(local.month)}-${pad(local.day)}`;
}

// ---------------------------------------------------------------------------------------
// Building AlbumDates
// ---------------------------------------------------------------------------------------

/**
 * Turn a parsed date into an {@link AlbumDate}.
 * - Calendar dates keep their day exactly; the instant is midnight in `timeZone`.
 * - Times without an offset are wall-clock times in `timeZone`.
 * - Times with an offset (EXIF `OffsetTimeOriginal`) use it for the instant; the displayed
 *   day is still the day in `timeZone`, so the whole site uses one calendar.
 */
export function toAlbumDate(local: LocalDateTime, timeZone: string, offsetMinutes?: number): AlbumDate {
  if (!local.hasTime) {
    const midnight = { ...local, hour: 0, minute: 0, second: 0 };
    return { instant: zonedTimeToInstant(midnight, timeZone), day: formatLocalDate(local), hasTime: false };
  }
  if (offsetMinutes !== undefined) {
    const instant = localAsUtc(local) - offsetMinutes * 60_000;
    return { instant, day: instantToDay(instant, timeZone), hasTime: true };
  }
  return { instant: zonedTimeToInstant(local, timeZone), day: formatLocalDate(local), hasTime: true };
}

/** EXIF `DateTimeOriginal` (+ optional `OffsetTimeOriginal`) → AlbumDate, or undefined. */
export function exifToAlbumDate(
  dateTimeOriginal: string | undefined,
  offsetTimeOriginal: string | undefined,
  timeZone: string,
): AlbumDate | undefined {
  const local = parseExifDateTime(dateTimeOriginal);
  return local ? toAlbumDate(local, timeZone, parseUtcOffset(offsetTimeOriginal)) : undefined;
}

// ---------------------------------------------------------------------------------------
// Comparing and formatting
// ---------------------------------------------------------------------------------------

/** Ascending by instant; undefined dates sort last. */
export function compareAlbumDates(a: AlbumDate | undefined, b: AlbumDate | undefined): number {
  if (a && b) return a.instant - b.instant;
  if (a) return -1;
  if (b) return 1;
  return 0;
}

/** True when `day` lies within [start, end] (inclusive). All arguments are `YYYY-MM-DD`. */
export function isDayWithin(day: string, start: string, end: string = start): boolean {
  return day >= start && day <= end;
}

function splitDay(day: string): { year: number; month: number; day: number } {
  const [year, month, date] = day.split('-').map(Number);
  return { year: year ?? 0, month: month ?? 1, day: date ?? 1 };
}

const dayOf = (value: AlbumDate | string): string => (typeof value === 'string' ? value : value.day);

/** `"20 Sep 2026"`. Month names are fixed English abbreviations, independent of ICU data. */
export function formatDate(value: AlbumDate | string): string {
  const { year, month, day } = splitDay(dayOf(value));
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * A date or date range, compact where the parts are shared:
 * `"20 Sep 2026"`, `"20–23 Sep 2026"`, `"30 Sep – 2 Oct 2026"`, `"30 Dec 2026 – 2 Jan 2027"`.
 */
export function formatDateRange(start: AlbumDate | string, end?: AlbumDate | string): string {
  const startDay = dayOf(start);
  const endDay = end === undefined ? startDay : dayOf(end);
  if (endDay <= startDay) return formatDate(startDay);
  const a = splitDay(startDay);
  const b = splitDay(endDay);
  if (a.year !== b.year) return `${formatDate(startDay)} – ${formatDate(endDay)}`;
  if (a.month !== b.month) return `${a.day} ${MONTHS[a.month - 1]} – ${formatDate(endDay)}`;
  return `${a.day}–${formatDate(endDay)}`;
}
