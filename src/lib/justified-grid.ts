/**
 * Justified photo grid (TRD §6.4): rows of whole, uncropped photos, every row exactly as wide
 * as the grid. PURE: aspect ratios in, numbers out. PhotoGrid.astro uses it at build time, and
 * the photographer filter (scripts/viewer/chips.ts) again in the browser for the photos left.
 *
 * Rows are chosen for each layout (phone, tablet, desktop) and expressed as each tile's share
 * of the grid width. Shares scale with the grid, so a layout holds at any window width with no
 * script and nothing shifting while images load.
 */

/**
 * A row's "fullness" is the sum of its photos' aspect ratios: a row of fullness F across a grid
 * W wide is W / F tall. `ideal` is the fullness rows aim for (6 = four 3:2 photos side by side).
 * `fullest` limits how tall a lone row may get: see `sharesFor`.
 */
export interface RowRule {
  ideal: number;
  fullest: number;
}

export const ROW_RULES = {
  phone: { ideal: 3, fullest: 0.6 },
  tablet: { ideal: 4.5, fullest: 2 },
  desktop: { ideal: 6, fullest: 2.4 },
} as const satisfies Record<string, RowRule>;

export type GridLayout = keyof typeof ROW_RULES;

/** A tile's share of the grid width (0–1) in each layout. */
export type TileShares = Record<GridLayout, number>;

/** Four decimals: a fraction of a pixel across the widest grid, and short in the HTML. */
const rounded = (value: number): number => Math.round(value * 10_000) / 10_000;

/** Width / height, rounded so the value read back from a tile's style is the same number. */
export const aspectOf = (width: number, height: number): number => rounded(width / height);

/**
 * Splits photos, in order, into rows as close to `ideal` fullness as possible, returning each
 * row's length. Looks at all the rows together (shortest path from each photo to the end) rather
 * than filling one row at a time, so the last row is balanced like the others instead of being
 * left with one stray photo.
 */
export function breakRows(aspects: readonly number[], ideal: number): number[] {
  const count = aspects.length;
  const cost = new Array<number>(count + 1).fill(Infinity);
  const rowEnd = new Array<number>(count + 1).fill(count);
  cost[count] = 0;

  for (let start = count - 1; start >= 0; start--) {
    let fullness = 0;
    for (let end = start + 1; end <= count; end++) {
      fullness += aspects[end - 1]!;
      // Squared log: a row twice too full is as bad as one half full.
      const total = Math.log(fullness / ideal) ** 2 + cost[end]!;
      if (total < cost[start]!) {
        cost[start] = total;
        rowEnd[start] = end;
      }
      if (fullness >= ideal * 2) break;
    }
  }

  const rows: number[] = [];
  for (let start = 0; start < count; start = rowEnd[start]!) rows.push(rowEnd[start]! - start);
  return rows;
}

/**
 * Each tile's share of the grid width under one rule. Every row fills the grid, except when all
 * the photos fit in a single row less full than `fullest`: stretching one or two photos across
 * a desktop would make them taller than the window, so that row keeps a sensible height and
 * leaves the rest of the line empty.
 */
function sharesFor(aspects: readonly number[], rule: RowRule): number[] {
  const rows = breakRows(aspects, rule.ideal);
  const shares: number[] = [];
  let start = 0;
  for (const length of rows) {
    const row = aspects.slice(start, start + length);
    const fullness = row.reduce((sum, aspect) => sum + aspect, 0);
    const divisor = rows.length === 1 ? Math.max(fullness, rule.fullest) : fullness;
    shares.push(...row.map((aspect) => rounded(aspect / divisor)));
    start += length;
  }
  return shares;
}

/** The width shares of every tile, in the order given, in each layout. */
export function tileShares(aspects: readonly number[]): TileShares[] {
  const phone = sharesFor(aspects, ROW_RULES.phone);
  const tablet = sharesFor(aspects, ROW_RULES.tablet);
  const desktop = sharesFor(aspects, ROW_RULES.desktop);
  return aspects.map((_, index) => ({ phone: phone[index]!, tablet: tablet[index]!, desktop: desktop[index]! }));
}

/** The inline style of a tile's list item; PhotoGrid.astro's CSS turns it into the layout. */
export function tileStyle(aspect: number, shares: TileShares): string {
  return `--aspect:${aspect};--share-phone:${shares.phone};--share-tablet:${shares.tablet};--share-desktop:${shares.desktop}`;
}
