/**
 * Every internal link goes through these helpers so the site works under any
 * `base` path (TRD §5, §8). Never hard-code a leading "/" in templates.
 */

function currentBase(): string {
  const raw = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * Prefix a site-relative path with the configured base.
 * `withBase('albums/x/')` → `/pinus-album/albums/x/`. Fragments and queries are kept.
 */
export function withBase(path = '', base: string = currentBase()): string {
  const normalisedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalisedBase}${path.replace(/^\/+/, '')}`;
}

/** URL of an album node from its slug path segments, always with a trailing slash. */
export function albumUrl(segments: readonly string[], base?: string): string {
  if (segments.length === 0) return withBase('', base);
  return withBase(`albums/${segments.map(encodeURIComponent).join('/')}/`, base);
}
