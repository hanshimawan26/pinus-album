/**
 * Keeps the page behind the open viewer from scrolling (TRD §6.6). The scrollbar's width is
 * kept as padding while it is hidden, so the page does not shift sideways.
 */

let saved: { overflow: string; paddingRight: string } | null = null;

export function lockScroll(): void {
  if (saved) return;
  const root = document.documentElement;
  const scrollbar = window.innerWidth - root.clientWidth;
  saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
  root.style.overflow = 'hidden';
  if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
}

export function unlockScroll(): void {
  if (!saved) return;
  const root = document.documentElement;
  root.style.overflow = saved.overflow;
  root.style.paddingRight = saved.paddingRight;
  saved = null;
}
