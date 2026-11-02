/**
 * The site's image service (astro.config.mjs `image.service`): Astro's sharp service plus the
 * photographer credit. ASTRO-ONLY.
 *
 * `getImage({ …, credit: 'Andi Pratama' })` (only viewer images and the download JPEG pass
 * it, see images.ts) burns `© Andi Pratama` into the bottom-right corner and writes the name
 * to EXIF Artist and Copyright (credit/watermark.ts; the visible mark is switched off for now,
 * `WATERMARK_ENABLED`). Every other image goes through Astro's
 * sharp service unchanged. `credit` is part of the file hash, so renaming a photographer or
 * changing a photo's credit produces new files, and it travels in the dev server's image URL.
 * So is the watermark's look (`WATERMARK_STYLE`, added to every credited transform), so
 * changing it never reuses cached images that carry the old one.
 */
import type { LocalImageService } from 'astro';
import sharp from 'sharp';
import sharpService, { resolveSharpEncoderOptions } from 'astro/assets/services/sharp';
import { creditFor, WATERMARK_STYLE } from './credit/credit.ts';
import { encodeCredited, type CreditedOutput } from './credit/watermark.ts';

/** Astro's default hashed properties (assets/consts.ts DEFAULT_HASH_PROPS), plus the credit and its look. */
const HASHED_PROPERTIES = ['src', 'width', 'height', 'format', 'quality', 'fit', 'position', 'background', 'credit', 'watermark'];

const service: LocalImageService = {
  ...sharpService,
  propertiesToHash: HASHED_PROPERTIES,

  // Runs before Astro hashes the options and derives the srcset entries (which keep it).
  async validateOptions(options, imageConfig, logger) {
    const validated = sharpService.validateOptions ? await sharpService.validateOptions(options, imageConfig, logger) : options;
    return typeof validated.credit === 'string' ? { ...validated, watermark: WATERMARK_STYLE } : validated;
  },

  async getURL(options, imageConfig, logger) {
    const url = await sharpService.getURL(options, imageConfig, logger);
    return typeof options.credit === 'string' && url.includes('?') ? `${url}&credit=${encodeURIComponent(options.credit)}` : url;
  },

  parseURL(url, imageConfig, logger) {
    const transform = sharpService.parseURL(url, imageConfig, logger);
    const credit = url.searchParams.get('credit');
    // Astro's parser is synchronous; the Promise case is only in its type.
    return credit && transform && !(transform instanceof Promise) ? { ...transform, credit } : transform;
  },

  async transform(inputBuffer, transform, imageConfig, logger) {
    const credit = creditFor(typeof transform.credit === 'string' ? transform.credit : undefined);
    if (!credit) return sharpService.transform(inputBuffer, transform, imageConfig, logger);
    const format = transform.format === 'webp' ? 'webp' : transform.format === 'jpg' || transform.format === 'jpeg' ? 'jpeg' : undefined;
    if (!format || !transform.width || !transform.height || transform.fit !== 'cover') {
      throw new Error(`A credited image must be a WebP or JPEG cropped to an exact size (fit: 'cover'); got ${JSON.stringify({ format: transform.format, width: transform.width, height: transform.height, fit: transform.fit })} for "${transform.src}".`);
    }
    const config = imageConfig.service.config ?? {};
    // The same steps as Astro's sharp service for this case: upright, then cover-crop.
    const image = sharp(inputBuffer, { failOn: 'none', limitInputPixels: config.limitInputPixels })
      .rotate()
      .resize({
        width: Math.round(transform.width),
        height: Math.round(transform.height),
        fit: 'cover',
        position: transform.position,
        kernel: config.kernel,
        withoutEnlargement: true,
      });
    const options = resolveSharpEncoderOptions({ format, quality: transform.quality }, undefined, config);
    return { data: await encodeCredited(image, credit, { format, options } as CreditedOutput), format: transform.format };
  },
};

export default service;
