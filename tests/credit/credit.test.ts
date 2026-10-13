import { describe, expect, it } from 'vitest';
import { creditFor, fittedFontSize, watermarkLayout, watermarkMarkup, watermarkPosition } from '../../src/lib/credit/credit.ts';

describe('creditFor', () => {
  it('credits the display name as Artist and © Name as Copyright', () => {
    expect(creditFor('Andi Pratama')).toEqual({ artist: 'Andi Pratama', copyright: '© Andi Pratama' });
  });

  it('tidies spaces, and gives no credit for a blank or missing name', () => {
    expect(creditFor('  Sari \n Wijaya ')).toEqual({ artist: 'Sari Wijaya', copyright: '© Sari Wijaya' });
    expect(creditFor('   ')).toBeUndefined();
    expect(creditFor(undefined)).toBeUndefined();
  });
});

describe('watermarkLayout', () => {
  it('scales with the short edge, so every srcset width looks the same', () => {
    const large = watermarkLayout(2000, 1333);
    const medium = watermarkLayout(1200, 800);
    expect(large.fontSize).toBe(32);
    expect(large.fontSize / 1333).toBeCloseTo(medium.fontSize / 800, 2);
    // Portrait: the short edge is the width.
    expect(watermarkLayout(1333, 2000).fontSize).toBe(large.fontSize);
  });

  it('never goes below a readable size', () => {
    expect(watermarkLayout(400, 300).fontSize).toBe(14);
  });
});

describe('fittedFontSize', () => {
  const layout = watermarkLayout(800, 1200); // 19 px, margin 15 px

  it('keeps the size when the text fits', () => {
    expect(fittedFontSize(layout, 800, 300)).toBe(layout.fontSize);
  });

  it('shrinks a very long name to fit between the margins', () => {
    const size = fittedFontSize(layout, 800, 1540);
    expect(size).toBeLessThan(layout.fontSize);
    expect((1540 * size) / layout.fontSize).toBeLessThanOrEqual(800 - 2 * layout.margin);
  });
});

describe('watermarkPosition', () => {
  it('places the text in the bottom-right corner, inside the margins', () => {
    const layout = watermarkLayout(800, 533);
    expect(watermarkPosition(layout, { width: 800, height: 533 }, { width: 120, height: 17 })).toEqual({
      left: 800 - layout.margin - 120,
      top: 533 - layout.margin - 17,
    });
  });

  it('never places it outside the image', () => {
    const layout = watermarkLayout(100, 100);
    expect(watermarkPosition(layout, { width: 100, height: 100 }, { width: 200, height: 200 })).toEqual({ left: 0, top: 0 });
  });
});

describe('watermarkMarkup', () => {
  it('escapes the name, so it is drawn as text and not read as markup', () => {
    expect(watermarkMarkup('© Tom & <Jerry>', '#FFFFFF', 85)).toBe(
      '<span foreground="#FFFFFF" alpha="85%">© Tom &amp; &lt;Jerry&gt;</span>',
    );
  });
});
