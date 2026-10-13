/**
 * The photographer credit burned into published viewer images. PURE.
 *
 * A saved viewer image keeps its photographer's name in two places: a small watermark in
 * the bottom-right corner (`© Name`) and the EXIF Artist and Copyright tags (nothing else:
 * no date, camera or GPS). Thumbnails and album covers carry neither: text that small
 * cannot be read, and a cover's crop would cut it off. Photos without a photographer get no
 * credit at all (absent data disappears, TRD §4.6).
 *
 * Sizes are proportional to the image's short edge, so every width in a srcset carries the
 * same-looking watermark whichever one the browser picks.
 */

export interface Credit {
  /** The photographer's display name (EXIF Artist). */
  artist: string;
  /** `© Name`: the watermark text and the EXIF Copyright tag. */
  copyright: string;
}

/** The credit for a photographer's display name; undefined when the name is blank. */
export function creditFor(name: string | undefined): Credit | undefined {
  const artist = name?.replace(/\s+/g, ' ').trim();
  return artist ? { artist, copyright: `© ${artist}` } : undefined;
}

/** Watermark font size as a share of the image's short edge (about 32 px on a 2000 × 1333 image). */
const FONT_SHARE = 0.024;
/** Smallest font size (px), so the 800 px image phones download stays readable when saved. */
const MIN_FONT_PX = 14;

export interface WatermarkLayout {
  /** Font size in pixels. */
  fontSize: number;
  /** Distance from the right and bottom edges to the text (px). */
  margin: number;
  /** Blur of the soft shadow that keeps white text readable on light photos. */
  shadowSigma: number;
  /** Transparent border around the shadow so the blur is not clipped (px). */
  shadowPad: number;
  /** The shadow sits this far below the text (px). */
  shadowOffset: number;
}

export function watermarkLayout(width: number, height: number): WatermarkLayout {
  const fontSize = Math.max(MIN_FONT_PX, Math.round(Math.min(width, height) * FONT_SHARE));
  return {
    fontSize,
    margin: Math.round(fontSize * 0.8),
    shadowSigma: Math.max(1, Math.round(fontSize * 0.12 * 10) / 10),
    shadowPad: Math.ceil(fontSize * 0.4),
    shadowOffset: Math.max(1, Math.round(fontSize * 0.05)),
  };
}

/**
 * Font size that fits a text measured `textWidth` px wide at `layout.fontSize` inside the
 * image (very long names on narrow portraits). Never larger than the layout's size.
 */
export function fittedFontSize(layout: WatermarkLayout, imageWidth: number, textWidth: number): number {
  const room = imageWidth - 2 * layout.margin;
  if (textWidth <= room || textWidth <= 0) return layout.fontSize;
  return Math.max(1, Math.floor((layout.fontSize * room) / textWidth));
}

/** Top-left corner of a `textWidth` × `textHeight` text placed in the bottom-right corner. */
export function watermarkPosition(
  layout: WatermarkLayout,
  image: { width: number; height: number },
  text: { width: number; height: number },
): { left: number; top: number } {
  return {
    left: Math.max(0, image.width - layout.margin - text.width),
    top: Math.max(0, image.height - layout.margin - text.height),
  };
}

const escapeMarkup = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Pango markup for the watermark text in one colour (`#RRGGBB`) and opacity (0–100). */
export function watermarkMarkup(text: string, colour: string, opacityPercent: number): string {
  return `<span foreground="${colour}" alpha="${Math.round(opacityPercent)}%">${escapeMarkup(text)}</span>`;
}
