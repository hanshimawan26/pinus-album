/**
 * The post viewer's behaviour (TRD §6.5, §6.6): opening from a tile or a deep link,
 * navigation (buttons, ← / → keys, swipe), closing (✕, Esc, backdrop, browser Back), the URL
 * hash, focus and the caption's "more".
 *
 * The history rules are pure functions in `history.ts`; this class carries them out.
 *
 * Positions: the viewer moves through a sequence of the grid's photos, in grid order. That is
 * every photo, unless the photographer filter (chips.ts) limits it with `showOnly()`; then the
 * counter, the arrows and deep links cover only the photos left in the grid.
 *
 * Focus: the close button gets focus on open; Tab cycles inside the dialog; a control that
 * disappears while focused (an arrow at an end, the Instagram link, "more", "Try again")
 * hands focus to a stable control; on close, focus returns to the tile of the photo shown
 * last (scrolled into view if needed).
 */
import type { ViewerData, ViewerPhoto } from '../../lib/viewer-data.ts';
import { focusableIn, isRendered, setShown, type ViewerElements } from './dom.ts';
import { wrapFocus } from './focus-order.ts';
import { attachSwipe } from './gestures.ts';
import { indexForHash, withHash, withoutHash } from './hash.ts';
import { closeAction, loadAction, markedState, syncAction } from './history.ts';
import { PhotoDisplay, Preloader } from './image.ts';
import { clampIndex, hasNext, hasPrevious, neighbours, photoLabel, step } from './navigation.ts';
import { lockScroll, unlockScroll } from './scroll-lock.ts';
import { renderPhoto } from './view.ts';

/** A fragment that names an element on the page (the skip link's `#main`) is not a photo. */
const isPageAnchor = (slug: string): boolean => document.getElementById(slug) !== null;

export class PostViewer {
  readonly #elements: ViewerElements;
  readonly #data: ViewerData;
  readonly #tiles: ReadonlyMap<number, HTMLElement>;
  /** Indexes into `#data.photos` (= tile `data-index`) that the viewer moves through. */
  #sequence: number[];
  /** Slugs of the photos in `#sequence`, in the same order. */
  #slugs: string[];
  readonly #display: PhotoDisplay;
  readonly #preloader = new Preloader();

  /** Position of the shown photo in `#sequence`. */
  #position = 0;
  #captionExpanded = false;
  /** Set when the viewer closes because the URL changed (Back), so history is left alone. */
  #closingFromHistory = false;
  /** After our own `history.back()`, the tile to keep in view once the browser has scrolled. */
  #tileToReveal: HTMLElement | null = null;
  #pressedOnBackdrop = false;
  #releasedOnBackdrop = false;
  #resizeFrame = 0;

  constructor(elements: ViewerElements, data: ViewerData, tiles: ReadonlyMap<number, HTMLElement>) {
    this.#elements = elements;
    this.#data = data;
    this.#tiles = tiles;
    this.#sequence = data.photos.map((_, index) => index);
    this.#slugs = data.photos.map((photo) => photo.slug);
    this.#display = new PhotoDisplay(elements.stage, elements.image, elements.error);
    this.#bindEvents();
  }

