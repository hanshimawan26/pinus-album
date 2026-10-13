import { describe, expect, it } from 'vitest';
import { ALL, filterStatus, visibleIndexes } from '../../src/scripts/viewer/filter.ts';

describe('visibleIndexes', () => {
  const photographers = ['rayhan', 'eizel', ALL, 'rayhan', 'eizel'];

  it('keeps the tiles of the chosen photographer, in grid order', () => {
    expect(visibleIndexes(photographers, 'rayhan')).toEqual([0, 3]);
    expect(visibleIndexes(photographers, 'eizel')).toEqual([1, 4]);
  });

  it('shows every tile, uncredited ones included, under "All"', () => {
    expect(visibleIndexes(photographers, ALL)).toEqual([0, 1, 2, 3, 4]);
  });

  it('shows nothing for a photographer with no tiles', () => {
    expect(visibleIndexes(photographers, 'nobody')).toEqual([]);
  });
});

describe('filterStatus', () => {
  it('says how many photos are shown, and by whom', () => {
    expect(filterStatus(24, 'Rayhan Adi')).toBe('Showing 24 photos by Rayhan Adi');
    expect(filterStatus(1, 'Kathleen Ho')).toBe('Showing 1 photo by Kathleen Ho');
    expect(filterStatus(118)).toBe('Showing all 118 photos');
  });
});
