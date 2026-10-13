/**
 * The post viewer (TRD §6.5, acceptance checklist §12.3), on the demo content:
 * Demo Event A › Day 1 has 13 photos, Demo Event B has the photos with missing data.
 */
import type { Locator } from '@playwright/test';
import { expect, hashOf, loadedPhotoSize, openFromTile, PAGES, swipe, test, tile, viewer, withoutHash } from './fixtures.ts';

test.describe('opening a photo', () => {
  test('from the home page, through the album, to a photo with photographer, date and caption', async ({ page }) => {
    await page.goto(PAGES.home);
    // Through the event card in the "All events" list (the landing may link the album too).
    await page.locator('article.card').getByRole('link', { name: 'Demo Event A' }).click();
    await expect(page).toHaveURL(/\/pinus-album\/albums\/demo-event-a\/$/);
    await page.getByRole('link', { name: 'Day 1', exact: true }).first().click();
    await expect(page).toHaveURL(/\/pinus-album\/albums\/demo-event-a\/day-1\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Day 1');

    // Tile 1: @alice-demo/IMG_0001.jpg — caption from photos.yaml, credit from the folder,
    // Instagram handle from photographers.yaml, date from EXIF.
    await openFromTile(page, 1);
    const v = viewer(page);
    await expect(v.dialog).toHaveAttribute('aria-modal', 'true');
    await expect(v.dialog).toHaveAccessibleName('Photo 2 of 13 by Alice (Demo)');
    await expect(v.avatar).toHaveText('AD');
    await expect(v.nameLink.locator('[data-name-link-text]')).toHaveText('Alice (Demo)');
    await expect(v.nameLink).toHaveAttribute('href', 'https://www.instagram.com/alice.demo.placeholder/');
    await expect(v.nameLink).toHaveAttribute('target', '_blank');
    await expect(v.nameLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(v.date).toHaveText('18 Sep 2026');
    await expect(v.date).toHaveAttribute('datetime', '2026-09-18');
    await expect(v.caption).toHaveText('Demo caption: the registration desk opens.');
    await expect(v.photo).toHaveAttribute('alt', 'Demo caption: the registration desk opens.');
    await expect.poll(() => hashOf(page)).toBe('alice-demo-img-0001');
    // Focus starts inside the dialog, on ✕.
    await expect(v.close).toBeFocused();
  });

  test('a caption keeps its line breaks and emoji', async ({ page }) => {
    await page.goto(PAGES.section);
    await openFromTile(page, 2);
    const caption = await viewer(page).caption.evaluate((element) => element.textContent);
    expect(caption).toBe('Demo caption with an emoji 🎉\nand a second line.');
  });
});

test.describe('absent data leaves no empty rows', () => {
  test('a photo with no photographer, no date and no caption shows none of those rows', async ({ page }) => {
    await page.goto(PAGES.flatEvent);
    await openFromTile(page, 8); // IMG-20260815-WA0003.jpg
    const v = viewer(page);
    await expect(v.dialog).toHaveAccessibleName('Photo 9 of 12');
    await expect(v.credit).toBeHidden();
    await expect(v.nameRow).toBeHidden();
    await expect(v.dateRow).toBeHidden();
    await expect(v.captionBlock).toBeHidden();
    await expect(v.nameLink).toHaveCount(0);
    await expect(v.dialog).not.toContainText(/unknown/i);
  });

  test('a photographer without Instagram is plain text, and a photo without date has no date row', async ({ page }) => {
    await page.goto(PAGES.flatEvent);
    await openFromTile(page, 7); // IMG-20260815-WA0002.jpg: Budi, no date, no caption
    const v = viewer(page);
    await expect(v.nameRow).toBeVisible();
    await expect(v.nameRow).toHaveText('Budi (Demo)');
    await expect(v.nameLink).toHaveCount(0);
    await expect(v.dateRow).toBeHidden();
    await expect(v.captionBlock).toBeHidden();
  });
});

test.describe('moving between photos', () => {
  test('arrow keys, Home and End, without wrapping at the ends', async ({ page }) => {
    await page.goto(PAGES.section);
    await openFromTile(page, 1);
    const v = viewer(page);

    await page.keyboard.press('ArrowRight');
    await expect(v.dialog).toHaveAccessibleName('Photo 3 of 13 by Budi (Demo)');
    await expect(v.counter).toHaveText('3 / 13');
    await expect.poll(() => hashOf(page)).toBe('budi-demo-img-0001');

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(v.dialog).toHaveAccessibleName('Photo 1 of 13 by Budi (Demo)');
    await expect(v.previous).toBeHidden();
    await page.keyboard.press('ArrowLeft'); // no wrap-around
    await expect(v.dialog).toHaveAccessibleName('Photo 1 of 13 by Budi (Demo)');

    await page.keyboard.press('End');
    await expect(v.dialog).toHaveAccessibleName('Photo 13 of 13 by Budi (Demo)');
    await expect(v.next).toBeHidden();
    await page.keyboard.press('Home');
    await expect(v.dialog).toHaveAccessibleName('Photo 1 of 13 by Budi (Demo)');
  });

  test('the next and previous buttons', async ({ page }) => {
    await page.goto(PAGES.section);
    await openFromTile(page, 4);
    const v = viewer(page);
    await v.next.click();
    await expect(v.dialog).toHaveAccessibleName(/^Photo 6 of 13/);
    await v.previous.click();
    await v.previous.click();
    await expect(v.dialog).toHaveAccessibleName(/^Photo 4 of 13/);
  });

  test('moving replaces the history entry instead of adding one', async ({ page }) => {
    await page.goto(PAGES.section);
    const before = await page.evaluate(() => history.length);
    await openFromTile(page, 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  });

  test('touch swipe left and right', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'touch only');
    await page.goto(PAGES.section);
    await openFromTile(page, 1);
    const v = viewer(page);
    const stage = v.dialog.locator('[data-stage]');
    await swipe(page, stage, -160);
    await expect(v.dialog).toHaveAccessibleName(/^Photo 3 of 13/);
    await swipe(page, stage, 160);
    await expect(v.dialog).toHaveAccessibleName(/^Photo 2 of 13/);
  });
});

test.describe('closing', () => {
  test('Esc closes, clears the hash and returns focus to the tile of the photo shown last', async ({ page }) => {
    await page.goto(PAGES.section);
    await openFromTile(page, 1);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(viewer(page).dialog).toBeHidden();
    await expect.poll(() => hashOf(page)).toBe('');
    await expect(tile(page, 2)).toBeFocused();
  });

  test('✕ closes and returns focus to the tile', async ({ page }) => {
    await page.goto(PAGES.section);
    await openFromTile(page, 3);
    await viewer(page).close.click();
    await expect(viewer(page).dialog).toBeHidden();
    await expect(tile(page, 3)).toBeFocused();
  });

  test('browser Back closes the viewer, stays on the album page and returns focus to the tile', async ({ page }) => {
    await page.goto(PAGES.section);
    const albumUrl = withoutHash(page);
    await openFromTile(page, 0);
    await page.goBack();
    await expect(viewer(page).dialog).toBeHidden();
    expect(page.url()).toBe(albumUrl);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Day 1');
    await expect(tile(page, 0)).toBeFocused();
  });

  test('a click on the backdrop closes the viewer and returns focus to the tile (from 600 px)', async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), 'below 600 px the viewer is full screen and has no backdrop');
    await page.goto(PAGES.section);
    await openFromTile(page, 0);
    await page.mouse.click(4, 4); // the frame is inset from the window edges
    await expect(viewer(page).dialog).toBeHidden();
    await expect(tile(page, 0)).toBeFocused();
  });

  test('Tab stays inside the open viewer', async ({ page }) => {
    await page.goto(PAGES.section);
    await openFromTile(page, 1);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await viewer(page).dialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    }
  });
});

