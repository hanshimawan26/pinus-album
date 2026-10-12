import { describe, expect, it } from 'vitest';
import { clampIndex, counterLabel, hasNext, hasPrevious, neighbours, photoLabel, showsCounter, step } from '../../src/scripts/viewer/navigation.ts';

describe('clampIndex', () => {
  it('keeps an index inside the list', () => {
    expect(clampIndex(3, 5)).toBe(3);
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(2.7, 5)).toBe(2);
  });

  it('returns 0 for an empty list or a non-number', () => {
    expect(clampIndex(3, 0)).toBe(0);
    expect(clampIndex(Number.NaN, 5)).toBe(0);
  });
});

describe('step', () => {
  it('moves forward and back inside the list', () => {
    expect(step(0, 1, 5)).toBe(1);
    expect(step(3, -1, 5)).toBe(2);
    expect(step(0, 4, 5)).toBe(4);
  });

  it('does not wrap around at either end', () => {
    expect(step(0, -1, 5)).toBeNull();
    expect(step(4, 1, 5)).toBeNull();
    expect(step(0, 1, 1)).toBeNull();
  });
});

describe('ends and neighbours', () => {
  it('knows when there is a previous or next photo', () => {
    expect([hasPrevious(0), hasNext(0, 3)]).toEqual([false, true]);
    expect([hasPrevious(1), hasNext(1, 3)]).toEqual([true, true]);
    expect([hasPrevious(2), hasNext(2, 3)]).toEqual([true, false]);
    expect([hasPrevious(0), hasNext(0, 1)]).toEqual([false, false]);
  });

  it('lists the photos to preload, next first', () => {
    expect(neighbours(2, 5)).toEqual([3, 1]);
    expect(neighbours(0, 5)).toEqual([1]);
    expect(neighbours(4, 5)).toEqual([3]);
    expect(neighbours(0, 1)).toEqual([]);
  });
});

describe('labels', () => {
  it('shows the counter as "n / total", counting from 1', () => {
    expect(counterLabel(2, 24)).toBe('3 / 24');
    expect(counterLabel(0, 1)).toBe('1 / 1');
  });

  it('names the photographer in the dialog label only when credited', () => {
    expect(photoLabel({ photographer: { name: 'Alice (Demo)', initials: 'AD' } }, 2, 24)).toBe('Photo 3 of 24 by Alice (Demo)');
    expect(photoLabel({}, 0, 12)).toBe('Photo 1 of 12');
  });

  it('treats a single photo as a single post: no counter, no position in the label', () => {
    expect(showsCounter(1)).toBe(false);
    expect(showsCounter(2)).toBe(true);
    expect(photoLabel({ photographer: { name: 'Dewi (Demo)', initials: 'DD' } }, 0, 1)).toBe('Photo by Dewi (Demo)');
    expect(photoLabel({}, 0, 1)).toBe('Photo');
  });
});
