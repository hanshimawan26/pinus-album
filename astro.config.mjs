// @ts-check
import { defineConfig } from 'astro/config';
import removeSourceCopies from './src/integrations/remove-source-copies.ts';
import { ALBUMS_DIR, BASE_PATH } from './src/lib/config.ts';

/**
 * Site URL and base path come from the environment so the same code works as a
 * GitHub Pages project site (`/<repo>/`), a custom domain (`BASE_PATH=/`), or locally.
 * CI fills both from `actions/configure-pages` (see .github/workflows/deploy.yml).
 */
const site = process.env.SITE_URL || 'https://example.github.io';

export default defineConfig({
  site,
  base: BASE_PATH,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // The whole stylesheet is ~6 KB: inlining it saves a render-blocking request on phones.
    inlineStylesheets: 'always',
  },
  integrations: [removeSourceCopies({ sourceDir: ALBUMS_DIR })],
});
