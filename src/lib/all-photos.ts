/**
 * The "All photos" page of an album with sections (TRD §6.3 item 7): every published photo
 * of the node and its sections in one grid, in date order. PURE.
 *
 * Photo slugs are unique only within their own album (TRD §4.7), so on this page a photo's
 * deep link carries the path of its section: `#day-1/andi-img-0012`. Slugs never contain
 * `/`, so these links cannot collide, and the node's own photos keep their plain slug.
 */
import { compareAlbumDates } from './dates.ts';
import type { AlbumNode } from './content/types.ts';
import { ALL_PHOTOS_SLUG } from './slug.ts';
import { viewerContext, type GridPhoto } from './viewer-data.ts';

/** Whether a node has an "All photos" page: an event or section with sections and photos. */
export function hasAllPhotosPage(node: Pick<AlbumNode, 'depth' | 'children' | 'photoCount'>): boolean {
  return node.depth > 0 && node.children.length > 0 && node.photoCount > 0;
}

/** URL segments of a node's "All photos" page: `['pinus-ori', 'all']`. */
export function allPhotosPath(node: Pick<AlbumNode, 'slugPath'>): string[] {
  return [...node.slugPath, ALL_PHOTOS_SLUG];
}

/**
 * Every published photo of `node` and its sections, oldest first. Photos with the same date
 * keep the album's own order (the node's photos, then each section in display order), and
 * undated photos come last. `titles` are the titles from the event down to `node`; each
 * photo's context names its own section ("Day 2 · Pinus ORI").
 */
export function allPhotosOf(node: AlbumNode, titles: readonly string[]): GridPhoto[] {
  const photos: GridPhoto[] = [];
  const visit = (current: AlbumNode, slugs: readonly string[], currentTitles: readonly string[]) => {
    const context = viewerContext(currentTitles);
    for (const photo of current.photos) photos.push({ photo, slug: [...slugs, photo.slug].join('/'), context });
    for (const child of current.children) visit(child, [...slugs, child.slug], [...currentTitles, child.title]);
  };
  visit(node, [], titles);
  // Array sort is stable, so equal dates keep the album order.
  return photos.sort((a, b) => compareAlbumDates(a.photo.date, b.photo.date));
}
