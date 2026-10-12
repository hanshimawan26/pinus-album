import { describe, expect, it } from 'vitest';
import { extractCssReferences, extractHtmlReferences, parseSrcset, resolveReference, sitePathOf, srcsetUrls } from '../../src/lib/build-checks/links.ts';

describe('extractHtmlReferences', () => {
  it('finds href, src and every srcset URL, decoding entities', () => {
    const html = `
      <link rel="icon" href="/b/favicon.svg">
      <a href='/b/albums/x/?a=1&amp;b=2'>x</a>
      <img src=/b/_astro/a.webp srcset="/b/_astro/a.webp 240w, /b/_astro/b.webp 480w" alt="">`;
    expect(extractHtmlReferences(html).map((ref) => `${ref.source} ${ref.url}`)).toEqual([
      'href /b/favicon.svg',
      'href /b/albums/x/?a=1&b=2',
      'src /b/_astro/a.webp',
      'srcset /b/_astro/a.webp',
      'srcset /b/_astro/b.webp',
    ]);
  });

  it('reads src and srcset values inside inline JSON (the viewer data)', () => {
    const html = `<script type="application/json" id="viewer-data">${JSON.stringify({
      photos: [{ image: { src: '/b/v.webp', srcset: '/b/v.webp 800w, /b/w.webp 1200w' }, photographer: { instagramUrl: 'https://x' } }],
    })}</script>`;
    expect(extractHtmlReferences(html).map((ref) => `${ref.source} ${ref.url}`)).toEqual([
      'json:src /b/v.webp',
      'json:srcset /b/v.webp',
      'json:srcset /b/w.webp',
    ]);
  });

  it('ignores attribute-like text inside scripts and styles', () => {
    const html = '<script>const s = " src=/nope.js";</script><style>a[href="/nope"]{}</style><a href="/b/">ok</a>';
    expect(extractHtmlReferences(html).map((ref) => ref.url)).toEqual(['/b/']);
  });

  it('throws on broken inline JSON', () => {
    expect(() => extractHtmlReferences('<script type="application/json">{oops</script>')).toThrow();
  });
});

describe('srcsetUrls and extractCssReferences', () => {
  it('splits a srcset', () => {
    expect(srcsetUrls(' a.webp 1x,b.webp 2x ')).toEqual(['a.webp', 'b.webp']);
  });

  it('finds url() values', () => {
    expect(extractCssReferences('a{background:url("/b/x.png")} b{src:url(/b/f.woff2) format("woff2")}').map((ref) => ref.url)).toEqual([
      '/b/x.png',
      '/b/f.woff2',
    ]);
  });
});

describe('resolveReference', () => {
  const base = '/pinus-album/';
  const page = '/pinus-album/albums/event/';

  it('skips external URLs, fragments and data URLs', () => {
    for (const url of ['https://www.instagram.com/x/', 'mailto:a@b.c', '#main', 'data:image/png;base64,AA', '//cdn.example/x.js']) {
      expect(resolveReference(url, page, base)).toEqual({ kind: 'skip' });
    }
  });

  it('maps directory URLs to index.html and files to themselves', () => {
    expect(resolveReference('/pinus-album/', page, base)).toEqual({ kind: 'internal', sitePath: '/pinus-album/', candidates: ['index.html'] });
    expect(resolveReference('/pinus-album/albums/event/day-1/#andi-img-1', page, base)).toEqual({
      kind: 'internal',
      sitePath: '/pinus-album/albums/event/day-1/',
      candidates: ['albums/event/day-1/index.html'],
    });
    expect(resolveReference('/pinus-album/_astro/a.webp?v=1', page, base)).toEqual({
      kind: 'internal',
      sitePath: '/pinus-album/_astro/a.webp',
      candidates: ['_astro/a.webp', '_astro/a.webp/index.html'],
    });
  });

  it('resolves relative URLs against the page', () => {
    expect(resolveReference('day-1/', page, base)).toMatchObject({ candidates: ['albums/event/day-1/index.html'] });
    expect(resolveReference('../', page, base)).toMatchObject({ candidates: ['albums/index.html'] });
  });

  it('decodes percent-encoded paths', () => {
    expect(resolveReference('/pinus-album/_astro/a%20b.webp', page, base)).toMatchObject({ candidates: ['_astro/a b.webp', '_astro/a b.webp/index.html'] });
  });

  it('reports links that miss the base path (the classic sub-path mistake)', () => {
    expect(resolveReference('/albums/event/', page, base)).toEqual({
      kind: 'error',
      reason: 'points outside the site\'s base path "/pinus-album/"',
    });
    expect(resolveReference('../../../x', page, base)).toMatchObject({ kind: 'error' });
  });

  it('reports empty URLs', () => {
    expect(resolveReference('  ', page, base)).toEqual({ kind: 'error', reason: 'empty URL' });
  });

  it('works at the domain root', () => {
    expect(resolveReference('/albums/event/', '/', '/')).toMatchObject({ candidates: ['albums/event/index.html'] });
  });
});

describe('sitePathOf', () => {
  it('turns dist files into served URL paths', () => {
    expect(sitePathOf('index.html', '/b/')).toBe('/b/');
    expect(sitePathOf('albums/x/index.html', '/b/')).toBe('/b/albums/x/');
    expect(sitePathOf('404.html', '/')).toBe('/404.html');
  });
});

describe('extractHtmlReferences: inline styles', () => {
  it('finds url() values in inline <style> blocks and style attributes (the build inlines all CSS)', () => {
    const html =
      '<style>.a{background:url(/b/_astro/bg.webp)}</style>' +
      '<div style="background-image: url(&quot;/b/hero.webp&quot;)"></div>';
    expect(extractHtmlReferences(html).map((ref) => `${ref.source} ${ref.url}`)).toEqual([
      'css:url /b/_astro/bg.webp',
      'css:url /b/hero.webp',
    ]);
  });
});

describe('parseSrcset', () => {
  it('reads width descriptors and leaves other descriptors out', () => {
    expect(parseSrcset('a.webp 800w, b.webp 2x, c.webp')).toEqual([{ url: 'a.webp', width: 800 }, { url: 'b.webp' }, { url: 'c.webp' }]);
  });
});
