/**
 * Which photos of a grid are selected (TRD §6.4.1). PURE: every function takes a selection and
 * returns a new one, so Vitest imports it directly. `controller.ts` applies them to the page.
 *
 * Photos are tile indexes (`data-index`). `visible` is the tiles the photographer filter left,
 * in grid order. A selection survives a filter change: someone can pick photos from one
 * photographer, press another chip and carry on. Ranges and "Select all" only ever reach the
 * photos on screen.
 */

export interface Selection {
  readonly chosen: ReadonlySet<number>;
  /** Where the next shift-click range starts: the photo picked last. */
  readonly anchor: number | null;
}

export const NOTHING_SELECTED: Selection = { chosen: new Set(), anchor: null };

/** The visible photos from `from` to `to`, in grid order; `null` if either is not visible. */
function visibleBetween(visible: readonly number[], from: number | null, to: number): number[] | null {
  if (from === null) return null;
  const start = visible.indexOf(from);
  const end = visible.indexOf(to);
  if (start === -1 || end === -1) return null;
  return visible.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export function toggle(selection: Selection, index: number): Selection {
  const chosen = new Set(selection.chosen);
  if (!chosen.delete(index)) chosen.add(index);
  return { chosen, anchor: index };
}

/** Shift-click: adds every visible photo from the anchor to `index`. Without an anchor, a toggle. */
export function extendTo(selection: Selection, visible: readonly number[], index: number): Selection {
  const range = visibleBetween(visible, selection.anchor, index);
  if (!range) return toggle(selection, index);
  return { chosen: new Set([...selection.chosen, ...range]), anchor: index };
}

/** A long press: the pressed photo is selected (it stays so if it already was). */
export function press(selection: Selection, index: number): Selection {
  return { chosen: new Set([...selection.chosen, index]), anchor: index };
}

/**
 * A finger dragged from `from` to `to` after a long press. Always computed from `base`, the
 * selection when the drag began, so moving back over photos releases them again.
 */
export function dragTo(base: Selection, visible: readonly number[], from: number, to: number): Selection {
  const range = visibleBetween(visible, from, to);
  if (!range) return base;
  return { chosen: new Set([...base.chosen, ...range]), anchor: to };
}

export function selectShown(selection: Selection, visible: readonly number[]): Selection {
  return { chosen: new Set([...selection.chosen, ...visible]), anchor: selection.anchor };
}

export function deselectShown(selection: Selection, visible: readonly number[]): Selection {
  const chosen = new Set(selection.chosen);
  for (const index of visible) chosen.delete(index);
  return { chosen, anchor: null };
}

export const allShownSelected = (selection: Selection, visible: readonly number[]): boolean =>
  visible.length > 0 && visible.every((index) => selection.chosen.has(index));

/** The selected photos in grid order: the order of the files in a download. */
export const inGridOrder = (selection: Selection): number[] => [...selection.chosen].sort((a, b) => a - b);
