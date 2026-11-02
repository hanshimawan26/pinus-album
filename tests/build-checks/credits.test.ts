import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildCreditTiff } from '../../src/lib/authoring/exif-block.ts';
import { withJpegExif } from '../../src/lib/authoring/jpeg.ts';
import { creditProblem, exifTiffOfImage, unexpectedExifrTags, viewerImageCredits } from '../../src/lib/build-checks/credits.ts';
import { creditFor } from '../../src/lib/credit/credit.ts';
import { withWebpExif } from '../../src/lib/credit/webp-exif.ts';

const page = (data: unknown) => `<html><body><script type="application/json" id="viewer-data">${JSON.stringify(data)}</script></body></html>`;

describe('viewerImageCredits', () => {
  it('maps every viewer image URL to its photo’s credit', () => {
    const html = page({
      context: 'Day 1',
      photos: [
        {
          slug: 'a',
          image: { src: '/_astro/a_800.webp', srcset: '/_astro/a_800.webp 800w, /_astro/a_1200.webp 1200w' },
          download: { src: '/_astro/a_2400.jpg', width: 2400, height: 1600, fileName: 'e-a.jpg' },
          photographer: { name: 'Andi Pratama', initials: 'AP' },
        },
        { slug: 'b', image: { src: '/_astro/b_800.webp', srcset: '/_astro/b_800.webp 800w' }, download: { src: '/_astro/b.jpg' } },
      ],
    });
    expect(viewerImageCredits(html)).toEqual([
      { url: '/_astro/a_800.webp', credit: creditFor('Andi Pratama') },
      { url: '/_astro/a_1200.webp', credit: creditFor('Andi Pratama') },
      { url: '/_astro/a_2400.jpg', credit: creditFor('Andi Pratama') },
      { url: '/_astro/b_800.webp' },
      { url: '/_astro/b.jpg' },
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

describe('exifTiffOfImage', () => {
  const tiff = buildCreditTiff(creditFor('Andi Pratama')!);
  const blank = (format: 'jpeg' | 'webp') => sharp({ create: { width: 8, height: 8, channels: 3, background: '#808080' } })[format]().toBuffer();

  it('reads the EXIF of a JPEG (downloads) and of a WebP (viewer images)', async () => {
    expect(exifTiffOfImage(withJpegExif(await blank('jpeg'), tiff))).toEqual(tiff);
    expect(exifTiffOfImage(withWebpExif(await blank('webp'), tiff))).toEqual(tiff);
  });

  it('is undefined without EXIF or for a broken file', async () => {
    expect(exifTiffOfImage(await blank('jpeg'))).toBeUndefined();
    expect(exifTiffOfImage(new Uint8Array([0xff, 0xd8, 0xff]))).toBeUndefined();
  });
});

describe('unexpectedExifrTags', () => {
  it('allows only the credit’s two tags, and only on a credited image', () => {
    expect(unexpectedExifrTags(['Artist', 'Copyright'], true)).toEqual([]);
    expect(unexpectedExifrTags(['Artist', 'Copyright', 'Make'], true)).toEqual(['Make']);
    expect(unexpectedExifrTags(['Artist'], false)).toEqual(['Artist']);
  });
});
