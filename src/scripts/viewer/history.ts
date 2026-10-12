/**
 * The viewer's history rules (TRD §6.5). PURE: the controller passes in `history.state`,
 * the URL hash and its own state, and carries out the action these functions return, so
 * every rule is unit-tested without a browser.
 *
 * - Opening from a tile pushes one entry, `#<photo-slug>`, marked in `history.state`.
 *   Moving to another photo replaces that entry, so Back always closes the viewer.
 * - Closing with ✕, Esc or the backdrop goes back when the current entry is ours (the URL
 *   loses its hash naturally); otherwise it clears the hash in place.
 * - Back / Forward / an edited hash: a valid photo hash opens or moves the viewer, anything
 *   else closes it.
 * - Loading a page with a valid hash rewrites history to "page, then page#photo", so Back
 *   closes the viewer instead of leaving the site, unless the entry is already ours (a
 *   reload while the viewer was open), so reloading never stacks entries.
 */

/** Marks history entries the viewer created, so it knows when Back will close it. */
export const HISTORY_MARK = 'pinusViewer';

/** Whether a history entry's state was created by the viewer. */
export function isOurEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as Record<string, unknown>)[HISTORY_MARK] === true;
}

/** `state` (kept, in case someone else stores data there) with the viewer's mark added. */
export function markedState(state: unknown): Record<string, unknown> {
  return { ...(typeof state === 'object' && state !== null ? state : {}), [HISTORY_MARK]: true };
}

/**
 * What to do with history once the viewer has closed:
 * - `none` when it closed because the URL changed (Back, Forward, an edited hash), or there
 *   is no hash to remove;
 * - `back` when the current entry is the one the viewer pushed;
 * - `clear-hash` otherwise (`replaceState` without the hash).
 */
export type CloseAction = 'back' | 'clear-hash' | 'none';

export function closeAction(options: { fromHistory: boolean; state: unknown; hash: string }): CloseAction {
  if (options.fromHistory) return 'none';
  if (isOurEntry(options.state)) return 'back';
  return options.hash !== '' ? 'clear-hash' : 'none';
}

/**
 * What to do on page load, given the index the URL hash points to (`-1`: none):
 * - `ignore` for no hash or an invalid one (the hash is left alone);
 * - `open` when the entry is already ours (a reload): just open the photo;
 * - `arrange` otherwise: replace the entry with the hash-less URL, push `#<slug>`, then open.
 */
export type LoadAction = 'arrange' | 'open' | 'ignore';

export function loadAction(options: { state: unknown; index: number }): LoadAction {
  if (options.index === -1) return 'ignore';
  return isOurEntry(options.state) ? 'open' : 'arrange';
}

/**
 * What the viewer does when the URL changes under it (`popstate`, `hashchange`), given the
 * index the new hash points to (`-1`: none):
 * - `close` when it is open and the hash names no photo;
 * - `settle` when it is already closed (e.g. right after its own `history.back()`);
 * - `open` / `move` to show the named photo; `stay` when it is already shown.
 */
export type SyncAction = 'close' | 'settle' | 'open' | 'move' | 'stay';

export function syncAction(options: { index: number; isOpen: boolean; current: number }): SyncAction {
  const { index, isOpen, current } = options;
  if (index === -1) return isOpen ? 'close' : 'settle';
  if (!isOpen) return 'open';
  return index === current ? 'stay' : 'move';
}
