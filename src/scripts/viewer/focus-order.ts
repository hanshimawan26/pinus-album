/**
 * Tab cycling inside the open viewer (TRD §6.5: focus is trapped). PURE: works on any list,
 * so the rule is unit-tested without a DOM; `dom.ts` supplies the focusable elements.
 *
 * `<dialog>.showModal()` already makes the page behind it inert, but browsers still let Tab
 * leave the dialog for the browser's own toolbar. The viewer keeps Tab inside instead.
 */

/**
 * The element Tab (or Shift+Tab with `backwards`) should move to, or `null` to let the
 * browser move focus normally. Wraps from the last element to the first and back; focus
 * on something outside the list (the dialog itself) goes to the first or last element.
 */
export function wrapFocus<T>(focusable: readonly T[], current: T | null, backwards: boolean): T | null {
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (first === undefined || last === undefined) return null;
  const at = current === null ? -1 : focusable.indexOf(current);
  if (at === -1) return backwards ? last : first;
  if (backwards && at === 0) return last;
  if (!backwards && at === focusable.length - 1) return first;
  return null;
}