test.describe('deep links', () => {
  test('a link to #<photo-slug> opens that photo, and Back then stays on the page', async ({ page }) => {
    await page.goto(`${PAGES.section}#alice-demo-img-0005`);
    const v = viewer(page);
    await expect(v.dialog).toBeVisible();
    await expect(v.dialog).toHaveAccessibleName('Photo 9 of 13 by Alice (Demo)');
    await expect(v.photo).toHaveAttribute('alt', 'Demo photo with a long caption');
    await page.goBack();
    await expect(v.dialog).toBeHidden();
    expect(withoutHash(page)).toMatch(/\/albums\/demo-event-a\/day-1\/$/);
    await expect(tile(page, 8)).toBeFocused(); // photo 9, the one the link named
  });

  test('an invalid hash is ignored', async ({ page }) => {
    await page.goto(`${PAGES.section}#no-such-photo`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Day 1');
    await expect(viewer(page).dialog).toBeHidden();
    await expect.poll(() => hashOf(page)).toBe('no-such-photo');
  });

  test('a hidden photo cannot be opened by its deep link', async ({ page }) => {
    await page.goto(`albums/demo-event-a/day-2/#budi-demo-dsc-0106`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Day 2');
    await expect(viewer(page).dialog).toBeHidden();
  });
});

test.describe('orientation', () => {
  // @alice-demo/IMG_0004.jpg is stored 1600×1067 (landscape) with EXIF Orientation 6.
  // Upright it is portrait, with a big white "UP" arrow at the top of the picture.

  test('the photo stored sideways is upright in the viewer', async ({ page }) => {
    await page.goto(`${PAGES.section}#alice-demo-img-0004`);
    await expect(viewer(page).dialog).toBeVisible();
    const size = await loadedPhotoSize(page);
    expect(size.height).toBeGreaterThan(size.width);
    expect(size.width / size.height).toBeCloseTo(1067 / 1600, 2);
    const bands = await whiteByEdge(viewer(page).photo);
    expect(Math.max(bands.bottom, bands.left, bands.right)).toBeLessThan(bands.top);
  });

  test('its grid thumbnail is cut from the upright picture', async ({ page }) => {
    await page.goto(PAGES.section);
    const thumbnail = tile(page, 6).locator('img');
    await expect(thumbnail).toHaveAttribute('alt', /stored sideways/);
    await thumbnail.scrollIntoViewIfNeeded();
    const bands = await whiteByEdge(thumbnail);
    expect(Math.max(bands.bottom, bands.left, bands.right)).toBeLessThan(bands.top);
  });
});

/** Near-white pixels in the outer quarter along each edge of a loaded image. */
async function whiteByEdge(image: Locator): Promise<Record<'top' | 'bottom' | 'left' | 'right', number>> {
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  return image.evaluate((element: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const width = (canvas.width = element.naturalWidth);
    const height = (canvas.height = element.naturalHeight);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2D canvas');
    context.drawImage(element, 0, 0);
    const white = (x: number, y: number, w: number, h: number) => {
      const { data } = context.getImageData(x, y, w, h);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((data[i] ?? 0) > 235 && (data[i + 1] ?? 0) > 235 && (data[i + 2] ?? 0) > 235) count++;
      }
      return count;
    };
    const qw = Math.round(width / 4);
    const qh = Math.round(height / 4);
    return {
      top: white(0, 0, width, qh),
      bottom: white(0, height - qh, width, qh),
      left: white(0, 0, qw, height),
      right: white(width - qw, 0, qw, height),
    };
  });
}
