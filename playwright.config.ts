import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (TRD §12.2): `npm run test:e2e`.
 *
 * Playwright builds the site with the default sub-path base (`/pinus-album/`, as on GitHub
 * Pages) and serves it with `astro preview` on a fixed port, so the tests exercise the real
 * production build. The browser is chosen by `E2E_BROWSER`, separately from the CI behaviour
 * (retries, forbidOnly, reporter): `chrome` drives the installed Google Chrome (no browser
 * download), `chromium` Playwright's bundled Chromium (`npx playwright install chromium`).
 * The default is `chromium` when `CI` is set and `chrome` otherwise.
 *
 * Not part of the deploy workflow, to keep deploys fast; see .github/workflows/e2e.yml.
 */
const PORT = Number(process.env.E2E_PORT || 4460);
const BASE_PATH = '/pinus-album/';
const BASE_URL = `http://127.0.0.1:${PORT}${BASE_PATH}`;
const E2E_BROWSER = process.env.E2E_BROWSER || (process.env.CI ? 'chromium' : 'chrome');
if (E2E_BROWSER !== 'chrome' && E2E_BROWSER !== 'chromium') {
  throw new Error(`E2E_BROWSER must be "chrome" or "chromium", not "${E2E_BROWSER}"`);
}
const browser = E2E_BROWSER === 'chrome' ? { channel: 'chrome' as const } : {};

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // A small phone held upright, with touch: the TRD's main audience (G5).
      name: 'phone',
      use: { ...devices['Desktop Chrome'], ...browser, viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...browser, viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // Always a fresh production build for the default base, never a stale or `BASE_PATH=/` dist/.
    command: `npm run build && npx astro preview --port ${PORT} --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { BASE_PATH, ALLOW_INDEXING: 'false' },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
