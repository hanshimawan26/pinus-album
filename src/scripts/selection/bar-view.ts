/**
 * What the selection bar says and offers in each phase (TRD §6.4.1). PURE.
 *
 * Phases: `idle` (no bar), `selecting`, `preparing` (the photos are being fetched; the selection
 * is frozen), `ready` (iPhones: the photos are in memory and a second tap opens the share sheet,
 * because Safari refuses to open it after a wait) and `saving` (Android: each photo is being
 * handed to the browser as its own download).
 */

export type Phase = 'idle' | 'selecting' | 'preparing' | 'ready' | 'saving';

export interface BarState {
  phase: Phase;
  /** Photos selected. */
  count: number;
  /** Photos fetched so far, while preparing. */
  done: number;
  /** Every photo on screen is already selected. */
  allShown: boolean;
  /** The last download failed. */
  failed: boolean;
}

export interface BarView {
  label: string;
  saveText: string;
  saveDisabled: boolean;
  showSelectAll: boolean;
  selectAllText: string;
}

const photoCount = (count: number): string => `${count} photo${count === 1 ? '' : 's'}`;

export function barView({ phase, count, done, allShown, failed }: BarState): BarView {
  const selectAllText = allShown ? 'Deselect all' : 'Select all';
  switch (phase) {
    case 'preparing':
      return { label: `Preparing ${done} of ${count}…`, saveText: 'Download', saveDisabled: true, showSelectAll: false, selectAllText };
    case 'saving':
      return { label: `Saving ${done} of ${count}…`, saveText: 'Download', saveDisabled: true, showSelectAll: false, selectAllText };
    case 'ready':
      return { label: 'Ready', saveText: `Save ${photoCount(count)}`, saveDisabled: false, showSelectAll: false, selectAllText };
    default:
      return {
        label: failed ? "Couldn't download. Try again." : `${count} selected`,
        saveText: 'Download',
        saveDisabled: false,
        showSelectAll: !failed,
        selectAllText,
      };
  }
}

/** What a screen reader hears when a download has been handed to the browser. */
export const savedStatus = (count: number): string => `Saving ${photoCount(count)}`;
