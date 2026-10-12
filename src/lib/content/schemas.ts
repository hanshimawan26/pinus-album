/**
 * Schemas and parsers for the three metadata files maintainers edit (TRD §4.3–4.5):
 * `index.md` frontmatter, `photos.yaml` and `photographers.yaml`.
 *
 * PURE: text in, validated values (or plain-English problems) out. Unknown fields are
 * rejected, because a typo such as `titel:` must not be silently ignored.
 */
import YAML from 'yaml';
import { z } from 'zod';
import { parseYamlDate } from '../dates.ts';
import { photographerSlug } from '../slug.ts';
import type { IndexMeta, PhotoOverride, PhotographerEntry } from './types.ts';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; problems: string[] };

/**
 * Result for files made of independent entries (photos.yaml, photographers.yaml): valid
 * entries are kept even when others are invalid, so one typo does not silently drop the
 * rest of the file (for example a `hidden: true` further down).
 */
export interface EntriesResult<T> {
  ok: boolean;
  value: Map<string, T>;
  problems: string[];
}

// ---------------------------------------------------------------------------------------
// Field builders (shared wording)
// ---------------------------------------------------------------------------------------

/**
 * Text field. Numbers are accepted (an unquoted `title: 2026`); blank means "not set".
 * Inner line breaks are kept (multi-line captions); only the ends are trimmed.
 */
function textField(field: string) {
  return z
    .union([z.string(), z.number()], { error: `"${field}" must be text, for example ${field}: "Some text"` })
    .nullish()
    .transform((value) => {
      if (value === null || value === undefined) return undefined;
      const text = String(value).trim();
      return text === '' ? undefined : text;
    });
}

function dateField(field: string, allowTime: boolean) {
  return z
    .unknown()
    .transform((value, ctx) => {
      if (value === null || value === undefined || value === '') return undefined;
      const parsed = parseYamlDate(value, { allowTime });
      if (!parsed.ok) {
        ctx.addIssue({ code: 'custom', message: `"${field}" ${parsed.error}` });
        return z.NEVER;
      }
      return parsed.value;
    })
    .optional();
}

function booleanField(field: string) {
  return z
    .boolean({ error: `"${field}" must be true or false (without quotes)` })
    .nullish()
    .transform((value) => value ?? undefined);
}

/** A photographer slug. `@andi-pratama` and `Andi Pratama` both become `andi-pratama`. */
function photographerField(field: string) {
  return textField(field).transform((value, ctx) => {
    if (value === undefined) return undefined;
    const slug = photographerSlug(value);
    if (slug === '') {
      ctx.addIssue({
        code: 'custom',
        message: `"${field}" must be a photographer name such as andi-pratama (letters, numbers and dashes)`,
      });
      return z.NEVER;
    }
    return slug;
  });
}

// ---------------------------------------------------------------------------------------
// index.md frontmatter
// ---------------------------------------------------------------------------------------

export const INDEX_FIELDS = ['title', 'date', 'endDate', 'cover', 'photographer', 'order', 'draft', 'sort'] as const;

export const indexFrontmatterSchema = z
  .strictObject({
    title: textField('title'),
    date: dateField('date', false),
    endDate: dateField('endDate', false),
    cover: textField('cover'),
    photographer: photographerField('photographer'),
    order: z
      .number({ error: '"order" must be a number, for example order: 1' })
      .nullish()
      .transform((value) => value ?? undefined),
    draft: booleanField('draft'),
    sort: z
      .enum(['date', 'filename'], { error: '"sort" must be either date or filename' })
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && !value.date) {
      ctx.addIssue({ code: 'custom', message: '"endDate" is set but "date" is missing. Add the start date as date: YYYY-MM-DD' });
    }
    if (value.endDate && value.date) {
      const start = value.date.year * 10_000 + value.date.month * 100 + value.date.day;
      const end = value.endDate.year * 10_000 + value.endDate.month * 100 + value.endDate.day;
      if (end < start) ctx.addIssue({ code: 'custom', message: '"endDate" is before "date". Check the two dates' });
    }
  });

// ---------------------------------------------------------------------------------------
// photos.yaml
// ---------------------------------------------------------------------------------------

export const PHOTO_FIELDS = ['caption', 'date', 'photographer', 'alt', 'hidden'] as const;

export const photoOverrideSchema = z.strictObject({
  caption: textField('caption'),
  date: dateField('date', true),
  photographer: photographerField('photographer'),
  alt: textField('alt'),
  hidden: booleanField('hidden'),
});

// ---------------------------------------------------------------------------------------
// photographers.yaml
// ---------------------------------------------------------------------------------------

export const PHOTOGRAPHER_FIELDS = ['name', 'instagram'] as const;

/**
 * Normalise an Instagram handle: strips spaces, a leading `@` and profile URLs
 * (`https://www.instagram.com/andi.pratama/?hl=en` → `andi.pratama`), lowercases it, and
 * checks Instagram's character set (letters, digits, `.` and `_`, at most 30 characters).
 */
