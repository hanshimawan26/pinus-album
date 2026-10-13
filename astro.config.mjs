// @ts-check
import { defineConfig } from 'astro/config';
import removeSourceCopies from './src/integrations/remove-source-copies.ts';
import { ALBUMS_DIR, BASE_PATH, SITE_URL } from './src/lib/config.ts';

/**
 * Site URL and base path come from the environment (src/lib/config.ts) so the same code works
 * as a GitHub Pages project site (`/<repo>/`), a custom domain (`BASE_PATH=/`), or locally.
 * CI fills both from `actions/configure-pages` (see .github/workflows/deploy.yml).
 */
export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // The whole stylesheet is ~6 KB: inlining it saves a render-blocking request on phones.
    inlineStylesheets: 'always',
  },
  // Astro's sharp service plus the photographer credit on viewer images (src/lib/credit/).
  image: { service: { entrypoint: './src/lib/image-service.ts' } },
  integrations: [removeSourceCopies({ sourceDir: ALBUMS_DIR })],
});
