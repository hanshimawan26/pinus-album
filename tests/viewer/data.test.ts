import { describe, expect, it } from 'vitest';
import { isInstagramUrl, parseViewerData } from '../../src/scripts/viewer/data.ts';
import { jsonForScript } from '../../src/lib/presentation.ts';
import type { ViewerData } from '../../src/lib/viewer-data.ts';

const image = { src: '/a/1.webp', srcset: '/a/1.webp 800w', sizes: '100vw', width: 800, height: 533 };

const valid: ViewerData = {
  context: 'Day 1 · Demo Event A',
  photos: [
    {
      slug: 'alice-demo-img-0001',
      image,
      alt: 'Opening',
      caption: 'Line one\nline two 🎉 <b>not html</b>',
      photographer: {
        name: 'Alice (Demo)',
        initials: 'AD',
        instagramUrl: 'https://www.instagram.com/alice.demo.placeholder/',
      },
      date: { label: '20 Sep 2026', iso: '2026-09-20' },
    },
    { slug: 'img-20260815-wa0003', image, alt: 'Photo from Demo Event B' },
  ],
};

describe('parseViewerData', () => {
  it('reads the data exactly as the page embeds it (escaped JSON)', () => {
    expect(parseViewerData(jsonForScript(valid))).toEqual(valid);
  });

  it('returns null for missing or broken JSON', () => {
    expect(parseViewerData(null)).toBeNull();
    expect(parseViewerData(undefined)).toBeNull();
    expect(parseViewerData('')).toBeNull();
    expect(parseViewerData('{"context":')).toBeNull();
    expect(parseViewerData('[]')).toBeNull();
  });

  it('returns null when a photo is malformed, rather than dropping it (indexes must match tiles)', () => {
    const broken = structuredClone(valid) as unknown as { photos: Array<Record<string, unknown>> };
    delete broken.photos[1]?.slug;
    expect(parseViewerData(JSON.stringify(broken))).toBeNull();

    const noSize = structuredClone(valid);
    (noSize.photos[0] as { image: { width: number } }).image.width = 0;
    expect(parseViewerData(JSON.stringify(noSize))).toBeNull();

    const emptyCaption = structuredClone(valid);
    (emptyCaption.photos[0] as { caption: string }).caption = '';
    expect(parseViewerData(JSON.stringify(emptyCaption))).toBeNull();
  });

  it('returns null for an empty photo list', () => {
    expect(parseViewerData(JSON.stringify({ context: '', photos: [] }))).toBeNull();
  });

  it('rejects a photographer link that is not an Instagram https URL', () => {
    const bad = structuredClone(valid);
    (bad.photos[0] as { photographer: { instagramUrl: string } }).photographer.instagramUrl = 'javascript:alert(1)';
    expect(parseViewerData(JSON.stringify(bad))).toBeNull();
  });
});

describe('isInstagramUrl', () => {
  it('accepts Instagram profile URLs over https', () => {
    expect(isInstagramUrl('https://www.instagram.com/alice.demo.placeholder/')).toBe(true);
    expect(isInstagramUrl('https://instagram.com/andi_pratama')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isInstagramUrl('http://www.instagram.com/andi/')).toBe(false);
    expect(isInstagramUrl('https://evil.example/instagram.com/andi')).toBe(false);
    expect(isInstagramUrl('https://www.instagram.com.evil.example/andi')).toBe(false);
    expect(isInstagramUrl('javascript:alert(1)')).toBe(false);
    expect(isInstagramUrl(undefined)).toBe(false);
  });
});
