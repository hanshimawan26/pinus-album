import { describe, expect, it } from 'vitest';
import {
  BREAKPOINTS,
  CONTENT_MAX,
  coverHeight,
  coverSizes,
  coverWidths,
  heroSizes,
  loadingHint,
  DOWNLOAD_IMAGE,
  downloadImageSize,
  PREVIEW_IMAGE,
  previewImageSize,
  SHORT_STORY_MAX_CHARS,
  startsNearTop,
  thumbnailSizes,
  thumbnailWidth,
  thumbnailWidths,
  viewerFallbackWidth,
  viewerWidths,
  widthsFor,
} from '../src/lib/image-sizes.ts';

describe('viewerWidths (TRD §7: 800/1200/1600/2000, never upscaled)', () => {
  it('uses every step for a large source', () => {
    expect(viewerWidths(2400)).toEqual([800, 1200, 1600, 2000]);
    expect(viewerWidths(2000)).toEqual([800, 1200, 1600, 2000]);
  });

  it('stops at the source width and keeps it as the largest size', () => {
    expect(viewerWidths(1500)).toEqual([800, 1200, 1500]);
    expect(viewerWidths(1600)).toEqual([800, 1200, 1600]);
    expect(viewerWidths(1067)).toEqual([800, 1067]);
  });

  it('gives a small source a single size: its own width', () => {
    expect(viewerWidths(640)).toEqual([640]);
    expect(viewerWidths(800)).toEqual([800]);
  });

  it('returns nothing for an unreadable (zero-size) source', () => {
    expect(viewerWidths(0)).toEqual([]);
  });

  it('rounds fractional widths', () => {
    expect(widthsFor(1199.6, [800, 1200])).toEqual([800, 1200]);
  });
});

describe('viewerFallbackWidth', () => {
  it('prefers 1200, else the largest width below it, else the smallest', () => {
    expect(viewerFallbackWidth([800, 1200, 1600, 2000])).toBe(1200);
    expect(viewerFallbackWidth([800, 1067])).toBe(1067);
    expect(viewerFallbackWidth([640])).toBe(640);
    expect(viewerFallbackWidth([1300])).toBe(1300);
  });
});

describe('thumbnails (TRD §6.4: whole photo, about 480 px wide)', () => {
  it('is 480 px wide, whatever the shape of the photo', () => {
    expect(thumbnailWidth(1600)).toBe(480);
    expect(thumbnailWidth(1067)).toBe(480);
  });

  it('uses the width of a small source instead of upscaling', () => {
    expect(thumbnailWidth(300)).toBe(300);
  });

  it('offers 240, 480 and 720 px, never wider than the source', () => {
    expect(thumbnailWidths(1600)).toEqual([240, 480, 720]);
    expect(thumbnailWidths(640)).toEqual([240, 480, 640]);
    expect(thumbnailWidths(300)).toEqual([240, 300]);
    expect(thumbnailWidths(200)).toEqual([200]);
  });
});

describe('card covers (4:3 crops)', () => {
  it('generates widths up to the widest 4:3 crop that fits in the source', () => {
    expect(coverWidths(1600, 1067)).toEqual([400, 600, 800, 1200]);
    // Portrait: the crop is limited by the width.
    expect(coverWidths(1067, 1600)).toEqual([400, 600, 800, 1067]);
    // Panorama: the crop is limited by the height (500 * 4/3 = 666).
    expect(coverWidths(3000, 500)).toEqual([400, 600, 666]);
  });

  it('computes the crop height', () => {
    expect(coverHeight(600)).toBe(450);
    expect(coverHeight(1067)).toBe(800);
  });
});

describe('sizes attributes', () => {
  it('match the layout breakpoints', () => {
    expect(thumbnailSizes({ phone: 0.5, tablet: 0.3333, desktop: 0.25 })).toBe('(min-width: 1100px) 280px, (min-width: 600px) 34vw, 50vw');
    expect(coverSizes('event')).toBe('(min-width: 1100px) 374px, (min-width: 900px) 33vw, (min-width: 600px) 50vw, 100vw');
    expect(coverSizes('section')).toBe('(min-width: 1100px) 280px, (min-width: 900px) 33vw, 50vw');
  });
});

