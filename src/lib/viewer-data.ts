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
  /** Profile link; present only when photographers.yaml lists a handle (TRD §10). */
  instagramUrl?: string;
}

export interface ViewerPhoto {
  /** Deep-link slug (`#<slug>`), unique within the album page (TRD §4.7). */
  slug: string;
  /**
   * Where this photo comes from, when the grid mixes sections (the all-photos page):
   * "Day 2 · Pinus ORI". Replaces the grid's `context` for this photo.
   */
  context?: string;
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

/**
 * A photo as one grid shows it. On its own album page a photo's slug is its own (TRD §4.7);
 * the all-photos page of an event shows photos from several sections, so there the slug
 * carries the section path (`day-1/andi-img-0012`) and each photo names its own section.
 */
export interface GridPhoto {
  photo: Photo;
  slug: string;
  context?: string;
}

/** The photos of one album, as its own page shows them. */
export const gridPhotos = (photos: readonly Photo[]): GridPhoto[] => photos.map((photo) => ({ photo, slug: photo.slug }));

export function viewerPhoto(photo: Photo, image: ViewerImage, placement: Omit<GridPhoto, 'photo'> = { slug: photo.slug }): ViewerPhoto {
  const result: ViewerPhoto = { slug: placement.slug, image, alt: photo.alt };
  if (placement.context) result.context = placement.context;
  if (photo.caption) result.caption = photo.caption;
  if (photo.photographer) {
    const { name, instagramUrl } = photo.photographer;
    const photographer: ViewerPhotographer = { name };
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
