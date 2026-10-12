/**
 * The viewer's elements, found once by their `data-*` hooks in PostViewer.astro, plus small
 * DOM helpers. Styling hooks are classes; behaviour hooks are `data-*` attributes.
 */

export interface ViewerElements {
  dialog: HTMLDialogElement;
  title: HTMLElement;
  credit: HTMLElement;
  avatar: HTMLElement;
  nameRow: HTMLElement;
  /** Detached unless the photographer has an Instagram handle. */
  nameLink: HTMLAnchorElement;
  nameLinkText: HTMLElement;
  nameText: HTMLElement;
  dateRow: HTMLElement;
  date: HTMLTimeElement;
  close: HTMLButtonElement;
  stage: HTMLElement;
  image: HTMLImageElement;
  error: HTMLElement;
  retry: HTMLButtonElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  captionBlock: HTMLElement;
  caption: HTMLElement;
  more: HTMLButtonElement;
  context: HTMLElement;
  counter: HTMLElement;
  announce: HTMLElement;
}

function required<T extends Element>(root: ParentNode, hook: string, type: new () => T): T {
  const element = root.querySelector(`[data-${hook}]`);
  if (!(element instanceof type)) throw new Error(`Post viewer: element [data-${hook}] is missing.`);
  return element;
}

/**
 * The photographer's Instagram link. It is attached to the name row only for a photographer
 * with a handle: an `<a>` without `href` would be an empty, uncrawlable link.
 */
function createNameLink(): { link: HTMLAnchorElement; text: HTMLElement } {
  const link = document.createElement('a');
  link.className = 'name-link';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.dataset.nameLink = '';
  const text = document.createElement('span');
  text.dataset.nameLinkText = '';
  const note = document.createElement('span');
  note.className = 'visually-hidden';
  note.textContent = ' on Instagram (opens in a new tab)';
  link.append(text, note);
  return { link, text };
}

/**
 * Finds every element of the viewer, and creates the ones that only make sense with data:
 * the photo's `<img>` (inside the stage) and the Instagram link (detached until needed).
 */
export function viewerElements(dialog: HTMLDialogElement): ViewerElements {
  const stage = required(dialog, 'stage', HTMLElement);
  const image = document.createElement('img');
  image.className = 'photo';
  image.alt = '';
  image.decoding = 'async';
  image.draggable = false;
  stage.prepend(image);
  const nameLink = createNameLink();

  return {
    dialog,
    title: required(dialog, 'title', HTMLElement),
    credit: required(dialog, 'credit', HTMLElement),
    avatar: required(dialog, 'avatar', HTMLElement),
    nameRow: required(dialog, 'name-row', HTMLElement),
    nameLink: nameLink.link,
    nameLinkText: nameLink.text,
    nameText: required(dialog, 'name-text', HTMLElement),
    dateRow: required(dialog, 'date-row', HTMLElement),
    date: required(dialog, 'date', HTMLTimeElement),
    close: required(dialog, 'close', HTMLButtonElement),
    stage,
    image,
    error: required(dialog, 'error', HTMLElement),
    retry: required(dialog, 'retry', HTMLButtonElement),
    previous: required(dialog, 'previous', HTMLButtonElement),
    next: required(dialog, 'next', HTMLButtonElement),
    captionBlock: required(dialog, 'caption-block', HTMLElement),
    caption: required(dialog, 'caption', HTMLElement),
    more: required(dialog, 'more', HTMLButtonElement),
    context: required(dialog, 'context', HTMLElement),
    counter: required(dialog, 'counter', HTMLElement),
    announce: required(dialog, 'announce', HTMLElement),
  };
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Whether `element` is in the document and rendered (not `hidden`, `display: none` or invisible). */
export function isRendered(element: Element): boolean {
  if (!element.isConnected) return false;
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility({ visibilityProperty: true })
    : element.getClientRects().length > 0;
}

/** Focusable elements inside `root` that are currently rendered, in DOM (= Tab) order. */
export function focusableIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isRendered);
}

/** Shows or hides an element with the `hidden` attribute (hidden = not rendered at all). */
export function setShown(element: HTMLElement, shown: boolean): void {
  element.hidden = !shown;
}
