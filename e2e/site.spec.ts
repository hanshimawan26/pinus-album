/**
 * Site-wide rules on every kind of page: no horizontal scroll at 360, 768 and 1280 px
 * (TRD §6.1, §12.3), `noindex` by default and the takedown line (TRD §10), and the viewer
 * script only on pages with photos (TRD §11).
 */
import { expect, horizontalOverflow, PAGES, test } from './fixtures.ts';

const ALL_PAGES = [
  ['home', PAGES.home],
  ['event with sections', PAGES.eventWithSections],
  ['section', PAGES.section],
  ['section with photos and sub-sections', PAGES.sectionWithChildren],
  ['third level, single photo', PAGES.thirdLevel],
  ['flat event', PAGES.flatEvent],
  ['not found', PAGES.notFound],
] as const;

const WIDTHS = [360, 768, 1280] as const;

test.describe('no horizontal scroll', () => {
  // Widths are set here, so one project is enough.
  test.skip(({ isMobile }) => Boolean(isMobile), 'covered by the desktop project at every width');

  for (const width of WIDTHS) {
    for (const [name, path] of ALL_PAGES) {
      test(`${name} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await expect(page.locator('footer')).toBeVisible();
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }

  test('the open viewer at every width', async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${PAGES.section}#alice-demo-img-0005`); // the long caption
      await expect(page.locator('dialog[data-viewer]')).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      const frame = await page.locator('dialog[data-viewer] .frame').boundingBox();
      expect(frame && frame.x >= 0 && frame.x + frame.width <= width + 0.5).toBe(true);
    }
  });
});

test.describe('every page', () => {
  for (const [name, path] of ALL_PAGES) {
    test(`${name}: noindex by default, takedown line, viewer script only with photos`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');

      const footer = page.getByRole('contentinfo');
      await expect(footer).toContainText("Not comfortable with a photo? Contact");
      await expect(footer).toContainText("and we'll remove it.");
      await expect(footer.getByRole('link')).toHaveAttribute('href', /^mailto:.+@.+/);

      const hasPhotos = (await page.locator('[data-photo-grid]').count()) > 0;
      await expect(page.locator('script[src]')).toHaveCount(hasPhotos ? 1 : 0);
    });
  }
});

test('landmarks and skip link', async ({ page }) => {
  await page.goto(PAGES.section);
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
});
