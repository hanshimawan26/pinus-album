/**
 * Shared helpers for the end-to-end tests. Every test gets a `page` that fails the test on
 * any uncaught JavaScript error, plus helpers for the post viewer and the demo content.
 *
 * The tests use the generated demo content (TRD §12.1); real albums next to it do not
 * disturb them. Once the committee deletes the demo folders (`DEMO_EVENTS` in config.ts),
 * every test is skipped with a note (README: "Delete the demo content"), so the suite never
 * blocks real work.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEMO_EVENTS } from '../src/lib/config.ts';

export { expect };

const DEMO_PRESENT = DEMO_EVENTS.every((event) =>
  existsSync(fileURLToPath(new URL(`../src/albums/${event}/`, import.meta.url))),
);

export const test = base.extend<{ page: Page; demoContent: void }>({
  demoContent: [
    // Playwright requires the destructuring pattern even for a fixture without dependencies.
    async ({}, use, testInfo) => {
      testInfo.skip(!DEMO_PRESENT, 'the demo albums have been deleted; these tests run against the demo content');
      await use();
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors, 'uncaught JavaScript errors').toEqual([]);
  },
});

/** Demo pages, relative to the base URL (`/pinus-album/`). */
export const PAGES = {
  home: './',
  eventWithSections: 'albums/demo-event-a/',
  section: 'albums/demo-event-a/day-1/',
  sectionWithChildren: 'albums/demo-event-a/day-3/',
  thirdLevel: 'albums/demo-event-a/day-3/closing-photo/',
  flatEvent: 'albums/demo-event-b/',
  allPhotos: 'albums/demo-event-a/all/',
  notFound: 'this-page-does-not-exist/',
} as const;

/** The post viewer's parts. */
export function viewer(page: Page) {
  const dialog = page.locator('dialog[data-viewer]');
  return {
    dialog,
    credit: dialog.locator('[data-credit]'),
    nameRow: dialog.locator('[data-name-row]'),
    nameLink: dialog.locator('a[data-name-link]'),
    dateRow: dialog.locator('[data-date-row]'),
    date: dialog.locator('time[data-date]'),
    captionBlock: dialog.locator('[data-caption-block]'),
    caption: dialog.locator('[data-caption]'),
    counter: dialog.locator('[data-counter]'),
    photo: dialog.locator('[data-stage] img'),
    close: dialog.getByRole('button', { name: 'Close' }),
    next: dialog.getByRole('button', { name: 'Next photo' }),
    previous: dialog.getByRole('button', { name: 'Previous photo' }),
  };
}

/** The grid tile at `index` (display order). */
export const tile = (page: Page, index: number): Locator => page.locator(`[data-photo-grid] button[data-index="${index}"]`);

/** The URL hash without `#`. */
export const hashOf = (page: Page): string => new URL(page.url()).hash.replace(/^#/, '');

/** The URL without its hash. */
export const withoutHash = (page: Page): string => page.url().replace(/#.*$/, '');

/**
 * Opens the viewer from a tile and waits until it is shown. Waits for DOMContentLoaded first:
 * after a click navigation the page can be visible before the deferred viewer script has run.
 */
export async function openFromTile(page: Page, index: number): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await tile(page, index).click();
  await expect(viewer(page).dialog).toBeVisible();
}

/** Waits until the viewer's photo has loaded and returns its natural size. */
export async function loadedPhotoSize(page: Page): Promise<{ width: number; height: number }> {
  const photo = viewer(page).photo;
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  return photo.evaluate((image: HTMLImageElement) => ({ width: image.naturalWidth, height: image.naturalHeight }));
}

/** How far the page is wider than the window (0 when there is no horizontal scroll). */
export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/**
 * A real touch swipe (Chrome DevTools Protocol touch events, which the browser turns into
 * pointer events). `dx` < 0 swipes left (next photo).
 */
export async function swipe(page: Page, target: Locator, dx: number): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('swipe target is not visible');
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2 - dx / 2;
  const session = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', startX);
  const steps = 8;
  for (let step = 1; step <= steps; step++) await touch('touchMove', startX + (dx * step) / steps);
  await touch('touchEnd', startX + dx);
  await session.detach();
}
