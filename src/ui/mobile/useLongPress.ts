import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

/** Hold time (ms) before a stationary press counts as a long-press. */
const LONG_PRESS_MS = 400;
/** Movement (px) that cancels a pending long-press (a scroll/swipe, not a hold). */
const MOVE_CANCEL = 8;

export interface UseLongPressOptions {
  /** Fired once the press survives {@link LONG_PRESS_MS} without moving. */
  onLongPress: () => void;
  /** Ignore all pointers (e.g. read-only rows). */
  disabled?: boolean;
}

interface Origin {
  x: number;
  y: number;
  pointerId: number;
}

/**
 * Generic touch long-press over Pointer Events (plan §4). A 400ms timer starts
 * on `pointerdown` and is cancelled by movement past {@link MOVE_CANCEL} (8px, ≤
 * the card-swipe 12px slop so a swipe always wins the race) or by `pointerup` /
 * `pointercancel` first — so a short press is still a normal tap. On fire it
 * runs `onLongPress`, gives a haptic tick where supported, and suppresses both
 * the trailing synthetic click and the native `contextmenu`, so the long-press
 * never also triggers the element's tap handler or a context menu. Touch
 * pointers only — mouse/pen are left to their own affordances.
 */
export function useLongPress(opts: UseLongPressOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const timer = useRef<number | null>(null);
  const origin = useRef<Origin | null>(null);
  const fired = useRef(false);
  const suppressClick = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  // A component unmounting mid-press must not leave a timer to fire into nothing.
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (optsRef.current.disabled) return;
    if (e.pointerType !== 'touch' || !e.isPrimary) return;
    if (origin.current) return;
    fired.current = false;
    origin.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    timer.current = window.setTimeout(() => {
      timer.current = null;
      origin.current = null;
      fired.current = true;
      suppressClick.current = true;
      navigator.vibrate?.(10);
      optsRef.current.onLongPress();
    }, LONG_PRESS_MS);
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const o = origin.current;
      if (!o || e.pointerId !== o.pointerId) return;
      if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_CANCEL) cancel();
    },
    [cancel],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const o = origin.current;
      if (o && e.pointerId !== o.pointerId) return;
      cancel();
      // A fired long-press only sometimes emits a trailing click; when none
      // arrives the armed suppression would eat the next real tap (and keep
      // suppressing context menus), so let both lapse shortly after release.
      if (fired.current) {
        window.setTimeout(() => {
          fired.current = false;
          suppressClick.current = false;
        }, 250);
      }
    },
    [cancel],
  );

  // Suppress the browser's own long-press context menu for the whole
  // interaction (during the hold and the moment right after it fires).
  const onContextMenu = useCallback((e: ReactMouseEvent) => {
    if (origin.current || fired.current) e.preventDefault();
  }, []);

  // Eat the click a fired long-press would otherwise emit so it never also runs
  // the element's tap handler.
  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onContextMenu,
    },
    onClickCapture,
  };
}
