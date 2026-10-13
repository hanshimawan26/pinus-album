/**
 * The "All photos" page (TRD §6.3 item 7) and the photographer filter chips (item 8), on the
 * demo content: Demo Event A has 35 photos in its sections; its Day 1 has 13 photos, 8 by
 * Alice and 5 by Budi (tiles 0, 2, 4, 11 and 12).
 */
import type { Page } from '@playwright/test';
import { expect, hashOf, openFromTile, PAGES, test, tile, viewer } from './fixtures.ts';

const chip = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Filter by photographer' }).getByRole('button', { name });

test.describe('"All photos" page', () => {
  test('is linked from an event with sections and shows every photo, with breadcrumbs back', async ({ page }) => {
    await page.goto(PAGES.eventWithSections);
    await page.getByRole('link', { name: 'View all 35 photos' }).click();
    await expect(page).toHaveURL(/\/pinus-album\/albums\/demo-event-a\/all\/$/);
    await expect(page).toHaveTitle('All photos · Demo Event A · Pinus Community');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Demo Event A');
    await expect(page.locator('[data-photo-grid] [data-index]')).toHaveCount(35);

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('All photos');
    await breadcrumbs.getByRole('link', { name: 'Demo Event A' }).click();
    await expect(page).toHaveURL(/\/demo-event-a\/$/);
  });

  test('a section without sections has no "View all" link', async ({ page }) => {
    await page.goto(PAGES.section);
    await expect(page.getByRole('link', { name: /^View all/ })).toHaveCount(0);
  });

  test('deep links carry the section path, and the viewer names each photo\'s section', async ({ page }) => {
    await page.goto(`${PAGES.allPhotos}#day-1/alice-demo-img-0001`);
    const v = viewer(page);
    await expect(v.dialog).toBeVisible();
    await expect(v.caption).toHaveText('Demo caption: the registration desk opens.');
    await expect(v.dialog.locator('[data-context]')).toHaveText('Day 1 · Demo Event A');

    // Moving on keeps the section path in the hash.
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => hashOf(page)).toMatch(/^day-\d\/[a-z0-9-]+$/);
    await expect.poll(() => hashOf(page)).not.toBe('day-1/alice-demo-img-0001');
  });
});

test.describe('photographer filter chips', () => {
  test('show one photographer\'s photos, and the viewer moves through only those', async ({ page }) => {
    await page.goto(PAGES.section);
    const all = chip(page, /^All, 13 photos$/);
    const budi = chip(page, /^Budi \(Demo\), 5 photos$/);
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, /^Alice \(Demo\), 8 photos$/)).toBeVisible();

    await budi.click();
    await expect(budi).toHaveAttribute('aria-pressed', 'true');
    await expect(all).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-filter-status]')).toHaveText('Showing 5 photos by Budi (Demo)');
    for (const index of [0, 2, 4, 11, 12]) await expect(tile(page, index)).toBeVisible();
    for (const index of [1, 3, 5, 10]) await expect(tile(page, index)).toBeHidden();

    await openFromTile(page, 2);
    const v = viewer(page);
    await expect(v.dialog).toHaveAccessibleName('Photo 2 of 5 by Budi (Demo)');
    await expect(v.counter).toHaveText('2 / 5');
    await page.keyboard.press('ArrowRight');
    await expect(v.counter).toHaveText('3 / 5');
    await expect.poll(() => hashOf(page)).toMatch(/^budi-demo-/);
    await page.keyboard.press('End');
    await expect(v.counter).toHaveText('5 / 5');
    await expect(v.next).toBeHidden();

    // Closing returns focus to the tile of the photo shown last, which is still in the grid.
    await page.keyboard.press('Escape');
    await expect(v.dialog).toBeHidden();
    await expect(tile(page, 12)).toBeFocused();
  });

  test('pressing the chosen chip again, or "All", shows every photo again', async ({ page }) => {
    await page.goto(PAGES.section);
    await page.waitForLoadState('domcontentloaded');
    const budi = chip(page, /^Budi \(Demo\)/);
    await budi.click();
    await budi.click();
    await expect(chip(page, /^All/)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-photo-grid] li:not([hidden])')).toHaveCount(13);

    await budi.click();
    await chip(page, /^All/).click();
    await expect(page.locator('[data-photo-grid] li:not([hidden])')).toHaveCount(13);
    await openFromTile(page, 1);
    await expect(viewer(page).counter).toHaveText('2 / 13');
  });

  test('are not shown on a grid with a single photographer', async ({ page }) => {
    await page.goto(PAGES.thirdLevel);
    await expect(page.locator('[data-photo-filter]')).toHaveCount(0);
  });
});
