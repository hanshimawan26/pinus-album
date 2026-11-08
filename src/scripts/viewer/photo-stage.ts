/**
 * The photo area of the post viewer (TRD §6.5): PhotoSwipe, mounted inside the viewer's
 * stage. It owns everything a finger does to the photos (swipe, pinch, pan, double tap, swipe
 * away to close) and their loading. The rest of the viewer (details, URL, keys, focus) stays
 * in `controller.ts`, so PhotoSwipe's own keyboard, focus handling and interface are off.
 *
 * PhotoSwipe expects to fill the window; three things make it fit a box instead:
 * - its viewport is the stage's size, and a `ResizeObserver` follows the stage;
 * - pointer positions are corrected for where the stage is on the screen;
 * - the rest of the viewer fades along with the photo when it is swiped away.
 */
import PhotoSwipe from 'photoswipe';
import type { Slide } from './slides.ts';

export interface PhotoStageEvents {
  /** The photos moved to another position by a gesture. */
  onMove(position: number): void;
  /** A gesture closed the photos, and they have finished fading out. */
  onDismissed(): void;
}

type StageState = 'ready' | 'loading' | 'error';

/** Below this, the photo counts as being dragged away (a spring back can stop just short of 1). */
const FULLY_SHOWN = 0.995;

export class PhotoStage {
  readonly #dialog: HTMLElement;
  readonly #stage: HTMLElement;
  readonly #error: HTMLElement;
  readonly #events: PhotoStageEvents;
  #pswp: PhotoSwipe | null = null;
  /** The last position given to `#events.onMove` or asked for through `show`/`open`. */
  #position = 0;

  constructor(dialog: HTMLElement, stage: HTMLElement, error: HTMLElement, events: PhotoStageEvents) {
    this.#dialog = dialog;
    this.#stage = stage;
    this.#error = error;
    this.#events = events;
    new ResizeObserver(() => this.#pswp?.updateSize()).observe(stage);
    // In the capture phase, before PhotoSwipe reads the position: the stage moves when the
    // phone layout scrolls (a long caption).
    stage.addEventListener('pointerdown', () => this.#updateOffset(), true);
  }

  /** Opens the photos on `position`. The dialog must be open: PhotoSwipe measures the stage. */
  open(slides: Slide[], position: number): void {
    this.#position = position;
    const pswp = new PhotoSwipe({
      appendToEl: this.#stage,
      dataSource: slides,
      index: position,
      getViewportSizeFn: () => ({ x: this.#stage.clientWidth, y: this.#stage.clientHeight }),
      preload: [1, 1],
      loop: false,
      errorMsg: '', // the stage's own message, with "Try again"
      // Only the gestures: the viewer has its own controls, keys and focus handling.
      arrowPrev: false,
      arrowNext: false,
      close: false,
      zoom: false,
      counter: false,
      arrowKeys: false,
      escKey: false,
      trapFocus: false,
      returnFocus: false,
      tapAction: false,
      imageClickAction: 'zoom',
      bgClickAction: false,
      // The dialog fades in by itself; swiped away, the photo fades out with the viewer.
      showHideAnimationType: 'fade',
      showAnimationDuration: 0,
      hideAnimationDuration: Number.parseFloat(getComputedStyle(this.#stage).getPropertyValue('--duration-fast')),
    });
    this.#pswp = pswp;

    pswp.on('updateScrollOffset', () => {
      const box = this.#stage.getBoundingClientRect();
      pswp.offset.x += box.left;
      pswp.offset.y += box.top;
    });
    pswp.on('moveMainScroll', () => this.#reportMove(pswp));
    pswp.on('change', () => this.#updateState());
    pswp.on('loadComplete', () => this.#updateState());
    pswp.on('close', () => this.#startDismissing(pswp));
    pswp.on('destroy', () => this.#finishDismissing(pswp));
    this.#followFade(pswp);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) skipSprings(pswp);

    pswp.init();
    pswp.element?.removeAttribute('role'); // it sits inside the viewer's own <dialog>
    this.#updateOffset(); // init() overwrites what its first measurement corrected
    this.#updateState();
  }

  /** Prepares the stage for the photo at `position` and moves there (no animation). */
  show(position: number, width: number, height: number): void {
    this.#stage.style.setProperty('--photo-ratio', `${width} / ${height}`);
    this.#position = position;
    // Not when PhotoSwipe is already heading there: going to the same place stops its slide.
    if (this.#pswp && this.#pswp.potentialIndex !== position) this.#pswp.goTo(position);
  }

  /** Loads the current photo again after an error. */
  retry(): void {
    const pswp = this.#pswp;
    if (pswp) pswp.refreshSlideContent(pswp.currIndex);
  }

  /** Removes the photos at once (the viewer has closed). */
  close(): void {
    const pswp = this.#pswp;
    this.#forget();
    pswp?.destroy();
  }

  #forget(): void {
    this.#pswp = null;
    this.#dialog.removeAttribute('data-dismissing');
    this.#dialog.removeAttribute('data-closing');
    this.#dialog.style.removeProperty('--viewer-fade');
  }

  #updateOffset(): void {
    this.#pswp?.setScrollOffset(0, window.pageYOffset);
  }

  /**
   * Tells the viewer as soon as a slide starts (`potentialIndex`), not when it has landed
   * (`change`): the caption can change the stage's height, which is hidden during the slide
   * but would make the photo jump after it.
   */
  #reportMove(pswp: PhotoSwipe): void {
    if (pswp !== this.#pswp || pswp.potentialIndex === this.#position) return;
    this.#position = pswp.potentialIndex;
    this.#events.onMove(this.#position);
  }

  /** While a photo is dragged away, the details and the page's dimming fade with it. */
  #followFade(pswp: PhotoSwipe): void {
    const applyBgOpacity = pswp.applyBgOpacity.bind(pswp);
    pswp.applyBgOpacity = (opacity) => {
      applyBgOpacity(opacity);
      if (pswp !== this.#pswp) return;
      this.#dialog.toggleAttribute('data-dismissing', opacity < FULLY_SHOWN);
      this.#dialog.style.setProperty('--viewer-fade', String(Math.max(opacity, 0)));
    };
  }

  #startDismissing(pswp: PhotoSwipe): void {
    if (pswp !== this.#pswp) return;
    this.#dialog.setAttribute('data-dismissing', '');
    this.#dialog.setAttribute('data-closing', '');
    this.#dialog.style.setProperty('--viewer-fade', '0');
  }

  #finishDismissing(pswp: PhotoSwipe): void {
    if (pswp !== this.#pswp) return;
    this.#events.onDismissed();
    this.#forget();
  }

  #updateState(): void {
    const content = this.#pswp?.currSlide?.content;
    if (!content) return;
    this.#setState(content.isError() ? 'error' : content.state === 'loaded' ? 'ready' : 'loading');
  }

  #setState(state: StageState): void {
    this.#stage.dataset.state = state;
    this.#stage.setAttribute('aria-busy', String(state === 'loading'));
    this.#error.hidden = state !== 'error';
  }
}

/**
 * Reduced motion: PhotoSwipe already drops its zoom and open/close animations, but not the
 * springs that finish a swipe, so they jump straight to their end.
 */
function skipSprings(pswp: PhotoSwipe): void {
  pswp.animations.startSpring = ({ end, onUpdate, onComplete }) => {
    onUpdate(end);
    onComplete?.();
  };
}
