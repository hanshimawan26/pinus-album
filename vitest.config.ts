import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Playwright end-to-end tests (`npm run test:e2e`) live in e2e/ and need a browser.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'node',
  },
});
