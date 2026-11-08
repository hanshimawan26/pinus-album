/**
 * The numbers behind tap-and-hold and drag-to-select (TRD §6.4.1). PURE; `touch.ts` uses them.
 */

/** A little shorter than the phone's own long press (about 500 ms), so ours comes first. */
export const LONG_PRESS_MS = 450;

/** A finger that travels further than this before the long press is scrolling the page. */
const MOVE_TOLERANCE_PX = 10;

/** How close to the top or bottom of the screen a dragging finger starts scrolling the page. */
const EDGE_ZONE_PX = 72;
const MAX_SCROLL_PER_FRAME_PX = 14;

export const movedTooFar = (dx: number, dy: number): boolean => Math.hypot(dx, dy) > MOVE_TOLERANCE_PX;

/**
 * Pixels to scroll this frame while dragging: negative near the top, positive near the bottom,
 * faster closer to the edge, 0 elsewhere. `topInset` is where the selection bar ends.
 */
export function edgeScrollSpeed(y: number, viewportHeight: number, topInset: number): number {
  const speed = (depth: number) => Math.ceil(Math.min(1, depth / EDGE_ZONE_PX) * MAX_SCROLL_PER_FRAME_PX);
  const fromTop = y - topInset;
  if (fromTop < EDGE_ZONE_PX) return -speed(EDGE_ZONE_PX - fromTop);
  const fromBottom = viewportHeight - y;
  if (fromBottom < EDGE_ZONE_PX) return speed(EDGE_ZONE_PX - fromBottom);
  return 0;
}
