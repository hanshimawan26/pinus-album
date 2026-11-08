/**
 * Tap-and-hold and drag-to-select on a photo grid (TRD §6.4.1).
 *
 * Touch events rather than pointer events, because only a `touchmove` can stop the page
 * scrolling once the drag has begun (`touch-action` is read when the finger lands, before we
 * know it is a long press). The rules and numbers are in `drag.ts`.
 *
 * A finger that moves before the long press is scrolling, so it is left alone. While dragging,
 * a finger near the top or bottom of the screen scrolls the page, so a selection can run past
 * one screenful.
 */
import { edgeScrollSpeed, LONG_PRESS_MS, movedTooFar } from './drag.ts';

export interface TouchSelectTarget {
  /** The tile under a point on the screen, or `null` (a gap between tiles, outside the grid). */
  tileAt(x: number, y: number): number | null;
  /** Whether a long press may begin now (not while a download is being prepared). */
  canStart(): boolean;
  /** The long press completed on tile `index`. */
  onStart(index: number): void;
  /** The finger is now over tile `index`. */
  onMove(index: number): void;
  onEnd(): void;
  /** Where the selection bar ends: the top of the area that scrolls under the finger. */
  topInset(): number;
}

interface Press {
  touchId: number;
  x: number;
  y: number;
  index: number;
  timer: number;
}

export function attachTouchSelect(grid: Element, target: TouchSelectTarget): void {
  let press: Press | null = null;
  let dragging = false;
  let finger = { id: -1, x: 0, y: 0 };
  let frame = 0;

  const forget = (): void => {
    if (press) window.clearTimeout(press.timer);
    press = null;
  };

  const extendAtFinger = (): void => {
    const index = target.tileAt(finger.x, finger.y);
    if (index !== null) target.onMove(index);
  };

  const scrollNearEdges = (): void => {
    const speed = edgeScrollSpeed(finger.y, window.innerHeight, target.topInset());
    if (speed !== 0) {
      window.scrollBy(0, speed);
      extendAtFinger();
    }
    frame = requestAnimationFrame(scrollNearEdges);
  };

  const begin = (): void => {
    if (!press) return;
    finger = { id: press.touchId, x: press.x, y: press.y };
    target.onStart(press.index);
    press = null;
    dragging = true;
    frame = requestAnimationFrame(scrollNearEdges);
  };

  const stop = (): void => {
    forget();
    if (!dragging) return;
    dragging = false;
    cancelAnimationFrame(frame);
    target.onEnd();
  };

  grid.addEventListener(
    'touchstart',
    (event) => {
      const touch = (event as TouchEvent).changedTouches[0];
      if ((event as TouchEvent).touches.length > 1 || !touch) return stop(); // a pinch
      const index = target.tileAt(touch.clientX, touch.clientY);
      if (index === null || !target.canStart()) return;
      forget();
      press = { touchId: touch.identifier, x: touch.clientX, y: touch.clientY, index, timer: window.setTimeout(begin, LONG_PRESS_MS) };
    },
    { passive: true },
  );

  // Not passive: this is what holds the page still during a drag.
  grid.addEventListener(
    'touchmove',
    (event) => {
      const { touches, cancelable } = event as TouchEvent;
      if (dragging) {
        const touch = [...touches].find((candidate) => candidate.identifier === finger.id);
        if (cancelable) event.preventDefault();
        if (!touch) return;
        finger = { id: finger.id, x: touch.clientX, y: touch.clientY };
        extendAtFinger();
      } else if (press) {
        const touch = [...touches].find((candidate) => candidate.identifier === press?.touchId);
        if (touch && movedTooFar(touch.clientX - press.x, touch.clientY - press.y)) forget();
      }
    },
    { passive: false },
  );

  grid.addEventListener('touchend', stop);
  grid.addEventListener('touchcancel', stop);

  // Android's long-press menu and image drag would end the gesture. A mouse never has a press
  // here, so right-click keeps its normal menu.
  const blockDuringPress = (event: Event): void => {
    if (press || dragging) event.preventDefault();
  };
  grid.addEventListener('contextmenu', blockDuringPress);
  grid.addEventListener('dragstart', blockDuringPress);
}
