/**
 * Touch swipe rules for the post viewer (TRD §6.5). PURE: the DOM handler in `gestures.ts`
 * feeds pointer positions in and acts on the answers.
 *
 * A swipe is a mostly horizontal movement that is either long enough or fast enough (a
 * flick). Mostly vertical movements are left to the browser (scrolling the caption, or the
 * page on small screens), and the stage's `touch-action: pan-y pinch-zoom` makes the browser
 * cancel the pointer when it takes such a gesture over.
 */

export interface SwipeOptions {
  /** Movement (px) after which the gesture's axis is decided. */
  axisLock: number;
  /** A horizontal movement at least this long (px) is a swipe. */
  distance: number;
  /** A shorter movement is still a swipe when it is a flick: at least this long (px)… */
  flickDistance: number;
  /** …and at least this fast (px per ms). */
  flickVelocity: number;
  /** Horizontal movement must be this many times the vertical movement. */
  axisRatio: number;
  /** Drag resistance past either end (the photo moves this fraction of the finger). */
  edgeResistance: number;
}

export const SWIPE_OPTIONS: SwipeOptions = {
  axisLock: 10,
  distance: 50,
  flickDistance: 20,
  flickVelocity: 0.4,
  axisRatio: 1.5,
  edgeResistance: 0.25,
};

export type SwipeDirection = 'next' | 'previous';
export type Axis = 'horizontal' | 'vertical';

/** Movement since the pointer went down: distance in px, time in ms. */
export interface SwipeMovement {
  dx: number;
  dy: number;
  dt: number;
}

/**
 * The axis of a gesture once it has moved far enough to tell, else `null`. A vertical
 * gesture is never treated as a swipe, however it continues.
 */
export function gestureAxis(dx: number, dy: number, options: SwipeOptions = SWIPE_OPTIONS): Axis | null {
  if (Math.hypot(dx, dy) < options.axisLock) return null;
  return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
}

/**
 * What a finished gesture means: `next` for a swipe to the left, `previous` for a swipe to
 * the right, or `null` (too short, too slow, or too vertical).
 */
export function classifySwipe({ dx, dy, dt }: SwipeMovement, options: SwipeOptions = SWIPE_OPTIONS): SwipeDirection | null {
  const horizontal = Math.abs(dx);
  if (horizontal === 0 || horizontal < Math.abs(dy) * options.axisRatio) return null;
  const long = horizontal >= options.distance;
  const flick = dt > 0 && horizontal >= options.flickDistance && horizontal / dt >= options.flickVelocity;
  if (!long && !flick) return null;
  return dx < 0 ? 'next' : 'previous';
}

/**
 * How far the photo follows the finger while dragging: one to one, except past either end
 * (no previous or no next photo), where it resists, so the end is felt rather than hidden.
 */
export function dragOffset(
  dx: number,
  ends: { hasPrevious: boolean; hasNext: boolean },
  options: SwipeOptions = SWIPE_OPTIONS,
): number {
  const pastEnd = (dx > 0 && !ends.hasPrevious) || (dx < 0 && !ends.hasNext);
  return pastEnd ? dx * options.edgeResistance : dx;
}
