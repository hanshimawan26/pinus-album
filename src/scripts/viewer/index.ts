/**
 * Entry point of the post viewer (TRD §6.5), loaded by PostViewer.astro: only album pages
 * with a photo grid ship it. Without JavaScript (or without `<dialog>` support) the grid
 * still shows every photo; the tiles just do not open the viewer.
 */
import { PostViewer } from './controller.ts';
import { parseViewerData } from './data.ts';
import { viewerElements } from './dom.ts';

/** The grid's tiles by their `data-index`, which is the photo's index in the viewer data. */
function tilesByIndex(grid: Element): Map<number, HTMLElement> {
  const tiles = new Map<number, HTMLElement>();
  for (const tile of grid.querySelectorAll<HTMLElement>('[data-index]')) {
    const index = Number(tile.dataset.index);
    if (Number.isInteger(index)) tiles.set(index, tile);
  }
  return tiles;
}

export function initPostViewer(): void {
  const dialog = document.querySelector('dialog[data-viewer]');
  const grid = document.querySelector('[data-photo-grid]');
  const data = parseViewerData(document.getElementById('viewer-data')?.textContent);
  if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== 'function' || !grid || !data) return;

  const viewer = new PostViewer(viewerElements(dialog), data, tilesByIndex(grid));

  grid.addEventListener('click', (event) => {
    const tile = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-index]') : null;
    if (!tile || !grid.contains(tile)) return;
    viewer.openFromTile(Number(tile.dataset.index));
  });

  viewer.openFromLocation();
}
