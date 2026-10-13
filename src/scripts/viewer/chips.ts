/**
 * Photographer filter chips above a photo grid (TRD §6.3 item 8). PhotoGrid renders them
 * with the `hidden` attribute, because without JavaScript they could not work; this shows
 * them. Pressing a chip hides the tiles of every other photographer and reports the photos
 * left (as tile indexes) to `onChange`, so the viewer moves through those only. Pressing the
 * pressed chip again shows all photos. The rules are the pure functions in `filter.ts`.
 */
import { ALL, filterStatus, visibleIndexes } from './filter.ts';

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
    const shown = new Set(indexes);
    tiles.forEach((tile, index) => {
      (tile.closest('li') ?? tile).hidden = !shown.has(index);
    });
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
