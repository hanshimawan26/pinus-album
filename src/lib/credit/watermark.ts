/**
 * Burns the photographer credit into an image (build time, sharp; no Astro): the `© Name`
 * watermark in the bottom-right corner and the EXIF Artist/Copyright tags. Sizes and text
 * come from the pure `credit.ts`.
 *
 * The text is drawn with the font in src/fonts (Inter SemiBold, SIL Open Font License), so
 * it looks the same on every machine that builds the site: white at 85 % opacity over a
 * soft dark shadow, readable on light and dark photos alike.
 */
import sharp, { type OverlayOptions, type Sharp, type WebpOptions } from 'sharp';
import { resolve } from 'node:path';
import { buildCreditTiff } from '../authoring/exif-block.ts';
import { fittedFontSize, watermarkLayout, watermarkMarkup, watermarkPosition, type Credit, type WatermarkLayout } from './credit.ts';
import { withWebpExif } from './webp-exif.ts';

/** Relative to the project root, like ALBUMS_DIR: builds, tests and scripts all run from there. */
export const WATERMARK_FONT_FILE = 'src/fonts/Inter-SemiBold.ttf';
const WATERMARK_FONT = 'Inter SemiBold';

interface RenderedText {
  data: Buffer;
  width: number;
  height: number;
}

async function renderText(text: string, fontSize: number, colour: string, opacity: number): Promise<RenderedText> {
  const { data, info } = await sharp({
    text: {
      text: watermarkMarkup(text, colour, opacity),
      font: `${WATERMARK_FONT} ${fontSize}`,
      fontfile: resolve(WATERMARK_FONT_FILE),
      rgba: true,
      dpi: 72, // 1 pt = 1 px
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** The text and its blurred shadow (with `layout.shadowPad` of room on every side). */
async function renderWatermark(text: string, layout: WatermarkLayout): Promise<{ text: RenderedText; shadow: Buffer }> {
  const rendered = await renderText(text, layout.fontSize, '#FFFFFF', 85);
  const dark = await renderText(text, layout.fontSize, '#000000', 60);
  const pad = layout.shadowPad;
  const shadow = await sharp(dark.data)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(layout.shadowSigma)
    .png()
    .toBuffer();
  return { text: rendered, shadow };
}

/** The same name at the same size is drawn once per build, not once per image. */
const watermarks = new Map<string, Promise<{ text: RenderedText; shadow: Buffer }>>();

function cachedWatermark(text: string, layout: WatermarkLayout) {
  const key = JSON.stringify([text, layout]);
  let watermark = watermarks.get(key);
  if (!watermark) {
    watermark = renderWatermark(text, layout);
    watermarks.set(key, watermark);
  }
  return watermark;
}

/** Composite layers that put `text` in the bottom-right corner of a `width` × `height` image. */
export async function watermarkOverlays(width: number, height: number, text: string): Promise<OverlayOptions[]> {
  let layout = watermarkLayout(width, height);
  let watermark = await cachedWatermark(text, layout);
  const fontSize = fittedFontSize(layout, width, watermark.text.width);
  if (fontSize !== layout.fontSize) {
    layout = { ...layout, fontSize };
    watermark = await cachedWatermark(text, layout);
  }
  const { left, top } = watermarkPosition(layout, { width, height }, watermark.text);
  const pad = layout.shadowPad;
  return [
    // Overlays must fit inside the image: crop the shadow's padding where it would stick out.
    { input: await fitShadow(watermark.shadow, left - pad, top - pad + layout.shadowOffset, width, height), left: Math.max(0, left - pad), top: Math.max(0, top - pad + layout.shadowOffset) },
    { input: watermark.text.data, left, top },
  ];
}

/** The part of the shadow image placed at (`left`, `top`) that lies inside the image. */
async function fitShadow(shadow: Buffer, left: number, top: number, width: number, height: number): Promise<Buffer> {
  const { width: shadowWidth = 0, height: shadowHeight = 0 } = await sharp(shadow).metadata();
  const cropLeft = Math.max(0, -left);
  const cropTop = Math.max(0, -top);
  const visibleWidth = Math.min(shadowWidth - cropLeft, width - Math.max(0, left));
  const visibleHeight = Math.min(shadowHeight - cropTop, height - Math.max(0, top));
  if (cropLeft === 0 && cropTop === 0 && visibleWidth === shadowWidth && visibleHeight === shadowHeight) return shadow;
  return sharp(shadow).extract({ left: cropLeft, top: cropTop, width: visibleWidth, height: visibleHeight }).png().toBuffer();
}

/**
 * Encode `image` (already rotated and resized) as WebP with the credit: the watermark in its
 * bottom-right corner and an EXIF block holding only Artist and Copyright.
 */
export async function encodeCredited(image: Sharp, credit: Credit, webpOptions: WebpOptions = {}): Promise<Uint8Array> {
  // Decode once to learn the exact output size before placing the watermark.
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const overlays = await watermarkOverlays(info.width, info.height, credit.copyright);
  const webp = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .composite(overlays)
    .webp(webpOptions)
    .toBuffer();
  return withWebpExif(webp, buildCreditTiff(credit));
}
