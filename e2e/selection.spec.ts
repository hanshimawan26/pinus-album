/**
 * Selecting several photos and downloading them (TRD §6.4.1), on the demo content. Demo Event
 * A's Day 1 has several photographers, so it has the filter too. On the phone the share sheet
 * is replaced by a stub: a headless browser has none to open.
 */
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { crc32 } from '../src/scripts/selection/zip.ts';
import { expect, PAGES, test, tile, viewer } from './fixtures.ts';

const bar = (page: Page) => page.getByRole('group', { name: 'Selected photos' });
const label = (page: Page) => page.locator('[data-select-label]');
const check = (page: Page, index: number) => page.locator(`[data-photo-grid] > li:has(button[data-index="${index}"]) button[data-select]`);
const selectedCount = (page: Page) => page.locator('[data-photo-grid] > li.is-selected').count();

/** Names and contents of a ZIP, read from its central directory. */
function zipEntries(zip: Buffer): { name: string; data: Buffer; crc: number }[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  let at = zip.readUInt32LE(end + 16);
  return Array.from({ length: zip.readUInt16LE(end + 10) }, () => {
    const nameLength = zip.readUInt16LE(at + 28);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const size = zip.readUInt32LE(at + 24);
    const local = zip.readUInt32LE(at + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const entry = { name, crc: zip.readUInt32LE(at + 16), data: zip.subarray(start, start + size) };
    at += 46 + nameLength;
    return entry;
  });
}

test.describe('selecting with a mouse', () => {
  test.skip(({ isMobile }) => Boolean(isMobile), 'mouse only');

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.section);
    await page.waitForLoadState('domcontentloaded');
  });

  test('the circle appears on hover and starts selecting without opening the viewer', async ({ page }) => {
    await expect(check(page, 0)).toHaveCSS('opacity', '0');
    await tile(page, 0).hover();
    await expect(check(page, 0)).toHaveCSS('opacity', '1');

    await check(page, 0).click();
    await expect(viewer(page).dialog).toBeHidden();
    await expect(bar(page)).toBeVisible();
    await expect(label(page)).toHaveText('1 selected');
    await expect(check(page, 0)).toHaveAttribute('aria-pressed', 'true');
    await expect(check(page, 3)).toHaveCSS('opacity', '1');
  });

  test('while selecting, a click on a photo toggles it; ✕ ends it and photos open again', async ({ page }) => {
    await tile(page, 0).hover();
    await check(page, 0).click();
    await tile(page, 2).click();
    await expect(label(page)).toHaveText('2 selected');
    await expect(viewer(page).dialog).toBeHidden();
    await tile(page, 2).click();
    await expect(label(page)).toHaveText('1 selected');

    await bar(page).getByRole('button', { name: 'Cancel selection' }).click();
    await expect(bar(page)).toBeHidden();
    expect(await selectedCount(page)).toBe(0);
    await tile(page, 1).click();
    await expect(viewer(page).dialog).toBeVisible();
  });

  test('deselecting the last photo ends selecting, and Esc does too', async ({ page }) => {
    await tile(page, 0).hover();
    await check(page, 0).click();
    await tile(page, 0).click();
    await expect(bar(page)).toBeHidden();

    await tile(page, 1).hover();
    await check(page, 1).click();
    await page.keyboard.press('Escape');
    await expect(bar(page)).toBeHidden();
  });

  test('shift-click selects the range', async ({ page }) => {
    await tile(page, 1).hover();
    await check(page, 1).click();
    await tile(page, 4).click({ modifiers: ['Shift'] });
    await expect(label(page)).toHaveText('4 selected');
  });

  test('Select all follows the filter, and a selection survives changing it', async ({ page }) => {
    await page.getByRole('group', { name: 'Filter by photographer' }).getByRole('button', { name: /Alice/ }).click();
    const shown = await page.locator('[data-photo-grid] > li:not([hidden])').count();
    await page.locator('[data-photo-grid] > li:not([hidden])').first().hover();
    await page.locator('[data-photo-grid] > li:not([hidden]) button[data-select]').first().click();
    await bar(page).getByRole('button', { name: 'Select all' }).click();
    await expect(label(page)).toHaveText(`${shown} selected`);

    await page.getByRole('group', { name: 'Filter by photographer' }).getByRole('button', { name: /^All/ }).click();
    await expect(label(page)).toHaveText(`${shown} selected`);
    await expect(bar(page).getByRole('button', { name: 'Select all' })).toBeVisible();
  });

  test('several photos download as one ZIP of the viewer download JPEGs', async ({ page }) => {
    const names = await page.locator('#viewer-data').evaluate((script) => {
      const data = JSON.parse(script.textContent ?? '') as { archiveName: string; photos: { download: { fileName: string } }[] };
      return { archive: data.archiveName, first: data.photos[0]!.download.fileName, third: data.photos[2]!.download.fileName };
    });
    await tile(page, 2).hover();
    await check(page, 2).click();
    await tile(page, 0).click();

    const downloading = page.waitForEvent('download');
    await bar(page).getByRole('button', { name: 'Download' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(names.archive);

    const entries = zipEntries(await readFile(await download.path()));
    expect(entries.map((entry) => entry.name)).toEqual([names.first, names.third]); // grid order
    for (const entry of entries) {
      expect(entry.data.subarray(0, 2).toString('hex')).toBe('ffd8'); // a JPEG
      expect(crc32(entry.data)).toBe(entry.crc);
    }
    await expect(bar(page)).toBeHidden();
  });

  test('one photo downloads as its own JPEG', async ({ page }) => {
    const name = await page.locator('#viewer-data').evaluate((script) => (JSON.parse(script.textContent ?? '') as { photos: { download: { fileName: string } }[] }).photos[0]!.download.fileName);
    await tile(page, 0).hover();
    await check(page, 0).click();
    const downloading = page.waitForEvent('download');
    await bar(page).getByRole('button', { name: 'Download' }).click();
    expect((await downloading).suggestedFilename()).toBe(name);
  });

  test('a failed download says so and keeps the selection', async ({ page }) => {
    await tile(page, 0).hover();
    await check(page, 0).click();
    await tile(page, 1).click();
    await page.route('**/*.jpg', (route) => route.abort());
    await bar(page).getByRole('button', { name: 'Download' }).click();
    await expect(label(page)).toHaveText("Couldn't download. Try again.");
    expect(await selectedCount(page)).toBe(2);
  });

  test('right-clicking a photo keeps the normal browser behaviour', async ({ page }) => {
    await tile(page, 0).click({ button: 'right' });
    await expect(bar(page)).toBeHidden();
    await expect(viewer(page).dialog).toBeHidden();
  });
});

