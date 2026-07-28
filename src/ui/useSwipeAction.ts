import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hand-rolled horizontal swipe-to-act for touch (D52). No gesture library
 * (D1/D47) — modelled on `useLongPress`'s conventions: pointerType gating,
 * an intent threshold before we claim the gesture, and cleanup on unmount.
 *
 * The row's visible surface follows the finger while swiping; releasing past a
 * threshold flings it out and fires `onTrigger`; releasing short springs it
 * back. `enabled: false` (a recurring master with a live day-copy — D43) still
 * gives a little damped travel so the resistance itself reads as "blocked",
 * then always springs back.
 *
 * Commit timing mirrors `useRowExit`: the trigger fires on `transitionend`
 * (which still fires near-instantly under `prefers-reduced-motion`, since the
 * global rule clamps the duration rather than removing the transition), with a
 * fallback timeout so a dropped event can never strand the commit.
 */

/** Finger travel before we decide the gesture is horizontal, in px. */
const INTENT_PX = 12;
/** Horizontal must dominate vertical by this ratio to claim the gesture. */
const INTENT_RATIO = 1.5;
/** Absolute minimum release distance to trigger, in px. */
const THRESHOLD_MIN_PX = 72;
/** …or this fraction of the row width, whichever is larger. */
const THRESHOLD_FRAC = 0.3;
/** Resistance ceiling for travel in the wrong direction / when disabled, px. */
const RESIST_MAX_PX = 56;
/** Commit even if `transitionend` never arrives, in ms (> --dur-move). */
const FLING_FALLBACK_MS = 450;

export interface UseSwipeActionOptions {
  /** Which way a committing swipe goes: Master→Today is 'right', Today→Master 'left'. */
  direction: 'right' | 'left';
  /** False disables the trigger (D43) — travel is damped and always springs back. */
  enabled: boolean;
  onTrigger: () => void;
}

export interface UseSwipeActionResult {
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
    onTransitionEnd: (e: React.TransitionEvent) => void;
  };
  /** Horizontal offset to apply to the row surface right now (0 when idle). */
  dx: number;
  /** Finger down with horizontal intent — surface tracks the finger, no transition. */
  swiping: boolean;
  /** Released past threshold — surface is sliding out until the commit lands. */
  flinging: boolean;
}

/** Quadratic-ish resistance: travel past `max` slows and asymptotes to `max`. */
function rubberBand(distance: number, max: number): number {
  const sign = Math.sign(distance);
  const d = Math.abs(distance);
  return sign * (1 - 1 / (d / max + 1)) * max;
}

type Intent = 'none' | 'horizontal' | 'vertical';

export function useSwipeAction({
  direction,
  enabled,
  onTrigger,
}: UseSwipeActionOptions): UseSwipeActionResult {
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [flinging, setFlinging] = useState(false);

  const start = useRef<{ x: number; y: number } | null>(null);
  const intent = useRef<Intent>('none');
  const width = useRef(0);
  const pointerId = useRef<number | null>(null);
  const fallbackTimer = useRef<number | null>(null);
  // A fling is in progress with a commit still pending — the single-commit
  // guard shared by transitionend and the fallback timer.
  const armed = useRef(false);
  // Latest trigger, read from inside the commit which is registered once.
  const triggerRef = useRef(onTrigger);
  useEffect(() => {
    triggerRef.current = onTrigger;
  }, [onTrigger]);
  const dirSign = direction === 'right' ? 1 : -1;

  const reset = useCallback(() => {
    start.current = null;
    intent.current = 'none';
    pointerId.current = null;
    setSwiping(false);
  }, []);

  const clearFallback = useCallback(() => {
    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  // The single commit path, shared by transitionend and the fallback timeout.
  const commit = useCallback(() => {
    if (!armed.current) return;
    armed.current = false;
    clearFallback();
    setFlinging(false);
    setDx(0);
    triggerRef.current();
  }, [clearFallback]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return; // mouse keeps drag-reorder / click
    start.current = { x: e.clientX, y: e.clientY };
    intent.current = 'none';
    pointerId.current = e.pointerId;
    width.current = e.currentTarget.getBoundingClientRect().width;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const origin = start.current;
      if (origin === null || pointerId.current !== e.pointerId) return;
      const rawX = e.clientX - origin.x;
      const rawY = e.clientY - origin.y;

      if (intent.current === 'none') {
        // Wait to declare intent so a vertical scroll that begins on a row is
        // never hijacked. Horizontal must clear the threshold and dominate.
        if (Math.abs(rawX) > INTENT_PX && Math.abs(rawX) > INTENT_RATIO * Math.abs(rawY)) {
          intent.current = 'horizontal';
          setSwiping(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (Math.abs(rawY) > INTENT_PX) {
          intent.current = 'vertical'; // it's a scroll — leave it to the browser
          start.current = null;
          return;
        } else {
          return;
        }
      }
      if (intent.current !== 'horizontal') return;

      const forward = rawX * dirSign > 0;
      if (!enabled) {
        // Blocked (D43): a little damped give in either direction, no commit.
        setDx(rubberBand(rawX, RESIST_MAX_PX));
      } else if (forward) {
        setDx(rawX); // follow the finger 1:1 toward the action
      } else {
        setDx(rubberBand(rawX, RESIST_MAX_PX)); // resist the wrong way
      }
    },
    [dirSign, enabled],
  );

  const springBack = useCallback(() => {
    // Leave `swiping` false so the row's transition is live, and animate to 0.
    setSwiping(false);
    setDx(0);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      const origin = start.current;
      const rawX = origin ? e.clientX - origin.x : 0;
      const wasHorizontal = intent.current === 'horizontal';
      reset();
      if (!wasHorizontal) return;

      const threshold = Math.max(THRESHOLD_MIN_PX, THRESHOLD_FRAC * width.current);
      if (enabled && rawX * dirSign >= threshold) {
        // Fling the surface off-screen; commit lands on transitionend.
        armed.current = true;
        setFlinging(true);
        setDx(dirSign * (width.current + 48));
        clearFallback();
        fallbackTimer.current = window.setTimeout(commit, FLING_FALLBACK_MS);
      } else {
        springBack();
      }
    },
    [dirSign, enabled, reset, springBack, clearFallback, commit],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current !== e.pointerId) return;
      reset();
      springBack();
    },
    [reset, springBack],
  );

  const onTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      // Only the surface's own transform transition commits.
      if (e.propertyName !== 'transform' || e.target !== e.currentTarget) return;
      commit();
    },
    [commit],
  );

  useEffect(() => clearFallback, [clearFallback]);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onTransitionEnd },
    dx,
    swiping,
    flinging,
  };
}