describe('loadingHint (TRD §6.4: lazy below the fold)', () => {
  const policy = { nearTop: true, highPriority: 2, eager: 4 };

  it('loads the first items eagerly, the very first with high priority', () => {
    expect(loadingHint(0, policy)).toEqual({ loading: 'eager', fetchpriority: 'high' });
    expect(loadingHint(1, policy)).toEqual({ loading: 'eager', fetchpriority: 'high' });
    expect(loadingHint(2, policy)).toEqual({ loading: 'eager' });
    expect(loadingHint(3, policy)).toEqual({ loading: 'eager' });
  });

  it('lazy-loads the rest', () => {
    expect(loadingHint(4, policy)).toEqual({ loading: 'lazy' });
    expect(loadingHint(40, policy)).toEqual({ loading: 'lazy' });
  });

  it('lazy-loads everything in a grid further down the page', () => {
    expect(loadingHint(0, { ...policy, nearTop: false })).toEqual({ loading: 'lazy' });
  });
});

describe('startsNearTop (a long story pushes the grid below the fold)', () => {
  it('keeps content near the top below no story or a short one', () => {
    expect(startsNearTop(0)).toBe(true);
    expect(startsNearTop(SHORT_STORY_MAX_CHARS)).toBe(true);
  });

  it('treats content after a story of a few paragraphs as below the fold', () => {
    expect(startsNearTop(SHORT_STORY_MAX_CHARS + 1)).toBe(false);
    expect(startsNearTop(900)).toBe(false);
  });
});

describe('previewImageSize (link preview, 1.91:1)', () => {
  it('is 1200×630 for a large photo of any shape', () => {
    expect(previewImageSize(2400, 1600)).toEqual({ width: 1200, height: 630 });
    expect(previewImageSize(1600, 2400)).toEqual({ width: 1200, height: 630 });
    expect(PREVIEW_IMAGE).toMatchObject({ width: 1200, height: 630 });
  });

  it('never upscales: a small source gets the largest 1.91:1 crop inside it', () => {
    expect(previewImageSize(800, 600)).toEqual({ width: 800, height: 420 });
    expect(previewImageSize(1600, 400)).toEqual({ width: 761, height: 400 });
    expect(previewImageSize(1, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('downloadImageSize (the viewer download, TRD §6.5)', () => {
  it('scales the long edge down to 2400 px, keeping the shape', () => {
    expect(downloadImageSize(6240, 4160)).toEqual({ width: 2400, height: 1600 });
    expect(downloadImageSize(4160, 6240)).toEqual({ width: 1600, height: 2400 });
    expect(DOWNLOAD_IMAGE).toEqual({ maxEdge: 2400, quality: 85 });
  });

  it('keeps a web-ready master at its own size (never upscales)', () => {
    expect(downloadImageSize(2400, 1600)).toEqual({ width: 2400, height: 1600 });
    expect(downloadImageSize(1200, 900)).toEqual({ width: 1200, height: 900 });
  });
});

describe('heroSizes', () => {
  it('draws a landscape photo wider than the portrait phone frame, by its aspect over the frame aspect', () => {
    const sizes = heroSizes(3 / 2);
    // 3:2 in a 4:5 frame: 1.5 / 0.8 = 1.875 → 188vw on phones.
    expect(sizes.endsWith(', 188vw')).toBe(true);
    // From 900 px the 21:9 frame is wider than the photo: drawn at the frame width.
    expect(sizes).toContain(`(min-width: ${BREAKPOINTS.md}px) 100vw`);
    expect(sizes.startsWith(`(min-width: ${CONTENT_MAX + 64}px) ${CONTENT_MAX}px`)).toBe(true);
  });

  it('never draws a photo narrower than its frame', () => {
    expect(heroSizes(1 / 2).endsWith(', 100vw')).toBe(true);
  });
});
