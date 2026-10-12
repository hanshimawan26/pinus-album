/**
 * Touch swipe on the viewer's stage (TRD §6.5), with pointer events. The photo follows the
 * finger horizontally; on release, `swipe.ts` decides whether it was a swipe. Mouse input is
 * ignored (it has the arrows and keys), and so are gestures that start on a button, gestures
 * that turn out to be vertical, and pinches (a second finger cancels).
 */
import { classifySwipe, dragOffset, gestureAxis, type Axis, type SwipeDirection } from './swipe.ts';

export interface SwipeTarget {
  /** Which neighbours exist right now (the photo resists when dragged past an end). */
  ends(): { hasPrevious: boolean; hasNext: boolean };
  /** A completed swipe towards a neighbour that exists. */
  onSwipe(direction: SwipeDirection): void;
}

interface Track {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  axis: Axis | null;
}

/**
 * Removes `.is-settling` if `transitionend` never fires (the photo had not moved, or the
 * transition was cut short). The settle duration itself is `--duration-settle` in CSS.
 */
const SETTLE_FALLBACK_MS = 1000;

/** Keeps receiving the finger's events when it leaves the stage mid-swipe. */
function capture(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The pointer is already gone (or synthetic); the swipe still completes on pointerup.
  }
}

export function attachSwipe(stage: HTMLElement, image: HTMLImageElement, target: SwipeTarget): void {
  let track: Track | null = null;
  const touching = new Set<number>(); // pointers currently down (touch or pen)

  let settleTimer = 0;
  const endSettle = (): void => {
    window.clearTimeout(settleTimer);
    image.classList.remove('is-settling');
  };
  image.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'transform') endSettle();
  });

  /** The photo springs back to its place (CSS: `.is-settling`, `--duration-settle`). */
  const settle = (): void => {
    image.classList.add('is-settling');
    image.style.transform = '';
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(endSettle, SETTLE_FALLBACK_MS);
  };

  const cancel = (): void => {
    if (track?.axis === 'horizontal') settle();
    track = null;
  };

  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    touching.add(event.pointerId);
    if (touching.size > 1) return cancel(); // a pinch, not a swipe
    if (event.target instanceof Element && event.target.closest('button')) return;
    track = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, axis: null };
  });

  stage.addEventListener('pointermove', (event) => {
    if (!track || event.pointerId !== track.pointerId) return;
    const dx = event.clientX - track.x;
    const dy = event.clientY - track.y;
    if (track.axis === null) {
      track.axis = gestureAxis(dx, dy);
      if (track.axis === 'vertical') {
        track = null;
        return;
      }
      if (track.axis === 'horizontal') capture(stage, event.pointerId);
    }
    if (track.axis === 'horizontal') {
      endSettle();
      image.style.transform = `translateX(${dragOffset(dx, target.ends())}px)`;
    }
  });

  const finish = (event: PointerEvent): void => {
    touching.delete(event.pointerId);
    if (!track || event.pointerId !== track.pointerId) return;
    const movement = { dx: event.clientX - track.x, dy: event.clientY - track.y, dt: event.timeStamp - track.time };
    const wasHorizontal = track.axis === 'horizontal';
    track = null;
    const direction = classifySwipe(movement);
    const ends = target.ends();
    const allowed = direction === 'next' ? ends.hasNext : direction === 'previous' ? ends.hasPrevious : false;
    if (direction && allowed) {
      endSettle();
      image.style.transform = '';
      target.onSwipe(direction);
    } else if (wasHorizontal) {
      settle();
    }
  };

  stage.addEventListener('pointerup', finish);
  stage.addEventListener('pointercancel', (event) => {
    touching.delete(event.pointerId);
    if (track && event.pointerId === track.pointerId) cancel();
  });
}
