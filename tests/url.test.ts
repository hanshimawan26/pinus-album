import { describe, expect, it } from 'vitest';
import { albumUrl, withBase } from '../src/lib/url.ts';

describe('withBase', () => {
  it('prefixes paths with a sub-path base', () => {
    expect(withBase('albums/a/', '/pinus-album/')).toBe('/pinus-album/albums/a/');
  });

  it('tolerates a base without a trailing slash and paths with a leading slash', () => {
    expect(withBase('/albums/a/', '/pinus-album')).toBe('/pinus-album/albums/a/');
  });

  it('works at the domain root', () => {
    expect(withBase('', '/')).toBe('/');
    expect(withBase('404.html', '/')).toBe('/404.html');
  });
});

describe('albumUrl', () => {
  it('joins segments with a trailing slash', () => {
    expect(albumUrl(['demo-event-a', 'day-1'], '/x/')).toBe('/x/albums/demo-event-a/day-1/');
  });

  it('returns home for an empty path', () => {
    expect(albumUrl([], '/x/')).toBe('/x/');
  });
});
