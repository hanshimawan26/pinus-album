/**
 * Internal link checking for the built site. PURE: HTML/CSS text in, references out;
 * URLs in, file paths out. `npm run verify:dist` does the file lookups.
 *
 * Catches base-path mistakes: on a project site every internal URL must start with the
 * base (`/pinus-album/`); a link to `/albums/x/` would 404 on GitHub Pages.
 */

export interface Reference {
  /** Where the URL came from: an attribute name, `json:<key>` or `css:url`. */
  source: string;
  url: string;
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', '#39': "'" };

/** Decode the HTML entities Astro writes into attribute values. */
export const decodeEntities = (value: string): string =>
  value.replace(/&(amp|quot|apos|lt|gt|#39);/g, (_, name: string) => ENTITIES[name] ?? '');

/** One `srcset` candidate: its URL and, when present, its width descriptor (`800w` → 800). */
export interface SrcsetCandidate {
  url: string;
  width?: number;
}

/** `"a.webp 800w, b.webp 2x"` → `[{ url: "a.webp", width: 800 }, { url: "b.webp" }]`. */
export function parseSrcset(srcset: string): SrcsetCandidate[] {
  return srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/))
    .filter(([url]) => url !== undefined && url.length > 0)
    .map(([url = '', descriptor = '']) => {
      const width = /^(\d+)w$/i.exec(descriptor)?.[1];
      return width === undefined ? { url } : { url, width: Number(width) };
    });
}

/** URLs of a `srcset` value: `"a.webp 800w, b.webp 1200w"` → `["a.webp", "b.webp"]`. */
export function srcsetUrls(srcset: string): string[] {
  return parseSrcset(srcset).map((candidate) => candidate.url);
}

const SCRIPT_OR_STYLE = /<(script|style)\b([^>]*)>[\s\S]*?<\/\1>/gi;
const STYLE_BODIES = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const JSON_SCRIPTS = /<script\b[^>]*\btype\s*=\s*["']?application\/(?:ld\+)?json["']?[^>]*>([\s\S]*?)<\/script>/gi;
const URL_ATTRIBUTES = /\s(href|src|srcset|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const STYLE_ATTRIBUTE = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const JSON_URL_KEYS = new Set(['href', 'src', 'srcset']);

/** The page's markup with every script and style body emptied, so only real tags remain. */
export const markupOnly = (html: string): string => html.replace(SCRIPT_OR_STYLE, '<$1$2></$1>');

/** The inline `<script type="application/json">` blocks, parsed. Throws on invalid JSON. */
export function inlineJson(html: string): unknown[] {
  return [...html.matchAll(JSON_SCRIPTS)].map((match) => JSON.parse(match[1] ?? 'null') as unknown);
}

/**
 * Every URL a page refers to: `href`, `src`, `srcset` and `poster` attributes; `url()`s in
 * inline `<style>` blocks and `style` attributes (the build inlines every stylesheet); and
 * `href`, `src` and `srcset` values inside inline JSON scripts (the viewer data).
 * Throws if an inline JSON script is not valid JSON.
 */
export function extractHtmlReferences(html: string): Reference[] {
  const references: Reference[] = [];
  // Attributes: only in markup, not inside script or style bodies.
  const markup = markupOnly(html);
  for (const match of markup.matchAll(URL_ATTRIBUTES)) {
    const attribute = (match[1] ?? '').toLowerCase();
    const value = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
    const urls = attribute === 'srcset' ? srcsetUrls(value) : [value];
    for (const url of urls) references.push({ source: attribute, url });
  }
  for (const match of html.matchAll(STYLE_BODIES)) {
    references.push(...extractCssReferences(match[1] ?? ''));
  }
  for (const match of markup.matchAll(STYLE_ATTRIBUTE)) {
    references.push(...extractCssReferences(decodeEntities(match[1] ?? match[2] ?? '')));
  }
  for (const json of inlineJson(html)) collectJsonUrls(json, references);
  return references;
}

function collectJsonUrls(value: unknown, references: Reference[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonUrls(item, references));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (JSON_URL_KEYS.has(key) && typeof item === 'string') {
        const urls = key === 'srcset' ? srcsetUrls(item) : [item];
        for (const url of urls) references.push({ source: `json:${key}`, url });
      } else {
        collectJsonUrls(item, references);
      }
    }
  }
}

/** `url(...)` references in a stylesheet. */
export function extractCssReferences(css: string): Reference[] {
  return [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)].map((match) => ({
    source: 'css:url',
    url: match[1] ?? match[2] ?? match[3] ?? '',
  }));
}

export type Resolution =
  /** External, a fragment on the same page, or a data URL: nothing to check. */
  | { kind: 'skip' }
  /** An internal URL: one of `candidates` (paths relative to dist/) must exist. */
  | { kind: 'internal'; sitePath: string; candidates: string[] }
  | { kind: 'error'; reason: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Resolve a URL found on the page served at `fromSitePath` (e.g. `/pinus-album/albums/x/`)
 * to the dist files that could serve it, for a site built with `base`.
 */
export function resolveReference(url: string, fromSitePath: string, base: string): Resolution {
  const trimmed = url.trim();
  if (trimmed === '') return { kind: 'error', reason: 'empty URL' };
  if (trimmed.startsWith('#') || SCHEME.test(trimmed) || trimmed.startsWith('//')) return { kind: 'skip' };

  let sitePath: string;
  try {
    sitePath = new URL(trimmed, `https://site.invalid${fromSitePath}`).pathname;
  } catch {
    return { kind: 'error', reason: 'not a valid URL' };
  }
  const normalisedBase = base.endsWith('/') ? base : `${base}/`;
  if (!sitePath.startsWith(normalisedBase)) {
    return { kind: 'error', reason: `points outside the site's base path "${normalisedBase}"` };
  }
  let relative: string;
  try {
    relative = decodeURIComponent(sitePath.slice(normalisedBase.length));
  } catch {
    return { kind: 'error', reason: 'badly encoded URL' };
  }
  if (relative === '' || relative.endsWith('/')) return { kind: 'internal', sitePath, candidates: [`${relative}index.html`] };
  return { kind: 'internal', sitePath, candidates: [relative, `${relative}/index.html`] };
}

/**
 * The URL path a dist HTML file is served at: `albums/x/index.html` → `<base>albums/x/`,
 * `404.html` → `<base>404.html`.
 */
export function sitePathOf(distRelativeFile: string, base: string): string {
  const normalisedBase = base.endsWith('/') ? base : `${base}/`;
  const path = distRelativeFile.replace(/(^|\/)index\.html$/, '$1');
  return `${normalisedBase}${path}`;
}
