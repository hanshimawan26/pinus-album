import { describe, expect, it } from 'vitest';
import { normaliseBasePath } from '../src/lib/config.ts';
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

describe('normaliseBasePath (BASE_PATH, TRD §8)', () => {
  it('adds the slashes a base needs', () => {
    expect(normaliseBasePath('pinus-album')).toBe('/pinus-album/');
    expect(normaliseBasePath('/pinus-album')).toBe('/pinus-album/');
    expect(normaliseBasePath(' /a/b// ')).toBe('/a/b/');
  });

  it('treats empty and "/" as the domain root', () => {
    expect(normaliseBasePath('')).toBe('/');
    expect(normaliseBasePath('/')).toBe('/');
  });
});
