/**
 * What PhotoSwipe needs to know about a photo (TRD §6.5). PURE.
 *
 * PhotoSwipe works out its zoom levels from a slide's size, so a slide has the size of the
 * largest file in its `srcset`, not of the `src` fallback: otherwise the photo could not be
 * zoomed as far as its best file allows.
 */
import type { ViewerImage, ViewerPhoto } from '../../lib/viewer-data.ts';

export interface Slide {
  src: string;
  srcset: string;
  /** Pixel size of the largest file in `srcset`. */
  width: number;
  height: number;
  alt: string;
}

/** The largest `w` descriptor of a `srcset`, or `null` when it has none. */
export function widestCandidate(srcset: string): number | null {
  const widths = srcset
    .split(',')
    .map((candidate) => /\s(\d+)w\s*$/.exec(candidate)?.[1])
    .filter((width) => width !== undefined)
    .map(Number);
  return widths.length > 0 ? Math.max(...widths) : null;
}

/** The size of an image's largest file, which keeps the image's aspect ratio. */
function largestSize(image: ViewerImage): { width: number; height: number } {
  const width = widestCandidate(image.srcset) ?? image.width;
  return { width, height: Math.round((width * image.height) / image.width) };
}

export function slideFor(photo: ViewerPhoto): Slide {
  const { src, srcset } = photo.image;
  return { src, srcset, ...largestSize(photo.image), alt: photo.alt };
}
