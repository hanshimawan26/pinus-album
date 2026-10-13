/**
 * Image pipeline (TRD §7). The one module in src/lib that depends on Astro: it maps the
 * content engine's photos to Astro's imported images and asks `astro:assets` (sharp) for
 * the published derivatives. Sizes and loading policy come from the pure `image-sizes.ts`.
 *
 * Privacy (TRD §7, §10): sharp drops EXIF/GPS from every derivative and applies the EXIF
 * orientation first, so derivatives are upright and metadata-free (viewer images of credited
 * photos then get back only EXIF Artist/Copyright, see `viewerImageFor`). Two rules keep original
 * files (which still carry EXIF/GPS) out of `dist/`:
 *
 * 1. Never read a property of an imported image (`.src`, `.width`, …) here or in a page.
 *    Astro tracks such reads and then keeps the original file in the build. Pass the
 *    imported image only to `getImage()`, and take sizes from the content engine.
 * 2. Images that no page transforms (hidden photos, drafts in a production build) are still
 *    emitted by the import below; the `remove-source-copies` integration deletes them after
 *    the build, and `npm run verify:dist` proves none is left.
 */
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import type { Photo } from './content/types.ts';
import {
  coverHeight,
  coverSizes,
  coverWidths,
  HERO_WIDTHS,
  heroSizes,
  landingTileSizes,
  PREVIEW_IMAGE,
  previewImageSize,
  thumbnailEdge,
  thumbnailWidths,
  THUMBNAIL_SIZES,
  VIEWER_SIZES,
  viewerFallbackWidth,
  viewerWidths,
  widthsFor,
  type CardSize,
} from './image-sizes.ts';
import type { ViewerImage } from './viewer-data.ts';

/**
 * Every album image, keyed by `/src/albums/…`. Bracket classes make the extensions
 * case-insensitive (cameras write `.JPG`), matching the content engine (TRD §4.2 rule 5).
 */
const sources = import.meta.glob<ImageMetadata>(
  '/src/albums/**/*.{[jJ][pP][gG],[jJ][pP][eE][gG],[pP][nN][gG],[wW][eE][bB][pP]}',
  { eager: true, import: 'default' },
);

const OUTPUT_FORMAT = 'webp';

/** The imported image for a photo. Throws a readable error if the build cannot see it. */
function sourceOf(photo: Photo): ImageMetadata {
  const source = sources[`/${photo.file}`];
  if (!source) {
    throw new Error(
      `The image "${photo.file}" was found by the content engine but not by the image pipeline. ` +
        'Check that its file extension is .jpg, .jpeg, .png or .webp.',
    );
  }
  return source;
}

/** A responsive image: `width`/`height` are the size of `src` (they set the aspect ratio). */
export interface ResponsiveImage {
  src: string;
  srcset: string;
  sizes: string;
  width: number;
  height: number;
}

/** Square grid thumbnail, about 480 px (240 px for phones), cropped from the centre (TRD §6.4, §7). */
export async function thumbnailFor(photo: Photo): Promise<ResponsiveImage> {
  const edge = thumbnailEdge(photo.width, photo.height);
  const widths = thumbnailWidths(edge);
  const image = await getImage({ src: sourceOf(photo), width: edge, height: edge, widths, fit: 'cover', format: OUTPUT_FORMAT });
  return { src: image.src, srcset: image.srcSet.attribute, sizes: THUMBNAIL_SIZES, width: edge, height: edge };
}

/**
 * Viewer image: srcset 800/1200/1600/2000 px WebP, never wider than the source (TRD §7).
 * Credited photos carry the photographer's name: a `© Name` watermark in the bottom-right
 * corner and EXIF Artist/Copyright (image-service.ts), so a saved copy keeps the credit.
 * The home page's spotlight uses the same files with its own `sizes`.
 */
export async function viewerImageFor(photo: Photo, sizes: string = VIEWER_SIZES): Promise<ViewerImage> {
  const widths = viewerWidths(photo.width);
  const width = viewerFallbackWidth(widths);
  const height = Math.round((width * photo.height) / photo.width);
  // `cover` outputs exactly the size each srcset entry claims (Astro rounds every entry's
  // height from this aspect ratio), cropping at most 1 px of rounding. `contain` would
  // fit inside that box and come out 1 px narrower than its `w` descriptor.
  const credit = photo.photographer?.name;
  const image = await getImage({ src: sourceOf(photo), width, height, widths, fit: 'cover', format: OUTPUT_FORMAT, credit });
  return { src: image.src, srcset: image.srcSet.attribute, sizes, width, height };
}

/** Card cover: a 4:3 crop with a srcset sized for event or section cards. */
export async function coverImageFor(photo: Photo, size: CardSize): Promise<ResponsiveImage> {
  return coverCrop(photo, coverSizes(size));
}

/**
 * A photo of a landing chapter: the same 4:3 crop as a card cover (so the files are shared
 * with the album cards), drawn as the chapter's lead photo or as one of the others.
 */
export async function landingTileImageFor(photo: Photo, lead: boolean): Promise<ResponsiveImage> {
  return coverCrop(photo, landingTileSizes(lead));
}

async function coverCrop(photo: Photo, sizes: string): Promise<ResponsiveImage> {
  const widths = coverWidths(photo.width, photo.height);
  const width = widths.find((candidate) => candidate >= 600) ?? widths[widths.length - 1] ?? 1;
  const height = coverHeight(width);
  const image = await getImage({ src: sourceOf(photo), width, height, widths, fit: 'cover', format: OUTPUT_FORMAT });
  return { src: image.src, srcset: image.srcSet.attribute, sizes, width, height };
}

/**
 * Hero photo of the home page: the whole photo (no crop; CSS covers the frame), up to
 * 2000 px. No watermark: the hero names the photographer in its text, like a card cover.
 */
export async function heroImageFor(photo: Photo): Promise<ResponsiveImage> {
  const widths = widthsFor(photo.width, HERO_WIDTHS);
  const width = viewerFallbackWidth(widths);
  const height = Math.round((width * photo.height) / photo.width);
  const image = await getImage({ src: sourceOf(photo), width, height, widths, fit: 'cover', format: OUTPUT_FORMAT });
  return { src: image.src, srcset: image.srcSet.attribute, sizes: heroSizes(photo.width / photo.height), width, height };
}

/** A single image file and its pixel size. */
export interface SizedImage {
  src: string;
  width: number;
  height: number;
}

/**
 * Link preview image (Open Graph) of a page whose cover is `photo`: a 1200×630 JPEG crop for
 * chat apps and social sites, with the photo's alt text. Like covers, it carries no metadata
 * and no credit. Undefined without a cover.
 */
export async function previewImageFor(photo: Photo | undefined): Promise<(SizedImage & { alt: string }) | undefined> {
  if (!photo) return undefined;
  const { width, height } = previewImageSize(photo.width, photo.height);
  const image = await getImage({ src: sourceOf(photo), width, height, fit: 'cover', format: 'jpg', quality: PREVIEW_IMAGE.quality });
  return { src: image.src, width, height, alt: photo.alt };
}
