import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a touch must be held before it counts as a long press, in ms. */
const LONG_PRESS_MS = 500;
/** Finger travel that turns a press into a scroll and cancels it, in px. */
const MOVE_TOLERANCE_PX = 10;

/** Handlers to spread onto the element that should respond to the gesture. */
export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export interface UseLongPressResult {
  handlers: LongPressHandlers;
  /** True while a touch is being held, for a "something is happening" cue. */
  pressing: boolean;
}

/**
 * "Click on a mouse, long-press on touch" — one gesture, two input models.
 *
 * A mouse click fires `onTrigger` immediately. A touch has to be held for
 * {@link LONG_PRESS_MS} instead, because on a touch device a plain tap is how
 * you scroll past a row, and firing on tap would make the list impossible to
 * read without opening an editor by accident. The tap that follows a touch is
 * swallowed for the same reason.
 *
 * Moving more than {@link MOVE_TOLERANCE_PX} cancels the press, so a scroll
 * that starts on a row stays a scroll.
 */
export function useLongPress(onTrigger: () => void): UseLongPressResult {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  // Which device started the current interaction, read back in the click that
  // follows: React's click event is a MouseEvent and carries no pointerType.
  const pointerTypeRef = useRef<string>('mouse');
  const [pressing, setPressing] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressing(false);
  }, []);

  // A component unmounted mid-press (e.g. History collapsed) must not fire.
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      pointerTypeRef.current = e.pointerType;
      if (e.pointerType === 'mouse') return; // handled by the click below
      originRef.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setPressing(false);
        onTrigger();
      }, LONG_PRESS_MS);
    },
    [onTrigger],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const origin = originRef.current;
      if (timerRef.current === null || origin === null) return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel],
  );

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      // Enter/Space on a focused button synthesises a click with detail 0 and
      // no preceding pointerdown — always honour it, whatever device touched
      // the page last.
      if (e.detail === 0) {
        onTrigger();
        return;
      }
      // Touch already had its chance via the hold; a released tap does nothing.
      if (pointerTypeRef.current !== 'mouse') return;
      onTrigger();
    },
    [onTrigger],
  );

  // The long press has its own meaning here, so suppress the platform menu it
  // would otherwise raise on top of it.
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (pointerTypeRef.current !== 'mouse') e.preventDefault();
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onClick,
      onContextMenu,
    },
    pressing,
  };
}
