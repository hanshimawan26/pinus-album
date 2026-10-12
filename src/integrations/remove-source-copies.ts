/**
 * Astro integration: after the build, delete every file in dist/ that is a byte-for-byte
 * copy of a source photo (TRD §7, §10: originals keep their EXIF/GPS data).
 *
 * Why it is needed: src/lib/images.ts imports every album image so it can map photos to
 * Astro images. Astro emits the original file of each imported image and, after generating
 * the WebP derivatives, deletes the originals that only served as input. Images that no
 * page transforms, such as hidden photos and drafts in a production build, are never
 * deleted by Astro, so their originals would be published.
 *
 * A copy that a page still links to would become a broken link, which `npm run verify:dist`
 * reports, so this can never silently remove something a page needs.
 */
import type { AstroIntegration } from 'astro';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlink } from 'node:fs/promises';
import { findSourceCopies, relativePosix } from '../lib/build-checks/files.ts';

export default function removeSourceCopies(options: { sourceDir: string }): AstroIntegration {
  return {
    name: 'pinus:remove-source-copies',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const copies = await findSourceCopies(distDir, resolve(options.sourceDir));
        for (const copy of copies) await unlink(copy.distFile);
        if (copies.length > 0) {
          const names = copies.map((copy) => relativePosix(distDir, copy.distFile)).join(', ');
          logger.info(`Removed ${copies.length} unpublished original photo file(s) from the build: ${names}`);
        }
      },
    },
  };
}
