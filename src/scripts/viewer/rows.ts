/**
 * Which of the viewer's rows a photo fills (TRD §6.5, §4.6: absent data disappears, never
 * "Unknown" or an empty box). PURE: `view.ts` applies the result to the DOM, and Vitest
 * checks the rule on every demo case without a browser.
 */
import type { ViewerPhoto } from '../../lib/viewer-data.ts';
import { isInstagramUrl } from './data.ts';

export interface Rows {
  /** The whole header credit (name row with its camera icon, and date row). */
  credit: boolean;
  nameRow: boolean;
  /** The name as an Instagram link: only with a valid Instagram profile URL. */
  nameLink: boolean;
  /** The name as plain text: a credited photographer without a handle. */
  nameText: boolean;
  dateRow: boolean;
  captionBlock: boolean;
}

export function rowsFor(photo: Pick<ViewerPhoto, 'photographer' | 'date' | 'caption'>): Rows {
  const { photographer, date, caption } = photo;
  const credited = photographer !== undefined;
  const linked = credited && isInstagramUrl(photographer.instagramUrl);
  return {
    credit: credited || date !== undefined,
    nameRow: credited,
    nameLink: linked,
    nameText: credited && !linked,
    dateRow: date !== undefined,
    captionBlock: caption !== undefined && caption !== '',
  };
}
