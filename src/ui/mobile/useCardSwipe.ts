import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { dampen, lockAxis, shouldCommitSwipe, VelocityTracker } from './gesture';

/** Left-swipe travel (px) past which the action reveal snaps open on release. */
const LEFT_SNAP = 56;
/** Flick speed (px/ms) that opens/keeps the left reveal regardless of distance. */
const FLICK = 0.5;
/** Rightward travel (px) that counts as a genuine (if blocked) commit attempt. */
const BLOCKED_INTENT = 48;
/** How far past the card's own width the foreground travels off-screen on a
 *  completion commit (plan §5) — "~110%" so it clears the card entirely. */
const LEAVE_TRAVEL = 1.1;
/** Duration (ms) of the completion exit animation — matches the `.m-card--leaving`
 *  grid-rows collapse in mobile.css so the translate and the height collapse
 *  finish together (plan §5). The dispatch itself fires after this timer. */
const LEAVE_MS = 190;

export interface UseCardSwipeOptions {
  /** Ignore all pointers (e.g. while the card is in edit mode). */
  disabled?: boolean;
  /** Fired on a committed right-swipe. Parent dispatches + shows any toast. */
  onCommitRight?: () => void;
  /** Right-swipe is blocked (Today card with open subtasks): dampen + hint. */
  rightBlocked?: boolean;
  /** Fired once per gesture when a blocked right-swipe is attempted. */
  onBlockedHint?: () => void;
  /** Whether a left-swipe reveals an action layer for this card. */
  hasLeftActions?: boolean;
  /** Width (px) of the revealed action layer (56 per button). */
  revealWidth?: number;
  /** This card's id — so the parent can enforce one-open-at-a-time. */
  cardId: string;
  /** The single currently-revealed card id, or null. */
  revealedId: string | null;
  /** Open (`id`) / close (`null`) the reveal. Parent stores it as `revealedId`. */
  onReveal: (id: string | null) => void;
}

type Phase = 'idle' | 'dragging' | 'leaving';

interface Gesture {
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  axis: 'horizontal' | 'vertical' | null;
  startOffset: number;
  width: number;
  dragged: boolean;
}

function freshGesture(): Gesture {
  return {
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    axis: null,
    startOffset: 0,
    width: 0,
    dragged: false,
  };
}

/**
 * Per-card horizontal-swipe state machine over Pointer Events (plan §3, the
 * project's highest-risk code — favouring clarity over cleverness).
 *
 * Ownership: the card element keeps `touch-action: pan-y` so the browser still
 * drives vertical list scrolling; only a horizontal drag (locked at 12px via
 * {@link lockAxis}) is captured here, and once captured the transform is written
 * straight to `fgRef.style` every move for 60fps — React state holds only the
 * discrete `phase`. Touch pointers only (mouse/pen are left alone so desktop and
 * trackpads are unaffected).
 *
 * Right drag reveals a full-bleed commit underlay and, past
 * {@link shouldCommitSwipe}, fires `onCommitRight`; when `rightBlocked` the drag
 * is {@link dampen}ed, never commits, and fires `onBlockedHint`. Left drag
 * reveals the action layer, snapping open past {@link LEFT_SNAP} or on a leftward
 * flick. Any drag that passes the slop suppresses the trailing click so a swipe
 * never also toggles the accordion.
 */
