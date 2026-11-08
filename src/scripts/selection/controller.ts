/**
 * Selecting several photos of a grid and downloading them (TRD §6.4.1), like Google Photos.
 *
 * Starting: the check circle on a tile (shown on hover or keyboard focus) or tap-and-hold.
 * While selecting, a click anywhere on a tile toggles it instead of opening the viewer, and
 * shift-click adds a range. The rules live in the pure modules next to this file; this class
 * holds the state and applies it to the page.
 *
 * Tiles are found once, in grid order: tile i has `data-index` i, as in the viewer's data.
 */
import type { ViewerData } from '../../lib/viewer-data.ts';
import { required, setShown } from '../viewer/dom.ts';
import { barView, savedStatus, type Phase } from './bar-view.ts';
import { deliveryFor } from './delivery.ts';
import { currentDevice, fetchPhotos, isDismissed, saveEach, saveUrl, saveZip, shareFiles } from './download.ts';
import {
  allShownSelected,
  deselectShown,
  dragTo,
  extendTo,
  inGridOrder,
  NOTHING_SELECTED,
  press,
  selectShown,
  toggle,
  type Selection,
} from './state.ts';
import { attachTouchSelect } from './touch.ts';
import type { ZipFile } from './zip.ts';

/**
 * A long press can be followed by a click on the tile under the finger when it lifts; that
 * click must not toggle the tile (the anchor). A quick tap on another tile is a real tap.
 */
const CLICK_AFTER_TOUCH_MS = 400;

interface BarElements {
  bar: HTMLElement;
  label: HTMLElement;
  selectAll: HTMLButtonElement;
  save: HTMLButtonElement;
  saveText: HTMLElement;
  close: HTMLButtonElement;
  status: HTMLElement;
}

function barElements(root: ParentNode): BarElements {
  return {
    bar: required(root, 'select-bar', HTMLElement),
    label: required(root, 'select-label', HTMLElement),
    selectAll: required(root, 'select-all', HTMLButtonElement),
    save: required(root, 'select-save', HTMLButtonElement),
    saveText: required(root, 'select-save-text', HTMLElement),
    close: required(root, 'select-close', HTMLButtonElement),
    status: required(root, 'select-status', HTMLElement),
  };
}

export class PhotoSelection {
  readonly #grid: HTMLElement;
  readonly #data: ViewerData;
  readonly #isViewerOpen: () => boolean;
  readonly #elements: BarElements;
  readonly #tiles: HTMLElement[];
  #visible: number[];

  #selection: Selection = NOTHING_SELECTED;
  #phase: Phase = 'idle';
  #done = 0;
  #failed = false;
  /** Fetched photos waiting for the second tap (phase `ready`). */
  #ready: ZipFile[] | null = null;
  /** The running download; replaced or cleared when it is cancelled. */
  #abort: AbortController | null = null;

  /** What the page currently shows, so a drag only touches the tiles that changed. */
  #painted: ReadonlySet<number> = new Set();
  #paintedSelecting = false;
  #dragBase: Selection = NOTHING_SELECTED;
  #dragFrom = 0;
  #ignoreClicksUntil = 0;

  constructor(grid: HTMLElement, data: ViewerData, isViewerOpen: () => boolean) {
    this.#grid = grid;
    this.#data = data;
    this.#isViewerOpen = isViewerOpen;
    this.#elements = barElements(document);
    this.#tiles = [...grid.querySelectorAll<HTMLElement>('[data-index]')];
    this.#visible = this.#tiles.map((_, index) => index);
    this.#bindEvents();
    grid.toggleAttribute('data-selectable', true); // without this script the circles stay hidden
  }

  /** The photographer filter changed which tiles are on screen (tile indexes, in grid order). */
  showOnly(indexes: readonly number[]): void {
    this.#visible = [...indexes];
    this.#render();
  }

