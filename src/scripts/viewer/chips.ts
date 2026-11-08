/**
 * Photographer filter chips above a photo grid (TRD §6.3 item 8). PhotoGrid renders them
 * with the `hidden` attribute, because without JavaScript they could not work; this shows
 * them. Pressing a chip hides the tiles of every other photographer, lays the photos left out
 * in fresh full-width rows and reports them (as tile indexes) to `onChange`, so the viewer moves
 * through those only. Pressing the pressed chip again shows all photos. The rules are the pure
 * functions in `filter.ts` and `justified-grid.ts`.
 */
import { thumbnailSizes } from '../../lib/image-sizes.ts';
import { tileShares, tileStyle } from '../../lib/justified-grid.ts';
import { ALL, filterStatus, visibleIndexes } from './filter.ts';

/** Hides the tiles not in `indexes` and gives those that are the rows they now form. */
function showTiles(tiles: readonly HTMLElement[], indexes: readonly number[]): void {
  const items = tiles.map((tile) => tile.closest('li') ?? tile);
  const aspects = indexes.map((index) => Number(items[index]?.style.getPropertyValue('--aspect')));
  const shares = tileShares(aspects);
  items.forEach((item) => (item.hidden = true));
  indexes.forEach((index, position) => {
    const item = items[index];
    const share = shares[position];
    const aspect = aspects[position];
    if (!item || !share || aspect === undefined) return;
    item.hidden = false;
    item.style.cssText = tileStyle(aspect, share);
    item.querySelector('img')?.setAttribute('sizes', thumbnailSizes(share));
  });
}

export function initPhotographerFilter(grid: Element, onChange: (indexes: number[]) => void): void {
  const group = document.querySelector<HTMLElement>('[data-photo-filter]');
  if (!group) return;
  const chips = [...group.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
  const allChip = chips.find((chip) => chip.dataset.filter === ALL);
  const status = document.querySelector('[data-filter-status]');
  // Tiles in grid order: tile i has data-index i.
  const tiles = [...grid.querySelectorAll<HTMLElement>('[data-index]')];
  const photographers = tiles.map((tile) => tile.dataset.photographer ?? ALL);
  if (!allChip || chips.length < 2) return;

  const select = (pressed: HTMLButtonElement) => {
    const selected = pressed.dataset.filter ?? ALL;
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip === pressed));
    const indexes = visibleIndexes(photographers, selected);
    showTiles(tiles, indexes);
    if (status) status.textContent = filterStatus(indexes.length, selected === ALL ? undefined : pressed.dataset.name);
    onChange(indexes);
  };

  group.addEventListener('click', (event) => {
    const chip = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-filter]') : null;
    if (!chip || !group.contains(chip)) return;
    const isPressed = chip.getAttribute('aria-pressed') === 'true';
    if (!isPressed) select(chip);
    else if (chip !== allChip) select(allChip);
  });
  group.hidden = false;
}
