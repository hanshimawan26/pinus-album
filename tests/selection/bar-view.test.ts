import { describe, expect, it } from 'vitest';
import { barView, type BarState } from '../../src/scripts/selection/bar-view.ts';

const state = (changes: Partial<BarState>): BarState => ({ phase: 'selecting', count: 2, done: 0, allShown: false, failed: false, ...changes });

describe('barView', () => {
  it('while selecting, counts the photos and offers both actions', () => {
    expect(barView(state({}))).toMatchObject({ label: '2 selected', saveText: 'Download', saveDisabled: false, showSelectAll: true, selectAllText: 'Select all' });
  });

  it('offers to deselect once everything on screen is selected', () => {
    expect(barView(state({ allShown: true })).selectAllText).toBe('Deselect all');
  });

  it('shows progress and freezes the actions while preparing', () => {
    expect(barView(state({ phase: 'preparing', count: 40, done: 12 }))).toMatchObject({ label: 'Preparing 12 of 40…', saveDisabled: true, showSelectAll: false });
  });

  it('names the second tap on a phone', () => {
    expect(barView(state({ phase: 'ready', count: 12 }))).toMatchObject({ saveText: 'Save 12 photos', saveDisabled: false, showSelectAll: false });
    expect(barView(state({ phase: 'ready', count: 1 })).saveText).toBe('Save 1 photo');
  });

  it('says so when a download failed, and lets it be retried', () => {
    expect(barView(state({ failed: true }))).toMatchObject({ label: "Couldn't download. Try again.", saveDisabled: false, showSelectAll: false });
  });
});
