// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
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
  // Self-hosted variable fonts (Latin subset, SIL OFL; src/fonts/). No request leaves the site,
  // and Astro adds metric-matched fallbacks so the swap does not shift the layout. DESIGN.md.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Plus Jakarta Sans',
      cssVariable: '--font-jakarta',
      weights: ['200 800'],
      styles: ['normal', 'italic'],
      fallbacks: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Noto Sans', 'Arial', 'sans-serif'],
      options: {
        variants: [
          { src: ['./src/fonts/PlusJakartaSans-latin-wght.woff2'], weight: '200 800', style: 'normal' },
          { src: ['./src/fonts/PlusJakartaSans-latin-wght-italic.woff2'], weight: '200 800', style: 'italic' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Playfair Display',
      cssVariable: '--font-playfair',
      weights: ['400 900'],
      styles: ['normal'],
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [{ src: ['./src/fonts/PlayfairDisplay-latin-wght.woff2'], weight: '400 900', style: 'normal' }],
      },
    },
  ],
  integrations: [removeSourceCopies({ sourceDir: ALBUMS_DIR })],
});