/** The centre of a tile on screen. */
async function centreOf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error('tile is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A real finger (Chrome DevTools Protocol): lands, holds, optionally slides, then lifts. */
async function hold(page: Page, from: Locator, options: { holdMs?: number; slideTo?: Locator } = {}): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const start = await centreOf(from);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point: { x: number; y: number }) =>
    session.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [point] });
  await touch('touchStart', start);
  await page.waitForTimeout(options.holdMs ?? 600);
  if (options.slideTo) {
    const end = await centreOf(options.slideTo);
    for (let step = 1; step <= 6; step++) {
      await touch('touchMove', { x: start.x + ((end.x - start.x) * step) / 6, y: start.y + ((end.y - start.y) * step) / 6 });
    }
    await touch('touchEnd', end);
  } else {
    await touch('touchEnd', start);
  }
  await session.detach();
}

/** A share sheet that records what it was given: a headless browser has none to open. */
const stubShareSheet = (page: Page) =>
  page.addInitScript(() => {
    const shared: string[][] = [];
    Object.assign(window, { shared });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: (data: { files: File[] }) => {
        shared.push(data.files.map((file) => `${file.name}:${file.type}`));
        return Promise.resolve();
      },
      configurable: true,
    });
  });

const sharedFiles = (page: Page): Promise<string[][]> => page.evaluate(() => (window as unknown as { shared: string[][] }).shared);

