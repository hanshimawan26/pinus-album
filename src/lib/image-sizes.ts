/**
 * Sizes of every published image derivative (TRD §7) and the matching `sizes` attributes.
 * PURE: numbers in, numbers out. `images.ts` feeds these to Astro's `getImage()`.
 *
 * The CSS layout and these numbers must agree: the `sizes` strings describe how wide each
 * image is drawn at each breakpoint, so the browser picks the smallest file that is sharp
 * enough. The breakpoints are the ones in src/styles/global.css (see DESIGN.md).
 */

/**
 * Grid thumbnails: square WebP crops of about 480 px (TRD §6.4, §7), plus a 240 px one for
 * phones, where a tile is only ~120 CSS px wide.
 */
export const THUMBNAIL_SIZE = 480;
export const THUMBNAIL_WIDTHS = [240, THUMBNAIL_SIZE] as const;

/** Viewer image widths (TRD §7). Never larger than the source. */
export const VIEWER_WIDTHS = [800, 1200, 1600, 2000] as const;

/** Preferred width of the viewer's plain `src` fallback. */
export const VIEWER_FALLBACK_WIDTH = 1200;

/** Card covers are cropped to this aspect ratio (width / height). */
export const COVER_ASPECT = 4 / 3;

/** Card cover widths. Phones draw a full-width cover (~330 CSS px) at 2–3x density. */
export const COVER_WIDTHS = [400, 600, 800, 1200] as const;

/** Layout breakpoints in CSS px; keep in step with global.css and the components. */
export const BREAKPOINTS = { sm: 600, md: 900, lg: 1100 } as const;

/** Maximum content width in CSS px (`--content-max` in global.css). */
export const CONTENT_MAX = 1120;

/**
 * Widths to generate for an image `sourceWidth` px wide, from a list of preferred widths:
 * the preferred widths smaller than the source, plus the source width itself (capped at the
 * largest preferred width) so a source between two steps keeps its full sharpness.
 * Never upscales. `[800, 1200, 1600, 2000]` for a 1500 px source → `[800, 1200, 1500]`.
 */
export function widthsFor(sourceWidth: number, preferred: readonly number[]): number[] {
  const sorted = [...preferred].sort((a, b) => a - b);
  const largest = sorted[sorted.length - 1];
  if (!(sourceWidth > 0) || largest === undefined) return [];
  const source = Math.round(sourceWidth);
  const widths = sorted.filter((width) => width < source);
  widths.push(Math.min(source, largest));
  return [...new Set(widths)];
}

/** Viewer srcset widths for a source image (TRD §7: 800/1200/1600/2000, never upscaled). */
export function viewerWidths(sourceWidth: number): number[] {
  return widthsFor(sourceWidth, VIEWER_WIDTHS);
}

/** The width used for the viewer's plain `src`: 1200 px, or the largest available below it. */
export function viewerFallbackWidth(widths: readonly number[]): number {
  const atMost = widths.filter((width) => width <= VIEWER_FALLBACK_WIDTH);
  return atMost.length > 0 ? Math.max(...atMost) : Math.min(...widths);
}

/**
 * Edge of the square thumbnail: 480 px, or the short side of a smaller source, so the
 * crop stays square without upscaling.
 */
export function thumbnailEdge(sourceWidth: number, sourceHeight: number): number {
  return Math.max(1, Math.min(THUMBNAIL_SIZE, Math.round(sourceWidth), Math.round(sourceHeight)));
}

/** Widths of the square thumbnail of a source whose crop edge is `edge` px. */
export function thumbnailWidths(edge: number): number[] {
  return widthsFor(edge, THUMBNAIL_WIDTHS);
}

/** `sizes` for grid tiles: 3 columns, 4 from 600px, 5 from 1100px (edge to edge on phones). */
export const THUMBNAIL_SIZES =
  `(min-width: ${BREAKPOINTS.lg}px) ${Math.ceil(CONTENT_MAX / 5)}px, (min-width: ${BREAKPOINTS.sm}px) 25vw, 34vw`;

