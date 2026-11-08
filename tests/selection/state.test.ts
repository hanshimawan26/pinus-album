import { describe, expect, it } from 'vitest';
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
} from '../../src/scripts/selection/state.ts';

const all = [0, 1, 2, 3, 4, 5];
const selected = (selection: Selection): number[] => inGridOrder(selection);

describe('toggle', () => {
  it('adds a photo, then removes it, and remembers it as the anchor', () => {
    const once = toggle(NOTHING_SELECTED, 2);
    expect(selected(once)).toEqual([2]);
    expect(once.anchor).toBe(2);
    expect(selected(toggle(once, 2))).toEqual([]);
  });

  it('does not change the selection it was given', () => {
    const before = toggle(NOTHING_SELECTED, 1);
    toggle(before, 3);
    expect(selected(before)).toEqual([1]);
  });
});

describe('extendTo (shift-click)', () => {
  it('adds every photo between the anchor and the click, in either direction', () => {
    expect(selected(extendTo(toggle(NOTHING_SELECTED, 1), all, 4))).toEqual([1, 2, 3, 4]);
    expect(selected(extendTo(toggle(NOTHING_SELECTED, 4), all, 1))).toEqual([1, 2, 3, 4]);
  });

  it('keeps what was already selected and moves the anchor', () => {
    const result = extendTo(toggle(toggle(NOTHING_SELECTED, 0), 3), all, 5);
    expect(selected(result)).toEqual([0, 3, 4, 5]);
    expect(result.anchor).toBe(5);
  });

  it('only reaches photos the filter left on screen', () => {
    expect(selected(extendTo(toggle(NOTHING_SELECTED, 0), [0, 2, 4], 4))).toEqual([0, 2, 4]);
  });

  it('is a plain toggle without an anchor, or when the anchor was filtered away', () => {
    expect(selected(extendTo(NOTHING_SELECTED, all, 3))).toEqual([3]);
    expect(selected(extendTo(toggle(NOTHING_SELECTED, 1), [2, 3], 3))).toEqual([1, 3]);
  });
});

describe('press and dragTo (touch)', () => {
  it('a long press selects the photo and never deselects it', () => {
    expect(selected(press(NOTHING_SELECTED, 2))).toEqual([2]);
    expect(selected(press(press(NOTHING_SELECTED, 2), 2))).toEqual([2]);
  });

  it('a drag adds the photos from the start to the finger', () => {
    const base = press(NOTHING_SELECTED, 1);
    expect(selected(dragTo(base, all, 1, 3))).toEqual([1, 2, 3]);
    expect(selected(dragTo(base, all, 1, 0))).toEqual([0, 1]);
  });

  it('moving back releases photos, but never those selected before the drag', () => {
    const base = press(toggle(NOTHING_SELECTED, 5), 1);
    dragTo(base, all, 1, 4);
    expect(selected(dragTo(base, all, 1, 2))).toEqual([1, 2, 5]);
  });

  it('ignores a finger over a photo that is not on screen', () => {
    const base = press(NOTHING_SELECTED, 1);
    expect(dragTo(base, [1, 2], 1, 4)).toBe(base);
  });
});

describe('select all', () => {
  it('adds the photos on screen and keeps ones selected under another filter', () => {
    expect(selected(selectShown(toggle(NOTHING_SELECTED, 5), [1, 2]))).toEqual([1, 2, 5]);
  });

  it('deselecting removes only the photos on screen', () => {
    const selection = selectShown(toggle(NOTHING_SELECTED, 5), [1, 2]);
    expect(selected(deselectShown(selection, [1, 2]))).toEqual([5]);
  });

  it('knows when everything on screen is selected', () => {
    expect(allShownSelected(selectShown(NOTHING_SELECTED, [1, 2]), [1, 2])).toBe(true);
    expect(allShownSelected(toggle(NOTHING_SELECTED, 1), [1, 2])).toBe(false);
    expect(allShownSelected(NOTHING_SELECTED, [])).toBe(false);
  });
});

it('inGridOrder sorts by grid position, not by when photos were picked', () => {
  expect(inGridOrder(toggle(toggle(NOTHING_SELECTED, 4), 1))).toEqual([1, 4]);
});
