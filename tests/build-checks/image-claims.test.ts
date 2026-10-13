import { describe, expect, it } from 'vitest';
import { dimensionProblem, extractImageClaims } from '../../src/lib/build-checks/image-claims.ts';

describe('extractImageClaims', () => {
  it('claims src at width×height and each w-descriptor at the same aspect ratio', () => {
    const html =
      '<img src="/b/t.webp" srcset="/b/s.webp 240w, /b/t.webp 480w" width="480" height="480" alt="x">' +
      '<img src="/b/c.webp" srcset="/b/c4.webp 400w, /b/c6.webp 600w" width="600" height="450" alt="">';
    expect(extractImageClaims(html)).toEqual([
      { source: 'img', url: '/b/t.webp', width: 480, height: 480 },
      { source: 'img', url: '/b/s.webp', width: 240, height: 240 },
      { source: 'img', url: '/b/t.webp', width: 480, height: 480 },
      { source: 'img', url: '/b/c.webp', width: 600, height: 450 },
      { source: 'img', url: '/b/c4.webp', width: 400, height: 300 },
      { source: 'img', url: '/b/c6.webp', width: 600, height: 450 },
    ]);
  });

  it('claims only descriptor widths when the img has no size, and ignores x descriptors', () => {
    expect(extractImageClaims('<img src="/b/a.webp" srcset="/b/a.webp 800w, /b/b.webp 2x" alt="">')).toEqual([
      { source: 'img', url: '/b/a.webp', width: 800 },
    ]);
  });

  it('reads the viewer JSON: a portrait photo claims portrait files', () => {
    const data = { photos: [{ image: { src: '/b/v1.webp', srcset: '/b/v0.webp 800w, /b/v1.webp 1067w', sizes: '100vw', width: 1067, height: 1600 } }] };
    const html = `<script type="application/json" id="viewer-data">${JSON.stringify(data)}</script>`;
    expect(extractImageClaims(html)).toEqual([
      { source: 'json', url: '/b/v1.webp', width: 1067, height: 1600 },
      { source: 'json', url: '/b/v0.webp', width: 800, height: 1200 },
      { source: 'json', url: '/b/v1.webp', width: 1067, height: 1600 },
    ]);
  });

  it('ignores img-like text inside scripts', () => {
    expect(extractImageClaims('<script>const t = \'<img src="/x.webp" width="1" height="1">\';</script>')).toEqual([]);
  });
});

describe('dimensionProblem', () => {
  const claim = { source: 'json', url: '/b/v.webp', width: 1067, height: 1600 };

  it('accepts an exact width and a height within 1 px of rounding', () => {
    expect(dimensionProblem(claim, { width: 1067, height: 1600 })).toBeUndefined();
    expect(dimensionProblem(claim, { width: 1067, height: 1601 })).toBeUndefined();
  });

  it('reports a file 1 px narrower than its w descriptor', () => {
    expect(dimensionProblem({ source: 'img', url: '/b/a.webp', width: 800, height: 533 }, { width: 799, height: 533 })).toBe(
      'is 799×533 but the page says 800×533',
    );
  });

  it('reports a sideways image (orientation not applied)', () => {
    expect(dimensionProblem(claim, { width: 1600, height: 1067 })).toBe('is 1600×1067 but the page says 1067×1600 (the image is sideways)');
  });

  it('checks only the width when the page states no aspect ratio', () => {
    expect(dimensionProblem({ source: 'img', url: '/b/a.webp', width: 800 }, { width: 800, height: 5 })).toBeUndefined();
    expect(dimensionProblem({ source: 'img', url: '/b/a.webp', width: 800 }, { width: 640, height: 5 })).toBe(
      'is 640×5 but the page says 800 px wide',
    );
  });

  it('checks only the aspect ratio of an SVG, which scales to any size', () => {
    const logo = { source: 'img', url: '/b/logo.svg', width: 34, height: 34 };
    expect(dimensionProblem(logo, { width: 688, height: 692 })).toBeUndefined();
    expect(dimensionProblem({ ...logo, url: '/b/logo.SVG?v=2' }, { width: 688, height: 692 })).toBeUndefined();
    expect(dimensionProblem(logo, { width: 688, height: 400 })).toBe('is a 688×400 drawing but the page shows it at 34×34, so it is stretched');
    expect(dimensionProblem({ source: 'img', url: '/b/logo.svg', width: 34 }, { width: 688, height: 400 })).toBeUndefined();
  });
});
