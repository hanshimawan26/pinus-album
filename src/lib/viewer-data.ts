/**
 * The data the post viewer (milestone 4) needs for each photo of a grid, built at build
 * time and embedded in the album page as JSON. PURE.
 *
 * Absent values are left out of the object entirely (no empty strings), so the viewer can
 * skip a row with a simple presence check (TRD §6.5: no empty caption, photographer or
 * date rows).
 */
import { formatDate } from './dates.ts';
import type { Photo } from './content/types.ts';

/** A responsive viewer image (TRD §7: srcset 800/1200/1600/2000, WebP). */
export interface ViewerImage {
  src: string;
  srcset: string;
  sizes: string;
  /** Pixel size of `src`; its aspect ratio is the photo's upright aspect ratio. */
  width: number;
  height: number;
}

export interface ViewerPhotographer {
  name: string;
  /** Avatar initials, e.g. `AP`. */
  initials: string;
  /** Profile link; present only when photographers.yaml lists a handle (TRD §10). */
  instagramUrl?: string;
}

export interface ViewerPhoto {
  /** Deep-link slug (`#<slug>`), unique within the album page (TRD §4.7). */
  slug: string;
  image: ViewerImage;
  alt: string;
  caption?: string;
  photographer?: ViewerPhotographer;
  /** Display label ("20 Sep 2026") and ISO day for `<time datetime>`. */
  date?: { label: string; iso: string };
}

export interface ViewerData {
  /** Where the photos come from, e.g. "Day 1 · Demo Event A" (desktop details panel). */
  context: string;
  /** In grid order: `photos[i]` belongs to the tile with `data-index="i"`. */
  photos: ViewerPhoto[];
}

export function viewerPhoto(photo: Photo, image: ViewerImage): ViewerPhoto {
  const result: ViewerPhoto = { slug: photo.slug, image, alt: photo.alt };
  if (photo.caption) result.caption = photo.caption;
  if (photo.photographer) {
    const { name, initials, instagramUrl } = photo.photographer;
    const photographer: ViewerPhotographer = { name, initials };
    if (instagramUrl) photographer.instagramUrl = instagramUrl;
    result.photographer = photographer;
  }
  if (photo.date) result.date = { label: formatDate(photo.date), iso: photo.date.day };
  return result;
}

/** "Day 1 · Demo Event A": the node title, then its ancestors up to the event. */
export function viewerContext(titlesFromEvent: readonly string[]): string {
  return [...titlesFromEvent].reverse().join(' · ');
}
