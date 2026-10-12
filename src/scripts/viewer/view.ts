/**
 * Writes one photo's details into the viewer (TRD §6.5). All user data (names, captions,
 * dates) goes in with `textContent`, never as HTML. Which rows are shown is decided by the
 * pure `rowsFor()`; rows without data are hidden, so no empty caption, photographer or date
 * row is ever rendered.
 */
import type { ViewerPhoto } from '../../lib/viewer-data.ts';
import { setShown, type ViewerElements } from './dom.ts';
import { counterLabel, hasNext, hasPrevious, photoLabel } from './navigation.ts';
import { rowsFor, type Rows } from './rows.ts';

export interface Position {
  index: number;
  total: number;
}

function renderCredit(elements: ViewerElements, photo: ViewerPhoto, rows: Rows): void {
  const { photographer, date } = photo;

  elements.avatar.textContent = rows.avatar ? (photographer?.initials ?? '') : '';
  setShown(elements.avatar, rows.avatar);

  if (rows.nameLink && photographer?.instagramUrl) {
    elements.nameLink.href = photographer.instagramUrl;
    elements.nameLinkText.textContent = photographer.name;
    // Attach only when detached: re-inserting an attached node moves it, which drops focus.
    if (elements.nameLink.parentNode !== elements.nameRow) elements.nameRow.prepend(elements.nameLink);
  } else {
    elements.nameLink.remove();
  }
  elements.nameText.textContent = rows.nameText ? (photographer?.name ?? '') : '';
  setShown(elements.nameText, rows.nameText);
  setShown(elements.nameRow, rows.nameRow);

  elements.date.textContent = date?.label ?? '';
  if (date) {
    elements.date.dateTime = date.iso;
  } else {
    elements.date.removeAttribute('datetime');
  }
  setShown(elements.dateRow, rows.dateRow);

  setShown(elements.credit, rows.credit);
}

/** Fills every text row and control for `photo`. The image itself is shown by `PhotoDisplay`. */
export function renderPhoto(elements: ViewerElements, photo: ViewerPhoto, { index, total }: Position, context: string): void {
  const rows = rowsFor(photo);
  elements.title.textContent = photoLabel(photo, index, total);
  renderCredit(elements, photo, rows);
  elements.caption.textContent = rows.captionBlock ? (photo.caption ?? '') : '';
  setShown(elements.captionBlock, rows.captionBlock);
  elements.context.textContent = context;
  setShown(elements.context, context !== '');
  elements.counter.textContent = counterLabel(index, total);
  setShown(elements.previous, hasPrevious(index));
  setShown(elements.next, hasNext(index, total));
}
