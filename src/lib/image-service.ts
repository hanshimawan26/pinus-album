/**
 * The site's image service (astro.config.mjs `image.service`): Astro's sharp service plus the
 * photographer credit. ASTRO-ONLY.
 *
 * `getImage({ …, credit: 'Andi Pratama' })` (only viewer images pass it, see images.ts)
 * burns `© Andi Pratama` into the bottom-right corner and writes the name to EXIF Artist and
 * Copyright (credit/watermark.ts). Every other image goes through Astro's sharp service
 * unchanged. `credit` is part of the file hash, so renaming a photographer or changing a
 * photo's credit produces new files, and it travels in the dev server's image URL.
 */
import type { LocalImageService } from 'astro';
import sharp from 'sharp';
import sharpService, { resolveSharpEncoderOptions } from 'astro/assets/services/sharp';
import { creditFor } from './credit/credit.ts';
import { encodeCredited } from './credit/watermark.ts';

/** Astro's default hashed properties (assets/consts.ts DEFAULT_HASH_PROPS), plus the credit. */
const HASHED_PROPERTIES = ['src', 'width', 'height', 'format', 'quality', 'fit', 'position', 'background', 'credit'];

const service: LocalImageService = {
  ...sharpService,
  propertiesToHash: HASHED_PROPERTIES,

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
    if (transform.format !== 'webp' || !transform.width || !transform.height || transform.fit !== 'cover') {
      throw new Error(`A credited image must be a WebP cropped to an exact size (fit: 'cover'); got ${JSON.stringify({ format: transform.format, width: transform.width, height: transform.height, fit: transform.fit })} for "${transform.src}".`);
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
    const webpOptions = resolveSharpEncoderOptions({ format: 'webp', quality: transform.quality }, undefined, config);
    return { data: await encodeCredited(image, credit, webpOptions), format: 'webp' };
  },
};

export default service;
