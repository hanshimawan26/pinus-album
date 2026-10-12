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

/** EXIF dates have no zone; interpret and display them in this IANA zone (TRD §4.6). */
export const TIMEZONE = env.TIMEZONE || 'Asia/Singapore';

/** Search indexing is off unless explicitly enabled (TRD §10). */
export const ALLOW_INDEXING = /^(1|true|yes)$/i.test(env.ALLOW_INDEXING ?? '');