/**
 * Card cover size for a source: the widths to generate and the crop height, keeping the
 * 4:3 crop inside the source (a very wide or very tall source still crops, never upscales).
 */
export function coverWidths(sourceWidth: number, sourceHeight: number): number[] {
  // The widest 4:3 crop that fits inside the source.
  const maxCropWidth = Math.min(sourceWidth, sourceHeight * COVER_ASPECT);
  return widthsFor(Math.floor(maxCropWidth), COVER_WIDTHS);
}

export const coverHeight = (width: number): number => Math.round(width / COVER_ASPECT);

/**
 * Link preview image (Open Graph `og:image`): the size WhatsApp, Telegram, Facebook and X
 * show as a large card, 1.91:1. JPEG, because not every app shows a WebP preview.
 */
export const PREVIEW_IMAGE = { width: 1200, height: 630, quality: 80 } as const;

/**
 * Size of the link preview crop of a source: 1200×630, or the largest 1.91:1 crop that fits
 * inside a smaller source (never upscaled). Both sides are at least 1 px.
 */
export function previewImageSize(sourceWidth: number, sourceHeight: number): { width: number; height: number } {
  const { width: maxWidth, height: maxHeight } = PREVIEW_IMAGE;
  const width = Math.max(1, Math.floor(Math.min(maxWidth, sourceWidth, (sourceHeight * maxWidth) / maxHeight)));
  return { width, height: Math.max(1, Math.round((width * maxHeight) / maxWidth)) };
}

/**
 * The post viewer's layout in CSS px, as PostViewer.astro draws it (keep in step):
 * - below 600 px the photo spans the full width;
 * - 600–899 px it sits in a column at most `36rem` wide;
 * - from 900 px it fills the frame minus the details panel (`--viewer-panel`). The frame is
 *   inset `clamp(16px, 3vw, 48px)` on each side and at most `100rem` wide.
 */
export const VIEWER_LAYOUT = { column: 576, panel: 340, insetVw: 3, insetMax: 48, frameMax: 1600 } as const;

/**
 * `sizes` for the viewer image (TRD §6.5, §7), so a tablet or laptop does not download a
 * file sized for the full window width. Between 900 px and the widest frame the inset is
 * `3vw`, so the photo is `94vw - 340px` wide; past the widest frame it is a fixed width.
 * A tall photo is drawn narrower than its slot (it is letterboxed by height); `sizes`
 * cannot know the photo's shape, so it describes the slot.
 */
export const VIEWER_SIZES = (() => {
  const { column, panel, insetVw, insetMax, frameMax } = VIEWER_LAYOUT;
  const widest = frameMax + 2 * insetMax;
  return [
    `(min-width: ${widest}px) ${frameMax - panel}px`,
    `(min-width: ${BREAKPOINTS.md}px) calc(${100 - 2 * insetVw}vw - ${panel}px)`,
    `(min-width: ${BREAKPOINTS.sm}px) ${column}px`,
    '100vw',
  ].join(', ');
})();

export type CardSize = 'event' | 'section';

/**
 * `sizes` for card covers. Event cards: 1 column, 2 from 600 px, 3 from 900 px.
 * Section cards: 2 columns, 3 from 900 px, 4 from 1100 px. Gutters are ignored (the
 * estimate errs on the large side, which only costs a slightly bigger file).
 */
export function coverSizes(size: CardSize): string {
  if (size === 'event') {
    return `(min-width: ${BREAKPOINTS.lg}px) ${Math.ceil(CONTENT_MAX / 3)}px, (min-width: ${BREAKPOINTS.md}px) 33vw, (min-width: ${BREAKPOINTS.sm}px) 50vw, 100vw`;
  }
  return `(min-width: ${BREAKPOINTS.lg}px) ${Math.ceil(CONTENT_MAX / 4)}px, (min-width: ${BREAKPOINTS.md}px) 33vw, 50vw`;
}

/** How an image should load, given its position on the page (TRD §6.4: lazy below the fold). */
export interface LoadingHint {
  loading: 'eager' | 'lazy';
  fetchpriority?: 'high';
}

