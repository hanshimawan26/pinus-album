import { describe, expect, it } from 'vitest';
import { SWIPE_OPTIONS, classifySwipe, dragOffset, gestureAxis } from '../../src/scripts/viewer/swipe.ts';

describe('gestureAxis', () => {
  it('waits until the finger has moved far enough to tell', () => {
    expect(gestureAxis(3, 4)).toBeNull();
    expect(gestureAxis(0, 0)).toBeNull();
  });

  it('decides horizontal or vertical by the larger movement', () => {
    expect(gestureAxis(12, 3)).toBe('horizontal');
    expect(gestureAxis(-12, 5)).toBe('horizontal');
    expect(gestureAxis(4, 15)).toBe('vertical');
    expect(gestureAxis(-3, -20)).toBe('vertical');
  });
});

describe('classifySwipe', () => {
  it('turns a long leftward move into "next" and a rightward one into "previous"', () => {
    expect(classifySwipe({ dx: -80, dy: 5, dt: 400 })).toBe('next');
    expect(classifySwipe({ dx: 80, dy: -5, dt: 400 })).toBe('previous');
  });

  it('accepts exactly the minimum distance', () => {
    expect(classifySwipe({ dx: -SWIPE_OPTIONS.distance, dy: 0, dt: 1000 })).toBe('next');
    expect(classifySwipe({ dx: -(SWIPE_OPTIONS.distance - 1), dy: 0, dt: 1000 })).toBeNull();
  });

  it('accepts a short but fast flick', () => {
    expect(classifySwipe({ dx: -30, dy: 2, dt: 50 })).toBe('next'); // 0.6 px/ms
    expect(classifySwipe({ dx: 30, dy: 2, dt: 300 })).toBeNull(); // 0.1 px/ms: too slow
    expect(classifySwipe({ dx: -10, dy: 0, dt: 5 })).toBeNull(); // fast but too short
  });

  it('ignores mostly vertical movement (scrolling)', () => {
    expect(classifySwipe({ dx: -60, dy: 200, dt: 300 })).toBeNull();
    expect(classifySwipe({ dx: -60, dy: 50, dt: 300 })).toBeNull(); // 60 < 50 × 1.5
    expect(classifySwipe({ dx: -80, dy: 50, dt: 300 })).toBe('next'); // 80 ≥ 75
  });

  it('ignores a tap', () => {
    expect(classifySwipe({ dx: 0, dy: 0, dt: 80 })).toBeNull();
    expect(classifySwipe({ dx: 2, dy: 1, dt: 0 })).toBeNull();
  });
});

describe('dragOffset', () => {
  const both = { hasPrevious: true, hasNext: true };

  it('follows the finger one to one when there is a neighbour', () => {
    expect(dragOffset(-40, both)).toBe(-40);
    expect(dragOffset(40, both)).toBe(40);
  });

  it('resists past either end', () => {
    expect(dragOffset(40, { hasPrevious: false, hasNext: true })).toBe(10);
    expect(dragOffset(-40, { hasPrevious: true, hasNext: false })).toBe(-10);
    expect(dragOffset(-40, { hasPrevious: false, hasNext: true })).toBe(-40);
  });
});
