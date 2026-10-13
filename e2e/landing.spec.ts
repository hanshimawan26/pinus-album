/**
 * Home page landing blocks (TRD §6.2, DESIGN.md "Landing"). Which event is featured depends
 * on the content next to the demo albums, so these tests check the structure, not names.
 */
import { expect, hashOf, horizontalOverflow, PAGES, test, viewer } from './fixtures.ts';

test('the hero features an event and links to its album', async ({ page }) => {
  await page.goto(PAGES.home);
  const hero = page.getByRole('region').filter({ has: page.locator('#hero-title') });
  await expect(hero.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(hero.locator('img')).toHaveAttribute('fetchpriority', 'high');
  const open = hero.getByRole('link', { name: 'Open album' });
  await open.click();
  await expect(page).toHaveURL(/\/pinus-album\/albums\/[^/]+\/$/);
});

test('a chapter photo opens in the viewer on its album page', async ({ page }) => {
  await page.goto(PAGES.home);
  const photo = page.locator('.mosaic a').first();
  const href = await photo.getAttribute('href');
  expect(href).toMatch(/\/albums\/.+\/#[a-z0-9-]+$/);
  await photo.click();
  await expect(viewer(page).dialog).toBeVisible();
  expect(hashOf(page)).toBe(href?.split('#')[1]);
});

test('landing photos carry their credit, and no photo is shown twice', async ({ page }) => {
  await page.goto(PAGES.home);
  const links = page.locator('.mosaic a');
  const hrefs = await links.evaluateAll((anchors) => anchors.map((a) => a.getAttribute('href')));
  expect(new Set(hrefs).size).toBe(hrefs.length);
  // A credited photo's name is part of its link text ("… Photo by Name").
  await expect(page.locator('.mosaic .credit').first()).toContainText('Photo by');
});

test('the share banner mails the committee, and the full event list follows the landing', async ({ page }) => {
  await page.goto(PAGES.home);
  const banner = page.getByRole('region', { name: 'Took photos at one of our events?' });
  await expect(banner.getByRole('link')).toHaveAttribute('href', /^mailto:[^?]+@[^?]+\?subject=/);
  await expect(page.getByRole('region', { name: 'All events' }).locator('article.card')).not.toHaveCount(0);
});

test('the home page ships no JavaScript and does not scroll sideways', async ({ page }) => {
  await page.goto(PAGES.home);
  await expect(page.locator('script[src], script[type="module"]')).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test('every landing block stays inside the page column', async ({ page }) => {
  await page.goto(PAGES.home);
  const outside = await page.evaluate(() => {
    const column = document.querySelector('.page');
    if (!column) return ['no .page column'];
    const style = getComputedStyle(column);
    const box = column.getBoundingClientRect();
    const left = box.left + parseFloat(style.paddingLeft);
    const right = box.right - parseFloat(style.paddingRight);
    return [...document.querySelectorAll('.hero, .chapter, .spotlight, .share')].flatMap((block) => {
      const rect = block.getBoundingClientRect();
      return rect.left < left - 0.5 || rect.right > right + 0.5
        ? [`${block.className}: ${Math.round(rect.left)}–${Math.round(rect.right)} outside ${Math.round(left)}–${Math.round(right)}`]
        : [];
    });
  });
  expect(outside).toEqual([]);
});