export function normaliseInstagramHandle(raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  let handle = raw.trim();
  const url = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#]*)/i.exec(handle);
  if (url) handle = url[1] ?? '';
  handle = handle.replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
    return {
      ok: false,
      error: `"instagram" must be an Instagram username such as andi.pratama (letters, numbers, dots and underscores; got "${raw}")`,
    };
  }
  return { ok: true, handle };
}

export const photographerEntrySchema = z.strictObject({
  name: textField('name'),
  instagram: textField('instagram').transform((value, ctx) => {
    if (value === undefined) return undefined;
    const normalised = normaliseInstagramHandle(value);
    if (!normalised.ok) {
      ctx.addIssue({ code: 'custom', message: normalised.error });
      return z.NEVER;
    }
    return normalised.handle;
  }),
});

// ---------------------------------------------------------------------------------------
// YAML and frontmatter plumbing
// ---------------------------------------------------------------------------------------

/**
 * Parse YAML text.
 * @param lineOffset shifts reported line numbers (frontmatter starts at line 2)
 * @param quoteExample a line of this kind of file with a quoted `@` value, for the hint on
 *   the most common mistake: in YAML, text starting with `@` (photographer folders, so most
 *   `photos.yaml` keys) or a backtick must be in quotes.
 */
export function parseYaml(text: string, lineOffset = 0, quoteExample = '"@andi-pratama/IMG_0012.jpg":'): ParseResult<unknown> {
  const doc = YAML.parseDocument(text, { prettyErrors: true, uniqueKeys: true });
  if (doc.errors.length > 0) {
    return {
      ok: false,
      problems: doc.errors.map((error) => {
        const line = error.linePos?.[0]?.line;
        const at = line === undefined ? '' : `Line ${line + lineOffset}: `;
        const message = (error.message.split('\n')[0] ?? '').replace(/ at line \d+, column \d+:?$/, '');
        const reserved = /reserved character (\S)/.exec(message)?.[1];
        if (reserved !== undefined) {
          return `${at}text that starts with ${reserved} must be put in double quotes, for example ${quoteExample}`;
        }
        const hint = /tab/i.test(message) ? ' (use spaces for indentation, not tabs)' : '';
        return `${at}${message}${hint}. Check the YAML syntax (indentation, colons and quotes).`;
      }),
    };
  }
  return { ok: true, value: doc.toJS() };
}

export interface Frontmatter {
  /** YAML text between the `---` lines; undefined when the file has no frontmatter. */
  yaml?: string;
  /** Line number of the first YAML line (for error messages). */
  yamlStartLine: number;
  body: string;
}

/** Split `index.md` into frontmatter YAML and Markdown body. */
export function splitFrontmatter(text: string): ParseResult<Frontmatter> {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  let start = 0;
  while (start < lines.length && (lines[start] ?? '').trim() === '') start++;
  if ((lines[start] ?? '').trimEnd() !== '---') {
    return { ok: true, value: { yamlStartLine: 1, body: lines.join('\n') } };
  }
  const end = lines.findIndex((line, i) => i > start && /^(---|\.\.\.)\s*$/.test(line));
  if (end === -1) {
    return {
      ok: false,
      problems: [`Line ${start + 1}: the frontmatter starts with --- but has no closing --- line. Add a line with just --- after the last field.`],
    };
  }
  return {
    ok: true,
    value: {
      yaml: lines.slice(start + 1, end).join('\n'),
      yamlStartLine: start + 2,
      body: lines.slice(end + 1).join('\n'),
    },
  };
}

/** Levenshtein distance, for "did you mean" suggestions on misspelt field names. */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

function unknownFieldMessage(key: string, allowed: readonly string[], where: string): string {
  const suggestion = allowed.find(
    (field) => field.toLowerCase() === key.toLowerCase() || editDistance(field.toLowerCase(), key.toLowerCase()) <= 2,
  );
  const didYouMean = suggestion ? ` Did you mean "${suggestion}"?` : '';
  return `${where}Unknown field "${key}".${didYouMean} Allowed fields: ${allowed.join(', ')}.`;
}

/** Turn zod issues into plain-English problems. `where(path)` prefixes entry context. */
function describeZodIssues(
  error: z.ZodError,
  allowed: readonly string[],
  where: (path: readonly PropertyKey[]) => string = () => '',
): string[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => unknownFieldMessage(key, allowed, where(issue.path)));
    }
    return [`${where(issue.path)}${issue.message.replace(/\.?$/, '.')}`];
  });
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

// ---------------------------------------------------------------------------------------
// Public parsers
// ---------------------------------------------------------------------------------------

export const DEFAULT_INDEX_META: IndexMeta = { draft: false, sort: 'date' };

