import { describe, expect, it } from 'vitest';
import type { ViewerPhoto } from '../../src/lib/viewer-data.ts';
import { slideFor, widestCandidate } from '../../src/scripts/viewer/slides.ts';

function photo(image: Partial<ViewerPhoto['image']>): ViewerPhoto {
  return {
    slug: 'a',
    alt: 'The opening dance',
    image: { src: '/a-1200.webp', srcset: '', width: 1200, height: 800, ...image },
    download: { src: '/a.jpg', width: 2400, height: 1600, fileName: 'a.jpg' },
  };
}

describe('widestCandidate', () => {
  it('finds the largest width, in any order', () => {
    expect(widestCandidate('/a-800.webp 800w, /a-2000.webp 2000w, /a-1200.webp 1200w')).toBe(2000);
  });

  it('is null without width descriptors', () => {
    expect(widestCandidate('')).toBeNull();
    expect(widestCandidate('/a.webp 2x')).toBeNull();
  });
});

describe('slideFor', () => {
  it('has the size of the largest file, in the photo’s shape', () => {
    const slide = slideFor(photo({ srcset: '/a-800.webp 800w, /a-1500.webp 1500w' }));
    expect(slide).toEqual({
      src: '/a-1200.webp',
      srcset: '/a-800.webp 800w, /a-1500.webp 1500w',
      width: 1500,
      height: 1000,
      alt: 'The opening dance',
    });
  });

  it('falls back to the size of the single file', () => {
    expect(slideFor(photo({}))).toMatchObject({ width: 1200, height: 800 });
  });
});
