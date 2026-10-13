import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractScripts,
  hasPhotoGrid,
  JS_BUDGET_GZIP_BYTES,
  kilobytes,
  pageProblems,
  PREVIEW_IMAGE_MAX_BYTES,
  previewImageSizeProblem,
  previewProblems,
  robotsContent,
  scriptBudgetProblem,
  TAKEDOWN_TEXT,
} from '../../src/lib/build-checks/page-rules.ts';

const EMAIL = 'album@example.org';
const FOOTER = `<footer><p>Not comfortable with a photo? Contact <a href="mailto:${EMAIL}" data-astro-cid-x>${EMAIL}</a> and we'll remove it.</p></footer>`;
const VIEWER_DATA = '<script type="application/json" id="viewer-data">{"photos":[]}</script>';
const VIEWER_SCRIPT = '<script type="module" src="/pinus-album/_astro/PostViewer.abc.js"></script>';

function page({ robots = 'noindex, nofollow', footer = FOOTER, body = '' }: { robots?: string | null; footer?: string; body?: string } = {}) {
  const meta = robots === null ? '' : `<meta name="robots" content="${robots}">`;
  return `<!doctype html><html><head><title>x</title>${meta}</head><body><main>${body}</main>${footer}</body></html>`;
}

const noindexPolicy = { allowIndexing: false, contactEmail: EMAIL };
const indexPolicy = { allowIndexing: true, contactEmail: EMAIL };

describe('robotsContent', () => {
  it('reads the robots meta, in any attribute order', () => {
    expect(robotsContent(page())).toBe('noindex, nofollow');
    expect(robotsContent(`<meta content='index, follow' name=robots>`)).toBe('index, follow');
    expect(robotsContent(page({ robots: null }))).toBeUndefined();
  });

  it('ignores robots text inside scripts', () => {
    expect(robotsContent('<script>const x = \'<meta name="robots" content="index">\';</script>')).toBeUndefined();
  });
});

describe('extractScripts', () => {
  it('lists external scripts and counts inline code, but not JSON data blocks', () => {
    expect(extractScripts(page({ body: VIEWER_DATA + VIEWER_SCRIPT }))).toEqual({
      external: ['/pinus-album/_astro/PostViewer.abc.js'],
      inline: 0,
    });
    expect(extractScripts('<script type="application/ld+json">{}</script><script>alert(1)</script><script></script>')).toEqual({
      external: [],
      inline: 1,
    });
  });
});

describe('hasPhotoGrid', () => {
  it('is true only for pages that embed the viewer data', () => {
    expect(hasPhotoGrid(page({ body: VIEWER_DATA }))).toBe(true);
    expect(hasPhotoGrid(page())).toBe(false);
  });
});

describe('pageProblems', () => {
  it('accepts a correct page, with or without photos', () => {
    expect(pageProblems(page(), noindexPolicy)).toEqual([]);
    expect(pageProblems(page({ body: VIEWER_DATA + VIEWER_SCRIPT }), noindexPolicy)).toEqual([]);
    expect(pageProblems(page({ robots: 'index, follow' }), indexPolicy)).toEqual([]);
  });

  it('requires noindex by default (TRD §10)', () => {
    expect(pageProblems(page({ robots: 'index, follow' }), noindexPolicy)).toEqual([
      expect.stringContaining('must say "noindex"'),
    ]);
    expect(pageProblems(page({ robots: null }), noindexPolicy)).toEqual(['has no <meta name="robots"> tag']);
  });

  it('rejects noindex when the site was built with ALLOW_INDEXING=true', () => {
    expect(pageProblems(page(), indexPolicy)).toEqual([expect.stringContaining('ALLOW_INDEXING=true')]);
  });

  it('requires the takedown line with a mailto link to the contact address (TRD §10)', () => {
    expect(pageProblems(page({ footer: '<footer><p>Pinus Community</p></footer>' }), noindexPolicy)).toEqual([
      expect.stringContaining('no takedown line'),
    ]);
    expect(pageProblems(page({ footer: '' }), noindexPolicy)).toEqual([expect.stringContaining('no takedown line')]);
    expect(pageProblems(page(), { ...noindexPolicy, contactEmail: 'someone@else.org' })).toEqual([
      expect.stringContaining('mailto:someone@else.org'),
    ]);
    // Email addresses are case-insensitive.
    expect(pageProblems(page(), { ...noindexPolicy, contactEmail: 'Album@Example.org' })).toEqual([]);
  });

  it('does not accept a takedown line outside the footer', () => {
    const html = page({ footer: '<footer></footer>', body: FOOTER.replace(/footer/g, 'div') });
    expect(pageProblems(html, noindexPolicy)).toEqual([expect.stringContaining('no takedown line')]);
  });

  it('allows JavaScript only on pages with photos (TRD §11)', () => {
    expect(pageProblems(page({ body: VIEWER_SCRIPT }), noindexPolicy)).toEqual([
      expect.stringContaining('has no photos'),
    ]);
    expect(pageProblems(page({ body: '<script>console.log(1)</script>' }), noindexPolicy)).toEqual([
      expect.stringContaining('inline script'),
    ]);
  });
});

