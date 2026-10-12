/**
 * Position and labels of the post viewer (TRD §6.5). PURE: no DOM, so Vitest imports it
 * directly.
 *
 * The viewer does not wrap around: the first photo has no "previous" and the last has no
 * "next", like an Instagram carousel (see docs/DECISIONS.md, milestone 4).
 */
import type { ViewerPhoto } from '../../lib/viewer-data.ts';

/** `index` limited to `0 … total - 1` (0 for an empty list). */
export function clampIndex(index: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

/**
 * The index `delta` steps away from `index`, or `null` when that would go past either end.
 * `step(0, -1, 5)` is `null`; `step(3, 1, 5)` is `4`.
 */
export function step(index: number, delta: number, total: number): number | null {
  const target = index + delta;
  return target >= 0 && target < total ? target : null;
}

export const hasPrevious = (index: number): boolean => index > 0;
export const hasNext = (index: number, total: number): boolean => index < total - 1;

/** The indexes worth preloading around `index`: next first, then previous. */
export function neighbours(index: number, total: number): number[] {
  return [step(index, 1, total), step(index, -1, total)].filter((value): value is number => value !== null);
}

/** Visible counter: "3 / 24". */
export function counterLabel(index: number, total: number): string {
  return `${index + 1} / ${total}`;
}

/** A single photo has nowhere to go, so "1 / 1" is noise (like a single Instagram post). */
export const showsCounter = (total: number): boolean => total > 1;

/**
 * Accessible name of the dialog, also announced when moving to another photo:
 * "Photo 3 of 24 by Andi Pratama", or "Photo 3 of 24" when nobody is credited. A single
 * photo is just "Photo by Andi Pratama" (or "Photo").
 */
export function photoLabel(photo: Pick<ViewerPhoto, 'photographer'>, index: number, total: number): string {
  const position = total > 1 ? `Photo ${index + 1} of ${total}` : 'Photo';
  return photo.photographer ? `${position} by ${photo.photographer.name}` : position;
}