test.describe('on Android', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' });
  test.skip(({ hasTouch }) => !hasTouch, 'touch only');

  test('several photos save as separate JPEGs, never through the share sheet', async ({ page }) => {
    await stubShareSheet(page);
    await page.goto(PAGES.section);
    await page.waitForLoadState('domcontentloaded');
    const names = await page.locator('#viewer-data').evaluate((script) => {
      const { photos } = JSON.parse(script.textContent ?? '') as { photos: { download: { fileName: string } }[] };
      return [photos[0]!.download.fileName, photos[1]!.download.fileName];
    });
    const saved: string[] = [];
    page.on('download', (download) => saved.push(download.suggestedFilename()));

    await hold(page, tile(page, 0));
    await tile(page, 1).tap();
    await bar(page).getByRole('button', { name: 'Download' }).tap();

    await expect.poll(() => saved).toEqual(names);
    await expect(bar(page)).toBeHidden();
    expect(await sharedFiles(page)).toEqual([]);
  });
});

test.describe('selecting by touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch only');

  test.beforeEach(async ({ page }) => {
    await stubShareSheet(page);
    await page.goto(PAGES.section);
    await page.waitForLoadState('domcontentloaded');
  });

  test('the circles stay out of the way until selecting starts', async ({ page }) => {
    await expect(check(page, 0)).toHaveCSS('opacity', '0');
    await expect(check(page, 0)).toHaveCSS('pointer-events', 'none');
    await tile(page, 0).tap();
    await expect(viewer(page).dialog).toBeVisible();
    await expect(bar(page)).toBeHidden();
  });

  test('tap-and-hold starts selecting; taps then toggle', async ({ page }) => {
    await hold(page, tile(page, 0));
    await expect(label(page)).toHaveText('1 selected');
    await expect(viewer(page).dialog).toBeHidden();
    await tile(page, 1).tap();
    await expect(label(page)).toHaveText('2 selected');
    await expect(viewer(page).dialog).toBeHidden();
  });

  test('a short press does not select', async ({ page }) => {
    await hold(page, tile(page, 0), { holdMs: 100 });
    await expect(bar(page)).toBeHidden();
  });

  test('sliding after the hold selects the photos passed over, without scrolling', async ({ page }) => {
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await hold(page, tile(page, 0), { slideTo: tile(page, 2) });
    await expect(label(page)).toHaveText('3 selected');
    await expect(viewer(page).dialog).toBeHidden();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  test('a finger that moves before the hold is a scroll, not a selection', async ({ page }) => {
    const session = await page.context().newCDPSession(page);
    const start = await centreOf(tile(page, 0));
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - 40 }] });
    await page.waitForTimeout(600);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    await expect(bar(page)).toBeHidden();
  });

  test('an iPhone prepares the photos, then a second tap opens the share sheet', async ({ page }) => {
    await hold(page, tile(page, 0));
    await tile(page, 1).tap();
    await bar(page).getByRole('button', { name: 'Download' }).tap();

    const save = bar(page).getByRole('button', { name: 'Save 2 photos' });
    await expect(save).toBeVisible();
    await save.tap();
    await expect(bar(page)).toBeHidden();
    const shared = await sharedFiles(page);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toHaveLength(2);
    for (const file of shared[0]!) expect(file).toMatch(/\.jpg:image\/jpeg$/);
  });

  test('the bar fits a small phone without sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await hold(page, tile(page, 0));
    const box = await bar(page).boundingBox();
    expect(box?.height).toBeLessThan(70);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

test('without photos selected the bar is not shown', async ({ page }) => {
  await page.goto(PAGES.section);
  await expect(bar(page)).toBeHidden();
});
