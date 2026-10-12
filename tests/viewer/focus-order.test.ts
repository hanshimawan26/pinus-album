import { describe, expect, it } from 'vitest';
import { wrapFocus } from '../../src/scripts/viewer/focus-order.ts';

const order = ['name', 'close', 'previous', 'next', 'more'];

describe('wrapFocus', () => {
  it('wraps Tab from the last element to the first', () => {
    expect(wrapFocus(order, 'more', false)).toBe('name');
  });

  it('wraps Shift+Tab from the first element to the last', () => {
    expect(wrapFocus(order, 'name', true)).toBe('more');
  });

  it('lets the browser move focus inside the list', () => {
    expect(wrapFocus(order, 'close', false)).toBeNull();
    expect(wrapFocus(order, 'next', true)).toBeNull();
  });

  it('brings focus from outside the list (the dialog itself) back in', () => {
    expect(wrapFocus(order, null, false)).toBe('name');
    expect(wrapFocus(order, 'dialog', true)).toBe('more');
  });

  it('keeps focus on a single element', () => {
    expect(wrapFocus(['close'], 'close', false)).toBe('close');
    expect(wrapFocus(['close'], 'close', true)).toBe('close');
  });

  it('does nothing when nothing is focusable', () => {
    expect(wrapFocus([], null, false)).toBeNull();
  });
});