  /**
   * A click inside the grid. Returns true when it belonged to the selection; false means the
   * tile should open the viewer as usual.
   */
  handleGridClick(event: MouseEvent): boolean {
    const element = event.target instanceof Element ? event.target : null;
    const index = this.#tileOf(element);
    if (index === null) return false;
    if (index === this.#selection.anchor && performance.now() < this.#ignoreClicksUntil) return true;
    if (this.#isDownloading) return true;
    if (this.#phase === 'idle' && !element?.closest('[data-select]')) return false;

    const range = event.shiftKey && this.#phase === 'selecting';
    this.#phase = 'selecting';
    this.#failed = false;
    this.#selection = range ? extendTo(this.#selection, this.#visible, index) : toggle(this.#selection, index);
    this.#settle();
    return true;
  }

  // -------------------------------------------------------------------------------------
  // Leaving and rendering
  // -------------------------------------------------------------------------------------

  /** The selection is frozen from the moment Download is pressed. */
  get #isDownloading(): boolean {
    return this.#phase === 'preparing' || this.#phase === 'ready' || this.#phase === 'saving';
  }

  /** Selecting ends by itself when the last photo is deselected. */
  #settle(): void {
    if (this.#selection.chosen.size === 0) this.#exit();
    else this.#render();
  }

  #exit(): void {
    this.#stopDownload();
    this.#selection = NOTHING_SELECTED;
    this.#phase = 'idle';
    this.#failed = false;
    this.#render();
  }

  #stopDownload(): void {
    this.#abort?.abort();
    this.#abort = null;
    this.#ready = null;
  }

