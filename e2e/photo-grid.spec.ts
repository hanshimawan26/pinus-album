/**
 * The justified photo grid (TRD §6.4), on the demo content: Demo Event A's Day 1 mixes portrait
 * and landscape photos, and has a photographer filter.
 */
import type { Page } from '@playwright/test';
import { expect, PAGES, test } from './fixtures.ts';

interface Box {
  left: number;
  right: number;
  top: number;
  height: number;
  aspect: number;
}

/** The grid's edges and every visible tile, with the shape of the photo it holds. */
const measure = (page: Page) =>
  page.locator('[data-photo-grid]').evaluate((grid) => {
    const { left, right } = grid.getBoundingClientRect();
    const tiles: Box[] = [...grid.querySelectorAll<HTMLElement>('li:not([hidden])')].map((item) => {
      const box = item.getBoundingClientRect();
      const image = item.querySelector('img') as HTMLImageElement;
      const aspect = Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
      return { left: box.left, right: box.right, top: box.top, height: box.height, aspect };
    });
    return { left, right, tiles };
  });

/** Every row starts at the grid's left edge and ends at its right edge, photos uncropped. */
async function expectFullRows(page: Page): Promise<void> {
  const { left, right, tiles } = await measure(page);
  expect(tiles.length).toBeGreaterThan(0);
  const rows = new Map<number, Box[]>();
  for (const tile of tiles) rows.set(Math.round(tile.top), [...(rows.get(Math.round(tile.top)) ?? []), tile]);
  for (const row of rows.values()) {
    expect(Math.abs((row[0] as Box).left - left)).toBeLessThan(1);
    expect(Math.abs((row[row.length - 1] as Box).right - right)).toBeLessThan(1);
    for (const tile of row) {
      expect(Math.abs(tile.height - (row[0] as Box).height)).toBeLessThan(1);
      const drawn = (tile.right - tile.left) / tile.height;
      expect(Math.abs(drawn / tile.aspect - 1)).toBeLessThan(0.03);
    }
  }
}

test.describe('justified photo grid', () => {
  for (const width of [360, 768, 1280]) {
    test(`every row fills the grid at ${width} px, with whole photos and no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGES.section);
      await expectFullRows(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('the rows are rebuilt when the photographer filter changes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PAGES.section);
    const before = await measure(page);
    const filter = page.getByRole('group', { name: 'Filter by photographer' });
    await filter.getByRole('button', { name: /Alice/ }).click();
    await expect.poll(async () => (await measure(page)).tiles.length).toBeLessThan(before.tiles.length);
    await expectFullRows(page);

    await filter.getByRole('button', { name: /^All/ }).click();
    await expect.poll(async () => (await measure(page)).tiles.length).toBe(before.tiles.length);
    expect((await measure(page)).tiles).toEqual(before.tiles);
  });
});
