import { describe, expect, it } from 'vitest';
import { aspectOf, breakRows, ROW_RULES, tileShares, tileStyle } from '../src/lib/justified-grid.ts';

const landscape = 1.5;
const portrait = 0.6667;
const repeat = (aspect: number, times: number) => new Array<number>(times).fill(aspect);
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Each row's shares in one layout, using the same row breaks as `tileShares`. */
function rowsOf(aspects: readonly number[], layout: keyof typeof ROW_RULES): number[][] {
  const shares = tileShares(aspects).map((tile) => tile[layout]);
  let start = 0;
  return breakRows(aspects, ROW_RULES[layout].ideal).map((length) => {
    const row = shares.slice(start, start + length);
    start += length;
    return row;
  });
}

describe('breakRows', () => {
  it('puts same-shaped photos in even rows', () => {
    expect(breakRows(repeat(landscape, 8), ROW_RULES.desktop.ideal)).toEqual([4, 4]);
    expect(breakRows(repeat(landscape, 6), ROW_RULES.phone.ideal)).toEqual([2, 2, 2]);
  });

  it('keeps every photo, in order', () => {
    const aspects = [1.5, 0.67, 1.5, 1.78, 0.67, 0.67, 1, 1.5, 1.33];
    expect(sum(breakRows(aspects, ROW_RULES.tablet.ideal))).toBe(aspects.length);
  });

  it('does not strand one photo on the last row', () => {
    const rows = breakRows(repeat(landscape, 9), ROW_RULES.desktop.ideal);
    expect(rows[rows.length - 1]).toBeGreaterThan(1);
  });

  it('fits more portrait photos in a row than landscape ones', () => {
    const [portraits] = breakRows(repeat(portrait, 18), ROW_RULES.desktop.ideal);
    const [landscapes] = breakRows(repeat(landscape, 18), ROW_RULES.desktop.ideal);
    expect(portraits).toBeGreaterThan(landscapes ?? 0);
  });

  it('returns no rows for no photos', () => {
    expect(breakRows([], ROW_RULES.phone.ideal)).toEqual([]);
  });
});

describe('tileShares', () => {
  const mixed = [1.5, 0.6667, 1.5, 1.5, 1.7778, 0.6667, 0.6667, 1.5, 1.5, 1.3333, 1.5, 1.5, 0.75, 1.5];

  it.each(['phone', 'tablet', 'desktop'] as const)('fills every row exactly on %s', (layout) => {
    for (const row of rowsOf(mixed, layout)) expect(sum(row)).toBeCloseTo(1, 2);
  });

  it('gives each tile a width in proportion to its shape, so nothing is cropped', () => {
    for (const row of rowsOf([1.5, 0.75, 1.5, 0.75], 'desktop')) {
      if (row.length === 4) expect(row[0]! / row[1]!).toBeCloseTo(2, 2);
    }
  });

  it('stretches a lone row on a phone, where it is no taller than the screen', () => {
    expect(tileShares([portrait])[0]?.phone).toBe(1);
  });

  it('keeps a lone photo from filling a desktop, where it would be taller than the window', () => {
    expect(tileShares([portrait])[0]?.desktop).toBeCloseTo(portrait / ROW_RULES.desktop.fullest, 3);
    expect(tileShares([landscape])[0]?.desktop).toBeCloseTo(landscape / ROW_RULES.desktop.fullest, 3);
  });

  it('fills the row once the photos are enough to', () => {
    const shares = tileShares(repeat(landscape, 2)).map((tile) => tile.desktop);
    expect(sum(shares)).toBeCloseTo(1, 2);
  });

  it('returns one entry per photo', () => {
    expect(tileShares(mixed)).toHaveLength(mixed.length);
    expect(tileShares([])).toEqual([]);
  });
});

describe('aspectOf and tileStyle', () => {
  it('rounds to four decimals, so the number survives the trip through the style attribute', () => {
    const aspect = aspectOf(1067, 1600);
    expect(aspect).toBe(0.6669);
    expect(Number(String(aspect))).toBe(aspect);
  });

  it('writes the variables the grid CSS reads', () => {
    expect(tileStyle(1.5, { phone: 0.5, tablet: 0.3333, desktop: 0.25 })).toBe(
      '--aspect:1.5;--share-phone:0.5;--share-tablet:0.3333;--share-desktop:0.25',
    );
  });
});
