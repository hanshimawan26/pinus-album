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
  contactEmail: env.CONTACT_EMAIL || 'pinus.community.album@example.com',
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

/** Search indexing is off unless explicitly enabled (TRD §10). */
export const ALLOW_INDEXING = /^(1|true|yes)$/i.test(env.ALLOW_INDEXING ?? '');

/**
 * Browser UI colour (`<meta name="theme-color">`): the page background. Must equal
 * `--color-bg` in src/styles/global.css; tests/config.test.ts checks that they agree.
 */
export const THEME_COLOR = '#faf8f4';