describe('scriptBudgetProblem', () => {
  it('passes at or under 60 KB gzipped and fails above it', () => {
    expect(JS_BUDGET_GZIP_BYTES).toBe(61_440);
    expect(scriptBudgetProblem(0)).toBeUndefined();
    expect(scriptBudgetProblem(JS_BUDGET_GZIP_BYTES)).toBeUndefined();
    expect(scriptBudgetProblem(JS_BUDGET_GZIP_BYTES + 1)).toMatch(/over the 60 KB budget/);
  });
});

describe('kilobytes', () => {
  it('formats binary kilobytes with one decimal', () => {
    expect(kilobytes(4780)).toBe('4.7 KB');
    expect(kilobytes(61_440)).toBe('60 KB');
  });
});

describe('TAKEDOWN_TEXT', () => {
  it('is the sentence SiteFooter.astro renders, so the check and the footer stay in step', () => {
    expect(readFileSync('src/components/SiteFooter.astro', 'utf8')).toContain(TAKEDOWN_TEXT);
  });
});

describe('previewProblems (link previews)', () => {
  const URL_ = 'https://hanshimawan26.github.io/pinus-album/albums/x/';
  const tags = (extra = '', url = URL_) =>
    `<head><meta property="og:title" content="X"><meta property="og:description" content="About X">` +
    `<meta property="og:url" content="${url}"><meta name="twitter:card" content="summary">${extra}</head>`;
  const image = '<meta property="og:image" content="https://hanshimawan26.github.io/pinus-album/_astro/a.jpg">';
  const size = '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">';

  it('accepts a page with title, description, its own URL and a card type, with or without an image', () => {
    expect(previewProblems(tags(), URL_)).toEqual([]);
    expect(previewProblems(tags(image + size), URL_)).toEqual([]);
  });

  it('reports missing tags', () => {
    expect(previewProblems('<head></head>', URL_)).toEqual([
      'has no link preview tag "og:title"',
      'has no link preview tag "og:description"',
      'has no link preview tag "og:url"',
      'has no link preview tag "twitter:card"',
    ]);
  });

  it('reports an og:url that is not the page itself', () => {
    expect(previewProblems(tags('', 'https://hanshimawan26.github.io/pinus-album/'), URL_)).toEqual([
      `has og:url "https://hanshimawan26.github.io/pinus-album/", but the page's address is ${URL_}`,
    ]);
  });

  it('reports an og:image without its size', () => {
    expect(previewProblems(tags(image), URL_)).toEqual(['has an og:image without og:image:width and og:image:height']);
  });

  it('wants no preview tags on the 404 page', () => {
    expect(previewProblems('<head></head>', undefined)).toEqual([]);
    expect(previewProblems(tags(), undefined)[0]).toContain('the 404 page has no address to share');
  });
});

describe('previewImageSizeProblem', () => {
  it('allows preview images up to 300 KB', () => {
    expect(previewImageSizeProblem(PREVIEW_IMAGE_MAX_BYTES)).toBeUndefined();
    expect(previewImageSizeProblem(PREVIEW_IMAGE_MAX_BYTES + 1)).toContain('WhatsApp');
  });
});