/**
 * Longest story (in plain-text characters) that still leaves the cards or grid below it in
 * the first viewport of a 360×640 phone. Measured on the demo pages: without a story the
 * first row starts near 300 px, and a story adds about 0.65 px per character at 360 px
 * (~40 characters per 26 px line), so ~400 characters leaves the first row in view.
 * TRD §4.3 stories of "a few short paragraphs" go past this and push the grid below the fold.
 */
export const SHORT_STORY_MAX_CHARS = 400;

/** Whether content that follows a story of `storyLength` plain-text characters starts near the top. */
export function startsNearTop(storyLength: number): boolean {
  return storyLength <= SHORT_STORY_MAX_CHARS;
}

/**
 * Loading policy for the n-th image (0-based) of a grid that starts near the top of the page.
 * The first row on a phone (`highPriority` items) loads eagerly with high priority (it holds
 * the largest image in the first viewport); the rest of the widest first row loads eagerly at
 * normal priority; everything else is lazy. A grid further down the page is lazy throughout.
 */
export function loadingHint(index: number, options: { nearTop: boolean; highPriority: number; eager: number }): LoadingHint {
  if (!options.nearTop || index >= options.eager) return { loading: 'lazy' };
  return index < options.highPriority ? { loading: 'eager', fetchpriority: 'high' } : { loading: 'eager' };
}

// ---------------------------------------------------------------------------------------
// Home page landing blocks (Hero.astro, Chapter.astro, Spotlight.astro; keep in step)
// ---------------------------------------------------------------------------------------

/** Hero frame shape (width / height): portrait on phones, wider from 600 and 900 px. */
export const HERO_ASPECT = { phone: 4 / 5, sm: 16 / 10, md: 21 / 9 } as const;

/** Hero widths: the photo fills a frame up to the content width (1120 px) at 2x. */
export const HERO_WIDTHS = [800, 1200, 1600, 2000] as const;

/**
 * `sizes` for the hero photo of aspect `aspect` (width / height). The photo covers its frame
 * (`object-fit: cover`), so a photo wider than the frame is drawn wider than the frame:
 * by `aspect / frame aspect`. Phones show a portrait frame, so a landscape photo is drawn
 * about twice the screen width there.
 */
export function heroSizes(aspect: number): string {
  const drawn = (frame: number) => Math.max(1, aspect / frame);
  const vw = (frame: number) => `${Math.ceil(100 * drawn(frame))}vw`;
  const full = CONTENT_MAX + 2 * 32; // content plus the widest gutters
  return [
    `(min-width: ${full}px) ${Math.ceil(CONTENT_MAX * drawn(HERO_ASPECT.md))}px`,
    `(min-width: ${BREAKPOINTS.md}px) ${vw(HERO_ASPECT.md)}`,
    `(min-width: ${BREAKPOINTS.sm}px) ${vw(HERO_ASPECT.sm)}`,
    vw(HERO_ASPECT.phone),
  ].join(', ');
}

/**
 * `sizes` for the photos of a landing chapter, which are 4:3 cover crops drawn with
 * `object-fit: cover`. The lead photo spans 7 of 12 columns from 900 px and the full width
 * below; the others are drawn at most ~48% wide from 900 px, and as squares in two columns on
 * phones (a 4:3 crop in a square is drawn 4/3 as wide as the square: ~67vw).
 */
export function landingTileSizes(lead: boolean): string {
  if (lead) return `(min-width: ${BREAKPOINTS.lg}px) ${Math.ceil((CONTENT_MAX * 7) / 12)}px, (min-width: ${BREAKPOINTS.md}px) 58vw, 100vw`;
  return `(min-width: ${BREAKPOINTS.lg}px) ${Math.ceil((CONTENT_MAX * 5) / 12 + 80)}px, (min-width: ${BREAKPOINTS.md}px) 48vw, 67vw`;
}

/** `sizes` for the spotlight photo: 8 of 12 columns from 900 px, the full width below. */
export const SPOTLIGHT_SIZES = `(min-width: ${BREAKPOINTS.lg}px) ${Math.ceil((CONTENT_MAX * 8) / 12)}px, (min-width: ${BREAKPOINTS.md}px) 66vw, 100vw`;
