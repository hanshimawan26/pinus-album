import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BREAKPOINTS,
  CONTENT_MAX,
  coverHeight,
  coverSizes,
  coverWidths,
  heroSizes,
  loadingHint,
  PREVIEW_IMAGE,
  previewImageSize,
  SHORT_STORY_MAX_CHARS,
  startsNearTop,
  thumbnailEdge,
  thumbnailWidths,
  THUMBNAIL_SIZES,
  VIEWER_LAYOUT,
  VIEWER_SIZES,
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

describe('thumbnails (TRD §6.4: square, about 480 px)', () => {
  it('crops a 480 px square from a normal photo', () => {
    expect(thumbnailEdge(1600, 1067)).toBe(480);
    expect(thumbnailEdge(1067, 1600)).toBe(480);
  });

  it('uses the short side of a small source instead of upscaling', () => {
    expect(thumbnailEdge(640, 300)).toBe(300);
  });

  it('adds a 240 px size for phones', () => {
    expect(thumbnailWidths(480)).toEqual([240, 480]);
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
    expect(VIEWER_SIZES).toBe('(min-width: 1696px) 1260px, (min-width: 900px) calc(94vw - 340px), (min-width: 600px) 576px, 100vw');
    expect(THUMBNAIL_SIZES).toBe('(min-width: 1100px) 224px, (min-width: 600px) 25vw, 34vw');
    expect(coverSizes('event')).toBe('(min-width: 1100px) 374px, (min-width: 900px) 33vw, (min-width: 600px) 50vw, 100vw');
    expect(coverSizes('section')).toBe('(min-width: 1100px) 280px, (min-width: 900px) 33vw, 50vw');
  });
});

describe('VIEWER_LAYOUT', () => {
  // The viewer's `sizes` is only right while these numbers match the CSS that draws it.
  const css = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const viewer = css('../src/components/PostViewer.astro');
  const global = css('../src/styles/global.css');

  it('matches the post viewer CSS', () => {
    expect(viewer).toContain(`flex: 0 1 ${VIEWER_LAYOUT.column / 16}rem`);
    expect(viewer).toContain(`max-width: ${VIEWER_LAYOUT.frameMax / 16}rem`);
    expect(viewer).toContain(`clamp(var(--space-4), ${VIEWER_LAYOUT.insetVw}vw, var(--space-7))`);
    expect(global).toContain(`--space-7: ${VIEWER_LAYOUT.insetMax / 16}rem`);
    expect(global).toContain(`--viewer-panel: ${VIEWER_LAYOUT.panel}px`);
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
