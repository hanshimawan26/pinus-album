/** Home, album pages and breadcrumbs (TRD §6.2, §6.3, acceptance checklist §12.3). */
import type { Locator, Page } from '@playwright/test';
import { expect, PAGES, test } from './fixtures.ts';

test('home lists every event with cover, title, date and photo count, newest first', async ({ page }) => {
  await page.goto(PAGES.home);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo albums');
  const cards = page.locator('article.card');
  // Card titles without their status badge (the demo albums are hidden, built with SHOW_HIDDEN).
  const titles = await cards.locator('.title .link').allTextContents();
  // Demo Event A (Sep 2026) is newer than Demo Event B (Aug 2026). Real events may sit around them.
  expect(titles.indexOf('Demo Event A')).toBeGreaterThanOrEqual(0);
  expect(titles.indexOf('Demo Event A')).toBeLessThan(titles.indexOf('Demo Event B'));

  const eventA = cards.filter({ has: page.getByRole('heading', { name: 'Demo Event A' }) });
  await expect(eventA).toContainText('18–20 Sep 2026');
  await expect(eventA).toContainText('35 photos');
  await expect(eventA).toContainText('3 sections');
  const eventB = cards.filter({ has: page.getByRole('heading', { name: 'Demo Event B' }) });
  await expect(eventB).toContainText('15 Aug 2026');
  await expect(eventB).toContainText('12 photos');
  await expect(eventB).not.toContainText('section');
  for (const card of [eventA, eventB]) await expect(card.locator('.cover img')).toHaveCount(1);
});

/** A real mouse click at the centre of `target`, wherever the browser routes it (no actionability checks). */
async function clickCentreOf(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('the element is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('the whole card is one link: its cover, title and meta line all open the album', async ({ page }) => {
  const cardOf = (title: string) => page.locator('article.card').filter({ has: page.getByRole('heading', { name: title }) });
  for (const part of ['.cover', '.title', '.meta']) {
    await page.goto(PAGES.home);
    await clickCentreOf(page, cardOf('Demo Event A').locator(part));
    await expect(page, `a click on the card's ${part}`).toHaveURL(/\/pinus-album\/albums\/demo-event-a\/$/);
  }
  await page.goto(PAGES.eventWithSections);
  await clickCentreOf(page, cardOf('Day 1').locator('.meta'));
  await expect(page).toHaveURL(/\/pinus-album\/albums\/demo-event-a\/day-1\/$/);
});

test('an event with sections shows section cards, and drafts are not published', async ({ page }) => {
  await page.goto(PAGES.eventWithSections);
  const sections = page.getByRole('region', { name: 'Sections' });
  const titles = sections.locator('article.card').getByRole('heading');
  await expect(titles).toHaveText(['Day 1', 'Day 2', 'Day 3']);
  await expect(page.getByText(/draft/i)).toHaveCount(0);
});

const DEMO_VENUE = 'Demo Venue, Auditorium Hall 2, University Town Campus';

test('the venue shows on the album page only, and wraps without being cut off', async ({ page }) => {
  await page.goto(PAGES.eventWithSections);
  const meta = page.locator('.album-header .meta');
  const venue = meta.getByText(DEMO_VENUE, { exact: true });
  await expect(venue).toBeVisible();
  // Every line of the venue starts inside the visible part of the meta line (after its dot),
  // also when the venue wraps on a phone.
  const { lineLefts, visibleLeft } = await venue.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const meta = element.closest('.meta')!;
    const separator = parseFloat(getComputedStyle(meta).getPropertyValue('--meta-separator')) * parseFloat(getComputedStyle(meta).fontSize);
    return {
      lineLefts: [...range.getClientRects()].map((rect) => rect.left),
      visibleLeft: meta.getBoundingClientRect().left + separator,
    };
  });
  for (const left of lineLefts) expect(left).toBeGreaterThanOrEqual(visibleLeft - 0.5);

  await page.goto(PAGES.home);
  await expect(page.getByText(DEMO_VENUE)).toHaveCount(0);
});

test('hidden albums carry a readable "Hidden" badge when previewed (SHOW_HIDDEN)', async ({ page }) => {
  await page.goto(PAGES.eventWithSections);
  await expect(page.getByRole('heading', { level: 1, name: 'Demo Event A Hidden', exact: true })).toBeVisible();
  await page.goto(PAGES.home);
  await expect(page.getByRole('heading', { name: 'Demo Event A Hidden', exact: true })).toBeVisible();
});

test('breadcrumbs work at every level', async ({ page }) => {
  await page.goto(PAGES.thirdLevel);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('listitem')).toHaveText(['Home', 'Demo Event A', 'Day 3', /^Closing night/]);
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText(/^Closing night/);

  await crumbs.getByRole('link', { name: 'Day 3' }).click();
  await expect(page).toHaveURL(/\/pinus-album\/albums\/demo-event-a\/day-3\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Day 3');
  await expect(page.locator('[data-photo-grid] button')).not.toHaveCount(0);

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Demo Event A' }).click();
  await expect(page).toHaveURL(/\/pinus-album\/albums\/demo-event-a\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Demo Event A(?: Hidden)?$/);

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/pinus-album\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo albums');
});

test('sibling navigation moves between sections', async ({ page }) => {
  await page.goto('albums/demo-event-a/day-2/');
  await page.getByRole('link', { name: /Next section: Day 3/ }).click();
  await expect(page).toHaveURL(/\/day-3\/$/);
  await page.getByRole('link', { name: /Previous section: Day 2/ }).click();
  await expect(page).toHaveURL(/\/day-2\/$/);
});

test('an unknown address shows the not-found page with a way home', async ({ page }) => {
  const response = await page.goto(PAGES.notFound);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await page.getByRole('link', { name: 'See all photo albums' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo albums');
});
