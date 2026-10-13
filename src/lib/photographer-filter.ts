/**
 * Photographer filter chips above a photo grid (TRD §6.3 item 8). PURE: the photos of a grid
 * in, the chips out. The filtering itself happens in the browser (src/scripts/viewer/filter.ts).
 */
import type { Photo } from './content/types.ts';

export interface PhotographerChip {
  /** Photographer slug; tiles carry it as `data-photographer`. */
  slug: string;
  name: string;
  /** Photos by this photographer in the grid. */
  count: number;
}

const collator = new Intl.Collator('en', { sensitivity: 'base' });

/**
 * One chip per photographer credited in the grid, most photos first, then by name. Empty
 * when fewer than two photographers are credited: a filter with one choice filters nothing.
 * Photos without a credit get no chip (absent data disappears, TRD §4.6); they show under "All".
 */
export function photographerChips(photos: readonly Pick<Photo, 'photographer'>[]): PhotographerChip[] {
  const chips = new Map<string, PhotographerChip>();
  for (const { photographer } of photos) {
    if (!photographer) continue;
    const chip = chips.get(photographer.slug);
    if (chip) chip.count++;
    else chips.set(photographer.slug, { slug: photographer.slug, name: photographer.name, count: 1 });
  }
  if (chips.size < 2) return [];
  return [...chips.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name) || (a.slug < b.slug ? -1 : 1));
}
