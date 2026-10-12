import { describe, expect, it } from 'vitest';
import { indexForHash, slugFromHash, withHash, withoutHash } from '../../src/scripts/viewer/hash.ts';

const slugs = ['alice-demo-img-0001', 'budi-demo-img-0001', 'img-20260815-wa0003'];

describe('slugFromHash', () => {
  it('strips the leading #', () => {
    expect(slugFromHash('#alice-demo-img-0001')).toBe('alice-demo-img-0001');
    expect(slugFromHash('alice-demo-img-0001')).toBe('alice-demo-img-0001');
  });

  it('returns null for an empty hash', () => {
    expect(slugFromHash('')).toBeNull();
    expect(slugFromHash('#')).toBeNull();
  });

  it('decodes percent-encoding and keeps a malformed escape as written', () => {
    expect(slugFromHash('#caf%C3%A9')).toBe('café');
    expect(slugFromHash('#bad%E0%A4%A')).toBe('bad%E0%A4%A');
  });
});

describe('indexForHash', () => {
  it('treats a hash that names a page anchor (the skip link #main) as a jump, not a photo', () => {
    const withMain = [...slugs, 'main'];
    const isPageAnchor = (slug: string) => slug === 'main';
    expect(indexForHash('#main', withMain, isPageAnchor)).toBe(-1);
    expect(indexForHash('#main', withMain)).toBe(3);
    expect(indexForHash('#budi-demo-img-0001', withMain, isPageAnchor)).toBe(1);
  });

  it('finds the photo a hash names', () => {
    expect(indexForHash('#budi-demo-img-0001', slugs)).toBe(1);
    expect(indexForHash('#img-20260815-wa0003', slugs)).toBe(2);
  });

  it('matches a hash typed with capitals (slugs are lowercase)', () => {
    expect(indexForHash('#Budi-Demo-IMG-0001', slugs)).toBe(1);
  });

  it('ignores an empty or unknown hash', () => {
    expect(indexForHash('', slugs)).toBe(-1);
    expect(indexForHash('#', slugs)).toBe(-1);
    expect(indexForHash('#nope', slugs)).toBe(-1);
    expect(indexForHash('#main', slugs)).toBe(-1);
    expect(indexForHash('#alice-demo-img-0001', [])).toBe(-1);
  });
});

describe('withHash / withoutHash', () => {
  const page = 'https://example.github.io/pinus-album/albums/demo-event-a/day-1/';

  it('adds or replaces the hash, keeping path and query', () => {
    expect(withHash(page, 'alice-demo-img-0001')).toBe(`${page}#alice-demo-img-0001`);
    expect(withHash(`${page}?x=1#old`, 'new')).toBe(`${page}?x=1#new`);
  });

  it('removes the hash', () => {
    expect(withoutHash(`${page}#alice-demo-img-0001`)).toBe(page);
    expect(withoutHash(`${page}?x=1#`)).toBe(`${page}?x=1`);
    expect(withoutHash(page)).toBe(page);
  });
});
