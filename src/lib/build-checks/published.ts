/**
 * Does the built site publish exactly the published albums? PURE: compares what the content
 * engine says should be on the site (production: no drafts, no hidden photos) with the
 * album pages found in dist/ and the photos in their viewer data.
 *
 * This is the end-to-end proof for TRD §4.3 (`draft: true` is excluded from production) and
 * §4.4 (`hidden: true` removes a photo from the site): a draft album must have no page, and
 * a page must not list a hidden photo.
 */
import { inlineJson } from './links.ts';

/** An album the site should publish, keyed by slug path (`demo-event-a/day-1`). */
export interface ExpectedAlbum {
  path: string;
  /** Slugs of its own visible photos. */
  photoSlugs: readonly string[];
}

/** An album page found in dist/. */
export interface BuiltAlbumPage {
  path: string;
  /** Photo slugs in the page's viewer data; empty when the page has no photo grid. */
  photoSlugs: readonly string[];
}

export interface PublishedProblem {
  path: string;
  message: string;
}

/** Slug path of an album page in dist/ (`albums/demo-event-a/day-1/index.html`), or undefined. */
export function albumPathOf(distRelativeFile: string): string | undefined {
  const match = /^albums\/(.+)\/index\.html$/.exec(distRelativeFile);
  return match?.[1];
}

/** Photo slugs listed in a page's viewer data (`#viewer-data`). Throws on invalid JSON. */
export function viewerPhotoSlugs(html: string): string[] {
  for (const data of inlineJson(html)) {
    if (data && typeof data === 'object' && Array.isArray((data as { photos?: unknown }).photos)) {
      return ((data as { photos: unknown[] }).photos).map((photo) =>
        photo && typeof photo === 'object' && typeof (photo as { slug?: unknown }).slug === 'string' ? (photo as { slug: string }).slug : '',
      );
    }
  }
  return [];
}

export function comparePublished(expected: readonly ExpectedAlbum[], built: readonly BuiltAlbumPage[]): PublishedProblem[] {
  const problems: PublishedProblem[] = [];
  const builtByPath = new Map(built.map((page) => [page.path, page]));
  const expectedPaths = new Set(expected.map((album) => album.path));

  for (const album of expected) {
    const page = builtByPath.get(album.path);
    if (!page) {
      problems.push({ path: album.path, message: 'has no page in dist/, but the album is published' });
      continue;
    }
    const shown = new Set(page.photoSlugs);
    const wanted = new Set(album.photoSlugs);
    const extra = [...shown].filter((slug) => !wanted.has(slug));
    const missing = [...wanted].filter((slug) => !shown.has(slug));
    if (extra.length > 0) {
      problems.push({ path: album.path, message: `shows photos that are hidden or not in this album: ${extra.map((slug) => `#${slug}`).join(', ')}` });
    }
    if (missing.length > 0) {
      problems.push({ path: album.path, message: `is missing published photos: ${missing.map((slug) => `#${slug}`).join(', ')}` });
    }
    if (page.photoSlugs.length !== shown.size) {
      problems.push({ path: album.path, message: 'lists the same photo more than once in its viewer data' });
    }
  }
  for (const page of built) {
    if (!expectedPaths.has(page.path)) {
      problems.push({ path: page.path, message: 'has a page in dist/, but no published album has this address (a draft, or a deleted album?)' });
    }
  }
  return problems;
}
