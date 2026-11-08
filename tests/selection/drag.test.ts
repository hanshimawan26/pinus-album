import { describe, expect, it } from 'vitest';
import { edgeScrollSpeed, movedTooFar } from '../../src/scripts/selection/drag.ts';

describe('movedTooFar', () => {
  it('forgives a resting finger and notices a scrolling one', () => {
    expect(movedTooFar(3, 4)).toBe(false);
    expect(movedTooFar(0, 30)).toBe(true);
  });
});

describe('edgeScrollSpeed', () => {
  const height = 800;
  const bar = 56;

  it('does nothing in the middle of the screen', () => {
    expect(edgeScrollSpeed(400, height, bar)).toBe(0);
  });

  it('scrolls down near the bottom, faster closer to the edge', () => {
    const near = edgeScrollSpeed(height - 60, height, bar);
    const nearer = edgeScrollSpeed(height - 4, height, bar);
    expect(near).toBeGreaterThan(0);
    expect(nearer).toBeGreaterThan(near);
  });

  it('scrolls up near the top, measured from the bottom of the bar', () => {
    expect(edgeScrollSpeed(bar + 20, height, bar)).toBeLessThan(0);
    expect(edgeScrollSpeed(bar + 100, height, bar)).toBe(0);
  });

  it('caps the speed when the finger is over the bar', () => {
    expect(edgeScrollSpeed(0, height, bar)).toBe(edgeScrollSpeed(-50, height, bar));
  });
});