  get #total(): number {
    return this.#sequence.length;
  }

  #photoAt(position: number): ViewerPhoto | undefined {
    const index = this.#sequence[position];
    return index === undefined ? undefined : this.#data.photos[index];
  }

  get isOpen(): boolean {
    return this.#elements.dialog.open;
  }

  /** Opens the photo of a clicked tile (its `data-index`) and adds `#<slug>` to history. */
  openFromTile(tileIndex: number): void {
    const position = this.#sequence.indexOf(tileIndex);
    if (position === -1) return;
    this.#open(position);
    history.pushState(markedState(history.state), '', withHash(location.href, this.#slugs[this.#position] ?? ''));
  }

  /**
   * Limits the viewer to some of the grid's photos (tile indexes, in grid order): the photos
   * the photographer filter left. The filter sits behind the modal viewer, so this happens
   * only while it is closed.
   */
  showOnly(tileIndexes: readonly number[]): void {
    if (this.isOpen) return;
    this.#sequence = tileIndexes.filter((index) => this.#data.photos[index] !== undefined);
    this.#slugs = this.#sequence.map((index) => this.#data.photos[index]?.slug ?? '');
    this.#position = 0;
  }

  /** On page load: opens the photo named by the URL hash, if any (an invalid hash is ignored). */
  openFromLocation(): void {
    const index = this.#indexForLocation();
    const action = loadAction({ state: history.state, index });
    if (action === 'ignore') return;
    if (action === 'arrange') {
      // "page, then page#photo": Back closes the viewer and stays on the page.
      history.replaceState(history.state, '', withoutHash(location.href));
      history.pushState(markedState(history.state), '', withHash(location.href, this.#slugs[index] ?? ''));
    }
    this.#open(index);
  }

  /** Moves `delta` photos forward or back; does nothing past either end. */
  go(delta: number): void {
    const target = step(this.#position, delta, this.#total);
    if (target === null || target === this.#position || !this.isOpen) return;
    this.#showAndAnnounce(target);
    history.replaceState(history.state, '', withHash(location.href, this.#slugs[target] ?? ''));
  }

  close(): void {
    if (this.isOpen) this.#elements.dialog.close(); // → #handleClose
  }

  #indexForLocation(): number {
    return indexForHash(location.hash, this.#slugs, isPageAnchor);
  }

  // -------------------------------------------------------------------------------------
  // Opening, moving, closing
  // -------------------------------------------------------------------------------------

  #open(position: number): void {
    const { dialog, close } = this.#elements;
    this.#show(clampIndex(position, this.#total));
    if (this.isOpen) return;
    this.#tileToReveal = null;
    lockScroll();
    dialog.showModal();
    close.focus();
    this.#updateMore();
    window.addEventListener('resize', this.#onResize);
    // On the document, not the dialog: keys keep working even if focus ever lands on <body>.
    document.addEventListener('keydown', this.#onKeydown);
  }

  /** Every move to another photo while open (keys, buttons, swipe, Back/Forward) is announced. */
  #showAndAnnounce(position: number): void {
    this.#show(position);
    const photo = this.#photoAt(position);
    if (photo) this.#elements.announce.textContent = photoLabel(photo, position, this.#total);
  }

  #show(position: number): void {
    const photo = this.#photoAt(position);
    if (!photo) return;
    this.#keepingFocus(() => {
      this.#position = position;
      renderPhoto(this.#elements, photo, { index: position, total: this.#total }, photo.context ?? this.#data.context);
      this.#display.show(photo.image, photo.alt);
      this.#setCaptionExpanded(false);
    });
    for (const neighbour of neighbours(position, this.#total)) {
      const next = this.#photoAt(neighbour);
      if (next) this.#preloader.preload(next.image);
    }
  }

  /** The dialog has closed, by any route (✕, Esc, backdrop, Back). */
  #handleClose = (): void => {
    window.removeEventListener('resize', this.#onResize);
    document.removeEventListener('keydown', this.#onKeydown);
    unlockScroll();
    this.#elements.announce.textContent = '';
    const tile = this.#tiles.get(this.#sequence[this.#position] ?? -1) ?? null;
    if (tile) {
      tile.focus({ preventScroll: true });
      tile.scrollIntoView({ block: 'nearest' });
    }

    const action = closeAction({ fromHistory: this.#closingFromHistory, state: history.state, hash: location.hash });
    this.#closingFromHistory = false;
    if (action === 'back') {
      this.#tileToReveal = tile;
      history.back(); // → popstate, which finds no photo hash
    } else if (action === 'clear-hash') {
      history.replaceState(history.state, '', withoutHash(location.href));
    }
  };

  /** Back, Forward, or an edited hash (`popstate`, `hashchange`): make the viewer match the URL. */
  #syncWithLocation = (event: Event): void => {
    const index = this.#indexForLocation();
    switch (syncAction({ index, isOpen: this.isOpen, current: this.#position })) {
      case 'close':
        this.#closingFromHistory = true;
        this.close();
        break;
      case 'settle':
        // After our own history.back(), the browser restores the scroll position it saved
        // when the viewer opened. Chrome does that after `popstate` and before `hashchange`,
        // so the tile of the photo shown last is revealed on both, then forgotten.
        this.#tileToReveal?.scrollIntoView({ block: 'nearest' });
        if (event.type === 'hashchange') this.#tileToReveal = null;
        break;
      case 'open':
        this.#open(index);
        break;
      case 'move':
        this.#showAndAnnounce(index);
        break;
      case 'stay':
        break;
    }
  };

  // -------------------------------------------------------------------------------------
  // Caption "more"
  // -------------------------------------------------------------------------------------

  #setCaptionExpanded(expanded: boolean): void {
    const { caption, more } = this.#elements;
    this.#captionExpanded = expanded;
    caption.classList.toggle('is-clamped', !expanded);
    more.textContent = expanded ? 'less' : 'more';
    more.setAttribute('aria-expanded', String(expanded));
    this.#updateMore();
  }

  /** "more" appears only when the clamped caption really overflows its 3 lines. */
  #updateMore(): void {
    const { caption, captionBlock, more } = this.#elements;
    if (!this.isOpen || captionBlock.hidden) {
      setShown(more, false);
      return;
    }
    setShown(more, this.#captionExpanded || caption.scrollHeight > caption.clientHeight + 1);
  }

  #onResize = (): void => {
    cancelAnimationFrame(this.#resizeFrame);
    this.#resizeFrame = requestAnimationFrame(() => this.#keepingFocus(() => this.#updateMore()));
  };

  // -------------------------------------------------------------------------------------
  // Focus and keys
  // -------------------------------------------------------------------------------------

  /**
   * Runs `change`, which may hide or detach the focused control (an arrow at an end, the
   * Instagram link of a photographer without one, "more" for a short caption, "Try again").
   * Focus then moves to a stable control instead of dropping to `<body>`: the next arrow,
   * else the previous one, else ✕.
   */
  #keepingFocus(change: () => void): void {
    const { dialog, previous, next, close } = this.#elements;
    // Read before the change: Chrome's focus fix-up runs at the next layout, after which
    // `activeElement` is already <body>.
    const focused = document.activeElement;
    const wasInside = focused instanceof HTMLElement && focused !== dialog && dialog.contains(focused);
    change();
    if (!wasInside || !this.isOpen || isRendered(focused)) return;
    const fallback = [next, previous, close].find((control) => isRendered(control)) ?? close;
    fallback.focus();
  }

  #trapTab(event: KeyboardEvent): void {
    const focusable = focusableIn(this.#elements.dialog);
    const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = wrapFocus(focusable, current, event.shiftKey);
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return; // Alt+← is the browser's Back
    const moves: Record<string, () => void> = {
      ArrowLeft: () => this.go(-1),
      ArrowRight: () => this.go(1),
      Home: () => this.go(-this.#position),
      End: () => this.go(this.#total - 1 - this.#position),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      move();
    } else if (event.key === 'Tab') {
      this.#trapTab(event);
    }
  };

  // -------------------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------------------

  #bindEvents(): void {
    const { dialog, close, previous, next, more, retry, stage, image } = this.#elements;

    dialog.addEventListener('close', this.#handleClose);
    close.addEventListener('click', () => this.close());
    previous.addEventListener('click', () => this.go(-1));
    next.addEventListener('click', () => this.go(1));
    more.addEventListener('click', () => this.#setCaptionExpanded(!this.#captionExpanded));
    retry.addEventListener('click', () => this.#keepingFocus(() => this.#display.retry()));

    // Backdrop: the dialog element itself is only hit outside the frame. Both the press and
    // the release must be there: a click whose press and release land on different elements
    // is dispatched to their common ancestor (the dialog), so the click target alone is not
    // enough. Dragging out of a caption selection, or into the frame, never closes it.
    dialog.addEventListener('pointerdown', (event) => {
      this.#pressedOnBackdrop = event.target === dialog;
    });
    dialog.addEventListener('pointerup', (event) => {
      this.#releasedOnBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && this.#pressedOnBackdrop && this.#releasedOnBackdrop) this.close();
      this.#pressedOnBackdrop = false;
      this.#releasedOnBackdrop = false;
    });

    attachSwipe(stage, image, {
      ends: () => ({ hasPrevious: hasPrevious(this.#position), hasNext: hasNext(this.#position, this.#total) }),
      onSwipe: (direction) => this.go(direction === 'next' ? 1 : -1),
    });

    window.addEventListener('popstate', this.#syncWithLocation);
    window.addEventListener('hashchange', this.#syncWithLocation);
  }
}
