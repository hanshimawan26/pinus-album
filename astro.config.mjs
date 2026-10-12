// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Site URL and base path come from the environment so the same code works as a
 * GitHub Pages project site (`/<repo>/`), a custom domain (`BASE_PATH=/`), or locally.
 * CI fills both from `actions/configure-pages` (see .github/workflows/deploy.yml).
 */
const DEFAULT_REPO = 'pinus-album';

function normaliseBase(/** @type {string} */ raw) {
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

const site = process.env.SITE_URL || 'https://example.github.io';
const base = normaliseBase(process.env.BASE_PATH ?? `/${DEFAULT_REPO}/`);

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
