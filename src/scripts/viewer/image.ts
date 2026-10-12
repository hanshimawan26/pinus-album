/**
 * Showing and preloading the viewer's photos (TRD §6.5, §7).
 *
 * The stage reserves the photo's aspect ratio from its width and height before any byte
 * arrives, so nothing jumps. A photo that is already decoded (the usual case: neighbours
 * are preloaded) appears at once; a slow one fades in when it arrives, and the stage shows
 * a quiet loading ring meanwhile. A failed one shows a message with "Try again".
 */
import type { ViewerImage } from '../../lib/viewer-data.ts';

type StageState = 'ready' | 'loading' | 'error';

/**
 * Sets an image's responsive sources in the order browsers expect (`sizes`, then `srcset`,
 * then `src`), so the displayed image and a preloaded copy pick the same file.
 */
function setSources(element: HTMLImageElement, image: ViewerImage): void {
  element.sizes = image.sizes;
  element.srcset = image.srcset;
  element.src = image.src;
}

export class PhotoDisplay {
  readonly #stage: HTMLElement;
  readonly #element: HTMLImageElement;
  readonly #error: HTMLElement;
  #current: { image: ViewerImage; alt: string } | null = null;

  constructor(stage: HTMLElement, element: HTMLImageElement, error: HTMLElement) {
    this.#stage = stage;
    this.#element = element;
    this.#error = error;
    // One pair of listeners for every photo. `complete` is false while the newest request is
    // still pending, so a late event from a photo shown earlier is ignored.
    element.addEventListener('load', () => {
      if (element.complete && element.naturalWidth > 0) this.#setState('ready');
    });
    element.addEventListener('error', () => {
      if (element.complete && this.#current) this.#setState('error');
    });
  }

  show(image: ViewerImage, alt: string): void {
    this.#current = { image, alt };
    const element = this.#element;
    this.#stage.style.setProperty('--photo-ratio', `${image.width} / ${image.height}`);
    element.width = image.width;
    element.height = image.height;
    element.alt = alt;
    element.style.transform = '';
    setSources(element, image);
    // Already in memory (preloaded or shown before): no loading state, no fade.
    this.#setState(element.complete && element.naturalWidth > 0 ? 'ready' : 'loading');
  }

  /** Loads the current photo again after an error. */
  retry(): void {
    if (!this.#current) return;
    const { image, alt } = this.#current;
    this.#element.removeAttribute('srcset');
    this.#element.removeAttribute('src');
    this.show(image, alt);
  }

  #setState(state: StageState): void {
    this.#stage.dataset.state = state;
    this.#stage.setAttribute('aria-busy', String(state === 'loading'));
    this.#element.classList.toggle('is-pending', state === 'loading');
    this.#error.hidden = state !== 'error';
  }
}

/**
 * Fetches photos before they are shown. Only the last few preloaded images are kept
 * referenced (decoded photos are large on a phone); the browser's cache keeps the files.
 */
export class Preloader {
  readonly #limit: number;
  #recent: Array<{ src: string; element: HTMLImageElement }> = [];

  constructor(limit = 4) {
    this.#limit = limit;
  }

  preload(image: ViewerImage): void {
    if (this.#recent.some((entry) => entry.src === image.src)) return;
    const element = new Image();
    element.decoding = 'async';
    setSources(element, image);
    this.#recent = [...this.#recent, { src: image.src, element }].slice(-this.#limit);
  }
}
