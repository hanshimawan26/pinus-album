/**
 * Site-wide settings. Values that a maintainer may need to change live here or in
 * environment variables, never inside page templates.
 *
 * Uses `process.env` (not `import.meta.env`) so the same module works in Astro
 * builds and in the plain Node scripts under `scripts/`.
 */

const env: Record<string, string | undefined> =
  typeof process !== 'undefined' ? process.env : {};

export const SITE = {
  name: 'Pinus Community',
  descriptor: 'Indonesian Students Association at NUS',
  /** Placeholder until the committee sets a real address (TRD §10, DECISIONS.md). */
  contactEmail: env.CONTACT_EMAIL || 'kontakpinus@gmail.com',
} as const;

/** Content folder (TRD §4.1), relative to the project root. */
export const ALBUMS_DIR = 'src/albums';

/**
 * The top-level album folders that hold the generated demo content (TRD §12.1):
 * `npm run demo:images` writes only there, photos:prep never changes files there, and the
 * demo-content and E2E tests run only against them. Exact names, not a `demo-` prefix, so a
 * real event such as `demo-day-2027` is treated like any other event.
 */
export const DEMO_EVENTS: readonly string[] = ['demo-event-a', 'demo-event-b'];

/**
 * Preview albums marked `hidden: true` in index.md (`npm run dev:hidden`). Off by
 * default, so hidden albums stay out of the site everywhere. The E2E tests turn it on to
 * build the (hidden) demo albums.
 */
export const SHOW_HIDDEN = /^(1|true|yes)$/i.test(env.SHOW_HIDDEN ?? '');

/** EXIF dates have no zone; interpret and display them in this IANA zone (TRD §4.6). */
export const TIMEZONE = env.TIMEZONE || 'Asia/Singapore';

/** Default base path: a GitHub Pages project site named after the repository (TRD §8). */
export const DEFAULT_BASE_PATH = '/pinus-album/';

/** `"pinus-album"`, `"/pinus-album"`, `"/pinus-album/"` → `"/pinus-album/"`; `""` or `"/"` → `"/"`. */
export function normaliseBasePath(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

/**
 * Base path the site is built for (`BASE_PATH`, TRD §8). Read by astro.config.mjs and by
 * `npm run verify:dist`, so both always agree. Pages use `import.meta.env.BASE_URL` via url.ts.
 */
export const BASE_PATH = normaliseBasePath(env.BASE_PATH ?? DEFAULT_BASE_PATH);

/**
 * Default website address: the GitHub Pages site of the current repository. The deploy
 * workflow passes the real address (`SITE_URL`, from the Pages configuration), so this only
 * matters for local builds. Change it when the repository moves (README: "Settings").
 */
export const DEFAULT_SITE_URL = 'https://hanshimawan26.github.io';

/** `"https://example.org/"` or `"https://example.org/x"` → `"https://example.org"`. */
export function normaliseSiteUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`SITE_URL "${raw}" is not a web address. Use the site's address, for example https://photos.example.org`);
  }
  return url.origin;
}

/**
 * The site's origin (`SITE_URL`, TRD §8), without the base path. Link previews need absolute
 * URLs (Open Graph). Read by astro.config.mjs and by `npm run verify:dist`, so both agree.
 */
export const SITE_URL = normaliseSiteUrl(env.SITE_URL || DEFAULT_SITE_URL);

/** Search indexing is off unless explicitly enabled (TRD §10). */
export const ALLOW_INDEXING = /^(1|true|yes)$/i.test(env.ALLOW_INDEXING ?? '');

/**
 * Browser UI colour (`<meta name="theme-color">`): the page background. Must equal
 * `--color-bg` in src/styles/global.css; tests/config.test.ts checks that they agree.
 */
export const THEME_COLOR = '#faf8f4';