  /** ✕ or Esc: stops a download in progress, otherwise leaves selecting. */
  #cancel(): void {
    if (this.#isDownloading) {
      this.#stopDownload();
      this.#phase = 'selecting';
      this.#render();
      return;
    }
    const tile = this.#tiles[this.#selection.anchor ?? this.#visible[0] ?? -1];
    this.#exit();
    tile?.focus({ preventScroll: true }); // the bar and the focused ✕ have just gone
  }

  #render(): void {
    const selecting = this.#phase !== 'idle';
    this.#paintTiles(selecting);
    const { bar, label, selectAll, save, saveText, status } = this.#elements;
    setShown(bar, selecting);
    if (!selecting) return;

    const view = barView({
      phase: this.#phase,
      count: this.#selection.chosen.size,
      done: this.#done,
      allShown: allShownSelected(this.#selection, this.#visible),
      failed: this.#failed,
    });
    bar.dataset.phase = this.#phase;
    label.textContent = view.label;
    status.textContent = view.label;
    saveText.textContent = view.saveText;
    save.disabled = view.saveDisabled;
    setShown(selectAll, view.showSelectAll);
    selectAll.textContent = view.selectAllText;
  }

  #paintTiles(selecting: boolean): void {
    const { chosen } = this.#selection;
    const modeChanged = selecting !== this.#paintedSelecting;
    this.#grid.toggleAttribute('data-selecting', selecting);
    this.#tiles.forEach((tile, index) => {
      const selected = chosen.has(index);
      if (!modeChanged && selected === this.#painted.has(index)) return;
      const item = tile.closest('li');
      item?.classList.toggle('is-selected', selected);
      item?.querySelector('[data-select]')?.setAttribute('aria-pressed', String(selected));
      // While selecting, a tile is a toggle rather than a door to the viewer.
      if (selecting) {
        tile.removeAttribute('aria-haspopup');
        tile.setAttribute('aria-pressed', String(selected));
      } else {
        tile.setAttribute('aria-haspopup', 'dialog');
        tile.removeAttribute('aria-pressed');
      }
    });
    this.#painted = chosen;
    this.#paintedSelecting = selecting;
  }

  // -------------------------------------------------------------------------------------
  // Downloading
  // -------------------------------------------------------------------------------------

  #onSave = (): void => {
    if (this.#phase === 'ready') void this.#share();
    else if (this.#phase === 'selecting') void this.#prepare();
  };

  async #prepare(): Promise<void> {
    const photos = inGridOrder(this.#selection).flatMap((index) => this.#data.photos[index]?.download ?? []);
    const delivery = deliveryFor(photos.length, currentDevice());
    const [first] = photos;
    if (delivery === 'file' && first) {
      saveUrl(first.src, first.fileName);
      this.#finish();
      return;
    }

    const abort = new AbortController();
    this.#abort = abort;
    this.#phase = delivery === 'files' ? 'saving' : 'preparing';
    this.#done = 0;
    this.#failed = false;
    this.#render();
    if (delivery === 'files') {
      const onProgress = (done: number): void => {
        this.#done = done;
        this.#render();
      };
      await saveEach(photos, { signal: abort.signal, onProgress });
      if (this.#abort === abort) this.#finish();
      return;
    }
    try {
      const files = await fetchPhotos(photos, {
        signal: abort.signal,
        onProgress: (done) => {
          if (this.#abort !== abort) return;
          this.#done = done;
          this.#render();
        },
      });
      if (this.#abort !== abort) return;
      if (delivery === 'share') {
        this.#ready = files;
        this.#phase = 'ready';
        this.#render();
      } else {
        saveZip(files, this.#data.archiveName);
        this.#finish();
      }
    } catch {
      abort.abort(); // the other parallel fetches are no longer wanted
      if (this.#abort !== abort) return; // cancelled with ✕: not a failure
      this.#abort = null;
      this.#phase = 'selecting';
      this.#failed = true;
      this.#render();
    }
  }

  async #share(): Promise<void> {
    const files = this.#ready;
    if (!files) return;
    try {
      await shareFiles(files);
    } catch (error) {
      if (isDismissed(error)) return; // the sheet was closed; the "Save" button stays
      saveZip(files, this.#data.archiveName); // this phone would not share them after all
    }
    this.#finish();
  }

  /** The photos have been handed over: selecting is done. */
  #finish(): void {
    const count = this.#selection.chosen.size;
    const tile = this.#tiles[this.#selection.anchor ?? -1];
    this.#exit();
    this.#elements.status.textContent = savedStatus(count);
    tile?.focus({ preventScroll: true });
  }

  // -------------------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------------------

  /** The tile an element belongs to: the tile itself, its photo, or its check circle. */
  #tileOf(element: Element | null): number | null {
    const tile = element?.closest('li')?.querySelector<HTMLElement>('[data-index]');
    if (!tile || !this.#grid.contains(tile)) return null;
    return Number(tile.dataset.index);
  }

  #bindEvents(): void {
    const { selectAll, save, close, bar } = this.#elements;
    close.addEventListener('click', () => this.#cancel());
    save.addEventListener('click', this.#onSave);
    selectAll.addEventListener('click', () => {
      const change = allShownSelected(this.#selection, this.#visible) ? deselectShown : selectShown;
      this.#selection = change(this.#selection, this.#visible);
      this.#failed = false;
      this.#settle();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.#phase !== 'idle' && !this.#isViewerOpen()) this.#cancel();
    });

    attachTouchSelect(this.#grid, {
      tileAt: (x, y) => this.#tileOf(document.elementFromPoint(x, y)),
      canStart: () => this.#phase === 'idle' || this.#phase === 'selecting',
      onStart: (index) => {
        this.#phase = 'selecting';
        this.#failed = false;
        this.#selection = press(this.#selection, index);
        this.#dragBase = this.#selection;
        this.#dragFrom = index;
        this.#render();
      },
      onMove: (index) => {
        this.#selection = dragTo(this.#dragBase, this.#visible, this.#dragFrom, index);
        this.#render();
      },
      onEnd: () => {
        this.#ignoreClicksUntil = performance.now() + CLICK_AFTER_TOUCH_MS;
      },
      topInset: () => bar.getBoundingClientRect().bottom,
    });
  }
}