export function useCardSwipe(opts: UseCardSwipeOptions) {
  const fgRef = useRef<HTMLDivElement>(null);
  const underCompleteRef = useRef<HTMLDivElement>(null);
  const underActionsRef = useRef<HTMLDivElement>(null);

  const g = useRef<Gesture>(freshGesture());
  const velocity = useRef(new VelocityTracker());
  const suppressClick = useRef(false);
  const [phase, setPhase] = useState<Phase>('idle');
  // True for the lifetime of the leaving animation (plan §5) — read
  // synchronously (state updates are not) so the resting-offset effect below
  // never snaps the foreground back mid-exit, and cleared/cancelled on unmount.
  const leavingRef = useRef(false);
  const leaveTimeout = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (leaveTimeout.current !== null) window.clearTimeout(leaveTimeout.current);
    },
    [],
  );

  // Latest options behind a ref so the pointer handlers can stay stable
  // (useCallback with empty deps) yet always read current props mid-gesture.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const setUnderlays = useCallback((target: number) => {
    if (underCompleteRef.current) {
      underCompleteRef.current.style.opacity = target > 0 ? '1' : '0';
    }
    if (underActionsRef.current) {
      underActionsRef.current.style.opacity = target < 0 ? '1' : '0';
    }
  }, []);

  // Animate the foreground to a resting offset using the CSS transition
  // (cleared during an active drag, restored here).
  const settle = useCallback(
    (target: number) => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.style.transition = '';
      fg.style.transform = `translateX(${target}px)`;
      setUnderlays(target);
    },
    [setUnderlays],
  );

  const restingOffset = useCallback(() => {
    const o = optsRef.current;
    const revealed = o.revealedId === o.cardId;
    return revealed && o.hasLeftActions ? -(o.revealWidth ?? LEFT_SNAP) : 0;
  }, []);

  // Keep the foreground parked at its resting offset whenever a gesture is not
  // in flight — this is what springs a card closed when another card opens
  // (parent flips its `revealedId` away) or after a commit.
  useEffect(() => {
    if (g.current.active || leavingRef.current) return;
    settle(restingOffset());
  }, [opts.revealedId, opts.cardId, opts.revealWidth, opts.hasLeftActions, settle, restingOffset]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const o = optsRef.current;
    if (o.disabled || leavingRef.current) return;
    if (e.pointerType !== 'touch' || !e.isPrimary) return;
    if (g.current.active) return;

    // Starting a fresh gesture closes a different card's open reveal.
    if (o.revealedId && o.revealedId !== o.cardId) o.onReveal(null);

    const fg = fgRef.current;
    g.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      startOffset: o.revealedId === o.cardId && o.hasLeftActions ? -(o.revealWidth ?? LEFT_SNAP) : 0,
      width: fg?.offsetWidth ?? window.innerWidth,
      dragged: false,
    };
    suppressClick.current = false;
    velocity.current.reset();
    velocity.current.add(e.clientX, e.timeStamp);
    // Disable the CSS transition so drag frames track the finger exactly.
    if (fg) fg.style.transition = 'none';
  }, []);

  // Constrain the raw offset to the card's physics: free travel toward a valid
  // action, dampened resistance otherwise.
  const constrain = useCallback((tx: number): number => {
    const o = optsRef.current;
    if (tx > 0) {
      const canCommit = !!o.onCommitRight && !o.rightBlocked;
      return canCommit ? tx : dampen(tx);
    }
    if (tx < 0) {
      if (!o.hasLeftActions) return dampen(tx);
      const reveal = o.revealWidth ?? LEFT_SNAP;
      if (tx < -reveal) return -reveal + dampen(tx + reveal);
      return tx;
    }
    return 0;
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const gs = g.current;
      if (!gs.active || e.pointerId !== gs.pointerId) return;
      // Disabled mid-gesture (long-press reorder just armed on this card): stop
      // advancing so a swipe can never fight the drag. The gesture still ends
      // cleanly on pointerup below.
      if (optsRef.current.disabled) return;

      const dx = e.clientX - gs.startX;
      const dy = e.clientY - gs.startY;
      velocity.current.add(e.clientX, e.timeStamp);

      if (gs.axis === null) {
        const axis = lockAxis(dx, dy);
        if (axis === null) return;
        gs.axis = axis;
        if (axis === 'vertical') return; // native scroll owns it from here
        gs.dragged = true;
        suppressClick.current = true;
        setPhase('dragging');
        try {
          fgRef.current?.setPointerCapture(gs.pointerId);
        } catch {
          /* element may be detaching; ignore */
        }
      }
      if (gs.axis !== 'horizontal') return;

      const tx = constrain(gs.startOffset + dx);
      const fg = fgRef.current;
      if (fg) fg.style.transform = `translateX(${tx}px)`;
      setUnderlays(tx);
    },
    [constrain, setUnderlays],
  );

  const endGesture = useCallback(() => {
    g.current = freshGesture();
    setPhase('idle');
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const gs = g.current;
      if (!gs.active || e.pointerId !== gs.pointerId) return;
      const o = optsRef.current;
      try {
        fgRef.current?.releasePointerCapture(gs.pointerId);
      } catch {
        /* ignore */
      }

      const dx = e.clientX - gs.startX;

      // A tap (never locked horizontal) on an open card just closes it — and
      // suppresses the click so it doesn't also toggle the accordion.
      if (gs.axis !== 'horizontal') {
        if (gs.axis === null && o.revealedId === o.cardId) {
          suppressClick.current = true;
          o.onReveal(null);
        }
        endGesture();
        return;
      }

      const tx = gs.startOffset + dx;
      const vx = velocity.current.velocity();

      // 1. Committed right-swipe: animate the card out first, dispatch after
      // (plan §5). The foreground continues off-screen from its current `tx`
      // (no jump) via the CSS transition that drag frames disable; the parent
      // collapses the card's height in lockstep via the `leaving` phase's
      // `.m-card--leaving` class. Reduced motion skips straight to dispatch.
      if (o.onCommitRight && !o.rightBlocked && tx > 0 && shouldCommitSwipe({ dx: tx, vx, width: gs.width })) {
        o.onReveal(null);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
          o.onCommitRight();
          endGesture();
          return;
        }
        const fg = fgRef.current;
        if (fg) {
          fg.style.transition = `transform ${LEAVE_MS}ms ease-out`;
          fg.style.transform = `translateX(${gs.width * LEAVE_TRAVEL}px)`;
        }
        g.current = freshGesture();
        leavingRef.current = true;
        setPhase('leaving');
        leaveTimeout.current = window.setTimeout(() => {
          leaveTimeout.current = null;
          leavingRef.current = false;
          optsRef.current.onCommitRight?.();
        }, LEAVE_MS);
        return;
      }
      // 2. Blocked right-swipe attempt: hint + spring back.
      if (o.rightBlocked && tx > BLOCKED_INTENT) {
        o.onBlockedHint?.();
        o.onReveal(null);
        settle(0);
        endGesture();
        return;
      }
      // 3. Left reveal: snap open on distance or a leftward flick.
      if (o.hasLeftActions && (tx <= -LEFT_SNAP || (vx <= -FLICK && tx < 0))) {
        o.onReveal(o.cardId);
        settle(-(o.revealWidth ?? LEFT_SNAP));
        endGesture();
        return;
      }
      // 4. Otherwise return to the closed rest position.
      o.onReveal(null);
      settle(0);
      endGesture();
    },
    [endGesture, settle],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const gs = g.current;
      if (!gs.active || e.pointerId !== gs.pointerId) return;
      try {
        fgRef.current?.releasePointerCapture(gs.pointerId);
      } catch {
        /* ignore */
      }
      settle(restingOffset());
      endGesture();
    },
    [endGesture, settle, restingOffset],
  );

  // Consume the click that follows any drag (or a reveal-closing tap) so a
  // swipe never also fires the accordion toggle underneath.
  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    fgRef,
    underCompleteRef,
    underActionsRef,
    phase,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    onClickCapture,
  };
}
