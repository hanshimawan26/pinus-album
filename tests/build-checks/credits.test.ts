import { describe, expect, it } from 'vitest';
import { creditProblem, viewerImageCredits } from '../../src/lib/build-checks/credits.ts';
import { creditFor } from '../../src/lib/credit/credit.ts';

const page = (data: unknown) => `<html><body><script type="application/json" id="viewer-data">${JSON.stringify(data)}</script></body></html>`;

describe('viewerImageCredits', () => {
  it('maps every viewer image URL to its photo’s credit', () => {
    const html = page({
      context: 'Day 1',
      photos: [
        {
          slug: 'a',
          image: { src: '/_astro/a_800.webp', srcset: '/_astro/a_800.webp 800w, /_astro/a_1200.webp 1200w' },
          photographer: { name: 'Andi Pratama', initials: 'AP' },
        },
        { slug: 'b', image: { src: '/_astro/b_800.webp', srcset: '/_astro/b_800.webp 800w' } },
      ],
    });
    expect(viewerImageCredits(html)).toEqual([
      { url: '/_astro/a_800.webp', credit: creditFor('Andi Pratama') },
      { url: '/_astro/a_1200.webp', credit: creditFor('Andi Pratama') },
      { url: '/_astro/b_800.webp' },
    ]);
  });

  it('is empty for a page without viewer data', () => {
    expect(viewerImageCredits('<html><body><img src="/logo.svg"></body></html>')).toEqual([]);
  });
});

describe('creditProblem', () => {
  const andi = creditFor('Andi Pratama')!;
  const read = (artist?: string, copyright?: string, hasOtherTags = false) => ({ artist, copyright, hasOtherTags });

  it('accepts a clean image without a credit, and the right credit with nothing else', () => {
    expect(creditProblem(undefined, { blocks: [] })).toBeUndefined();
    expect(creditProblem(andi, { blocks: ['EXIF'], credit: read('Andi Pratama', '© Andi Pratama') })).toBeUndefined();
  });

  it('rejects metadata on an image that should have none', () => {
    expect(creditProblem(undefined, { blocks: ['EXIF'], credit: read('Andi Pratama', '© Andi Pratama') })).toMatch(/contains metadata: EXIF/);
  });

  it('rejects a missing, wrong or padded credit', () => {
    expect(creditProblem(andi, { blocks: [] })).toMatch(/missing the photographer credit/);
    expect(creditProblem(andi, { blocks: ['EXIF'], credit: read('Sari', '© Sari') })).toMatch(/credits "© Sari"/);
    expect(creditProblem(andi, { blocks: ['EXIF'], credit: read('Andi Pratama', '© Andi Pratama', true) })).toMatch(/besides the photographer credit/);
    expect(creditProblem(andi, { blocks: ['EXIF', 'XMP'], credit: read('Andi Pratama', '© Andi Pratama') })).toMatch(/XMP/);
  });
});
