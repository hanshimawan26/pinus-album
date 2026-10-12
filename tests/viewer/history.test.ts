import { describe, expect, it } from 'vitest';
import { closeAction, HISTORY_MARK, isOurEntry, loadAction, markedState, syncAction } from '../../src/scripts/viewer/history.ts';

const ours = { [HISTORY_MARK]: true };

describe('isOurEntry / markedState', () => {
  it('recognises only entries the viewer marked', () => {
    expect(isOurEntry(ours)).toBe(true);
    expect(isOurEntry(null)).toBe(false);
    expect(isOurEntry(undefined)).toBe(false);
    expect(isOurEntry({})).toBe(false);
    expect(isOurEntry({ [HISTORY_MARK]: 'yes' })).toBe(false);
    expect(isOurEntry('pinusViewer')).toBe(false);
  });

  it('adds the mark and keeps whatever else the state held', () => {
    expect(markedState(null)).toEqual(ours);
    expect(markedState({ other: 1 })).toEqual({ other: 1, [HISTORY_MARK]: true });
    expect(isOurEntry(markedState({ other: 1 }))).toBe(true);
  });
});

describe('closeAction (✕, Esc, backdrop or Back)', () => {
  it('goes back from the entry the viewer pushed', () => {
    expect(closeAction({ fromHistory: false, state: ours, hash: '#a' })).toBe('back');
  });

  it('clears the hash in place when the entry is not ours, so it never leaves the page', () => {
    expect(closeAction({ fromHistory: false, state: null, hash: '#a' })).toBe('clear-hash');
    expect(closeAction({ fromHistory: false, state: { other: 1 }, hash: '#a' })).toBe('clear-hash');
  });

  it('does nothing when there is no hash and the entry is not ours', () => {
    expect(closeAction({ fromHistory: false, state: null, hash: '' })).toBe('none');
  });

  it('leaves history alone when the URL closed the viewer (Back, Forward, edited hash)', () => {
    expect(closeAction({ fromHistory: true, state: ours, hash: '' })).toBe('none');
    expect(closeAction({ fromHistory: true, state: null, hash: '#x' })).toBe('none');
  });
});

describe('loadAction (page load)', () => {
  it('ignores a missing or invalid hash', () => {
    expect(loadAction({ state: null, index: -1 })).toBe('ignore');
    expect(loadAction({ state: ours, index: -1 })).toBe('ignore');
  });

  it('arranges "page, then page#photo" for a fresh deep link', () => {
    expect(loadAction({ state: null, index: 0 })).toBe('arrange');
    expect(loadAction({ state: { other: 1 }, index: 3 })).toBe('arrange');
  });

  it('only opens after a reload of an entry the viewer created (no stacked entries)', () => {
    expect(loadAction({ state: ours, index: 2 })).toBe('open');
  });
});

describe('syncAction (popstate, hashchange)', () => {
  it('closes an open viewer when the hash names no photo', () => {
    expect(syncAction({ index: -1, isOpen: true, current: 2 })).toBe('close');
  });

  it('settles when already closed (after its own history.back())', () => {
    expect(syncAction({ index: -1, isOpen: false, current: 2 })).toBe('settle');
  });

  it('opens or moves to the photo the hash names', () => {
    expect(syncAction({ index: 4, isOpen: false, current: 0 })).toBe('open');
    expect(syncAction({ index: 4, isOpen: true, current: 2 })).toBe('move');
    expect(syncAction({ index: 2, isOpen: true, current: 2 })).toBe('stay');
  });
});
