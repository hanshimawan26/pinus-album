import { describe, expect, it } from 'vitest';
import { initials, parseFolderName, photographerSlug, photoSlug, slugify, titleFromSlug } from '../src/lib/slug.ts';

describe('slugify', () => {
  it.each([
    ['Pergelaran 2026', 'pergelaran-2026'],
    ['IMG_0012', 'img-0012'],
    ['  --Hello   World--  ', 'hello-world'],
    ['Café Ünïcode', 'cafe-unicode'],
    ['Opening 💃 dance!', 'opening-dance'],
    ['already-a-slug', 'already-a-slug'],
    ['!!!', ''],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('parseFolderName (numeric prefix, TRD §4.2 rule 6)', () => {
  it('strips a numeric prefix from the slug and keeps it for ordering', () => {
    expect(parseFolderName('01-day-1')).toEqual({ prefix: 1, slug: 'day-1' });
    expect(parseFolderName('10_closing-night')).toEqual({ prefix: 10, slug: 'closing-night' });
    expect(parseFolderName('003 Gala')).toEqual({ prefix: 3, slug: 'gala' });
  });

  it('has no prefix when the name does not start with digits and a separator', () => {
    expect(parseFolderName('day-1')).toEqual({ slug: 'day-1' });
    expect(parseFolderName('Day 1')).toEqual({ slug: 'day-1' });
  });

  it('treats a four-digit year as part of the name, not as a prefix', () => {
    expect(parseFolderName('2026-welcome-picnic')).toEqual({ slug: '2026-welcome-picnic' });
  });

  it('keeps a purely numeric name as the slug', () => {
    expect(parseFolderName('01')).toEqual({ slug: '01' });
    expect(parseFolderName('01-')).toEqual({ slug: '01' });
  });
});

describe('titleFromSlug (TRD §4.2 rule 7, §4.5)', () => {
  it.each([
    ['day-1', 'Day 1'],
    ['andi-pratama', 'Andi Pratama'],
    ['welcome_picnic-2026', 'Welcome Picnic 2026'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(titleFromSlug(input)).toBe(expected);
  });
});

describe('photoSlug (TRD §4.7)', () => {
  it('uses the path relative to the node, without extension, @ removed, / → -', () => {
    expect(photoSlug('@andi-pratama/IMG_0012.jpg')).toBe('andi-pratama-img-0012');
  });

  it('handles photos directly in the node and odd file names', () => {
    expect(photoSlug('IMG_0012.JPG')).toBe('img-0012');
    expect(photoSlug('DSC 0441 (1).jpeg')).toBe('dsc-0441-1');
    expect(photoSlug('my.photo.v2.webp')).toBe('my-photo-v2');
  });

  it('distinguishes the same file name from two photographers', () => {
    expect(photoSlug('@alice/IMG_0001.jpg')).not.toBe(photoSlug('@budi/IMG_0001.jpg'));
  });

  it('depends only on the path (stable when other photos are added)', () => {
    expect(photoSlug('@sari-wijaya/DSC_0441.jpg')).toBe('sari-wijaya-dsc-0441');
  });
});

describe('initials', () => {
  it.each([
    ['Andi Pratama', 'AP'],
    ['Budi', 'B'],
    ['Alice (Demo)', 'AD'],
    ['sari wijaya putri', 'SP'],
    ['Ölaf Ångström', 'ÖÅ'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(initials(input)).toBe(expected);
  });
});

describe('photographerSlug (one rule for @folders, photographer: values and photographers.yaml keys)', () => {
  it('removes leading @ and slugifies', () => {
    expect(photographerSlug('@andi-pratama')).toBe('andi-pratama');
    expect(photographerSlug('@@Andi Pratama ')).toBe('andi-pratama');
    expect(photographerSlug('Sari_Wijaya')).toBe('sari-wijaya');
  });

  it('is empty when nothing usable remains', () => {
    expect(photographerSlug('@')).toBe('');
    expect(photographerSlug('@日本')).toBe('');
  });
});

describe('photoSlug: names without plain letters or digits', () => {
  it('gives an empty slug, which validation reports (invalid-file-name)', () => {
    expect(photoSlug('_.jpg')).toBe('');
    expect(photoSlug('照片.jpg')).toBe('');
    expect(photoSlug('@andi/照片.jpg')).toBe('andi');
  });
});
