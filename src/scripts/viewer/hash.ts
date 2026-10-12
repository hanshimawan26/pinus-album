/**
 * Deep links: `#<photo-slug>` (TRD §4.7, §6.5). PURE: strings in, strings out.
 */

/**
 * The slug in a location hash (`#alice-demo-img-0001` → `alice-demo-img-0001`), or `null`
 * for an empty hash. Percent-encoding is decoded; a malformed escape is kept as written.
 */
export function slugFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Index of the photo a hash points to, or `-1` when the hash is empty or names no photo
 * on this page (an invalid hash is ignored, TRD §6.5). Slugs are lowercase (TRD §4.7), so a
 * hash typed with capitals still matches.
 *
 * A hash that names an anchor on the page (`isPageAnchor`, e.g. the skip link's `#main`) is a
 * jump to that element, never a photo, even if a photo's slug happens to be the same.
 */
export function indexForHash(hash: string, slugs: readonly string[], isPageAnchor?: (slug: string) => boolean): number {
  const slug = slugFromHash(hash);
  if (slug === null || isPageAnchor?.(slug)) return -1;
  const exact = slugs.indexOf(slug);
  return exact !== -1 ? exact : slugs.indexOf(slug.toLowerCase());
}

/** `href` with its hash removed (path and query kept). */
export function withoutHash(href: string): string {
  const at = href.indexOf('#');
  return at === -1 ? href : href.slice(0, at);
}

/** `href` with its hash replaced by `#<slug>`. Slugs are URL-safe, so no encoding is needed. */
export function withHash(href: string, slug: string): string {
  return `${withoutHash(href)}#${slug}`;
}