/** Parse an `index.md`: validated frontmatter plus the Markdown story (raw). */
export function parseIndexMd(text: string): ParseResult<{ meta: IndexMeta; story?: string }> {
  const split = splitFrontmatter(text);
  if (!split.ok) return split;
  const { yaml, yamlStartLine, body } = split.value;
  const story = body.trim() === '' ? undefined : body.trim();
  if (yaml === undefined) return { ok: true, value: { meta: { ...DEFAULT_INDEX_META }, story } };

  const parsed = parseYaml(yaml, yamlStartLine - 1, 'photographer: "@andi-pratama"');
  if (!parsed.ok) return parsed;
  const data = parsed.value ?? {};
  if (!isPlainObject(data)) {
    return { ok: false, problems: ['The frontmatter must be a list of fields such as title: "My event", one per line.'] };
  }
  const result = indexFrontmatterSchema.safeParse(data);
  if (!result.success) return { ok: false, problems: describeZodIssues(result.error, INDEX_FIELDS) };
  const { draft, sort, ...rest } = result.data;
  const meta: IndexMeta = { draft: draft ?? false, sort: sort ?? 'date' };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) Object.assign(meta, { [key]: value });
  }
  return { ok: true, value: { meta, story } };
}

/**
 * Parse a `photos.yaml`. Returns entries keyed exactly as written (trimmed); matching keys
 * to files happens in resolve.ts. An empty file is fine.
 */
export function parsePhotosYaml(text: string): EntriesResult<PhotoOverride> {
  const parsed = parseYaml(text);
  if (!parsed.ok) return { ok: false, value: new Map(), problems: parsed.problems };
  const data = parsed.value ?? {};
  if (!isPlainObject(data)) {
    return {
      ok: false,
      value: new Map(),
      problems: ['photos.yaml must list photos by path, for example:\n  "@andi-pratama/IMG_0012.jpg":\n    caption: "Opening dance"'],
    };
  }
  const entries = new Map<string, PhotoOverride>();
  const problems: string[] = [];
  for (const [rawKey, rawValue] of Object.entries(data)) {
    const key = rawKey.trim();
    if (rawValue !== null && rawValue !== undefined && !isPlainObject(rawValue)) {
      problems.push(
        `Entry "${key}": put the fields on their own indented lines, for example:\n  "${key}":\n    caption: "${typeof rawValue === 'string' ? rawValue : 'Your caption'}"`,
      );
      continue;
    }
    const result = photoOverrideSchema.safeParse(rawValue ?? {});
    if (!result.success) {
      problems.push(...describeZodIssues(result.error, PHOTO_FIELDS, () => `Entry "${key}": `));
      continue;
    }
    const override: PhotoOverride = {};
    for (const [field, value] of Object.entries(result.data)) {
      if (value !== undefined) Object.assign(override, { [field]: value });
    }
    entries.set(key, override);
  }
  return { ok: problems.length === 0, value: entries, problems };
}

/** Parse `photographers.yaml`: slug → entry. Slugs are normalised (`@Andi` → `andi`). */
export function parsePhotographersYaml(text: string): EntriesResult<PhotographerEntry> {
  const parsed = parseYaml(text, 0, '"@andi-pratama":');
  if (!parsed.ok) return { ok: false, value: new Map(), problems: parsed.problems };
  const data = parsed.value ?? {};
  if (!isPlainObject(data)) {
    return {
      ok: false,
      value: new Map(),
      problems: ['photographers.yaml must list photographers by slug, for example:\n  andi-pratama:\n    name: "Andi Pratama"'],
    };
  }
  const registry = new Map<string, PhotographerEntry>();
  const problems: string[] = [];
  for (const [rawKey, rawValue] of Object.entries(data)) {
    const slug = photographerSlug(rawKey);
    if (slug === '') {
      problems.push(`"${rawKey}" is not a usable photographer slug. Use letters, numbers and dashes, such as andi-pratama.`);
      continue;
    }
    if (registry.has(slug)) {
      problems.push(`"${rawKey}" is listed twice (as the same slug "${slug}"). Keep one entry.`);
      continue;
    }
    if (rawValue !== null && rawValue !== undefined && !isPlainObject(rawValue)) {
      problems.push(`"${rawKey}": put the fields on their own indented lines, for example:\n  ${rawKey}:\n    name: "Full Name"`);
      continue;
    }
    const result = photographerEntrySchema.safeParse(rawValue ?? {});
    if (!result.success) {
      problems.push(...describeZodIssues(result.error, PHOTOGRAPHER_FIELDS, () => `"${rawKey}": `));
      continue;
    }
    const entry: PhotographerEntry = {};
    if (result.data.name !== undefined) entry.name = result.data.name;
    if (result.data.instagram !== undefined) entry.instagram = result.data.instagram;
    registry.set(slug, entry);
  }
  return { ok: problems.length === 0, value: registry, problems };
}
