/**
 * The photographer filter's rules (TRD §6.3 item 8). PURE: no DOM, so Vitest imports it
 * directly. `chips.ts` applies them to the page.
 *
 * The filter picks one photographer at a time, like the chips on a profile page; `ALL`
 * shows every photo again. The viewer then moves only through the photos left in the grid.
 */

/** The "All" chip's value. Photographer slugs are never empty. */
export const ALL = '';

/**
 * Indexes of the tiles a filter shows, in grid order. `photographers[i]` is the slug of the
 * photographer of tile `i` (`''` when nobody is credited, so it shows only under "All").
 */
export function visibleIndexes(photographers: readonly string[], selected: string): number[] {
  const indexes: number[] = [];
  photographers.forEach((photographer, index) => {
    if (selected === ALL || photographer === selected) indexes.push(index);
  });
  return indexes;
}

/** What a screen reader hears after a chip is pressed: "Showing 24 photos by Rayhan Adi". */
export function filterStatus(count: number, name?: string): string {
  const photos = `${count} photo${count === 1 ? '' : 's'}`;
  return name ? `Showing ${photos} by ${name}` : `Showing all ${photos}`;
}
