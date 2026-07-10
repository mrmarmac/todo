import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { slotForPointerY, reorderTargetIndex } from './gesture';

/** Hold time (ms) before a stationary press on a card arms drag-reorder. */
const LONG_PRESS_MS = 400;
/** Movement (px) that cancels the pending arm — ≤ the swipe slop (12px) so a
 *  swipe axis-lock always wins when the finger moves first. */
const MOVE_CANCEL = 8;
/** Distance (px) from a scroller edge within which auto-scroll engages. */
const EDGE = 48;
/** Auto-scroll speed (px per animation frame) near an edge. */
const AUTO_SPEED = 12;

interface Rect {
  top: number;
  height: number;
}

/** Live drag, after the long-press has armed. */
interface Drag {
  id: string;
  from: number;
  pointerId: number;
  /** The card surface the pointer is captured on (also the touchmove target). */
  fgEl: HTMLElement;
  /** The `.m-card` root that is translated to follow the finger. */
  liEl: HTMLElement;
  /** The vertical scroller (`.m-page`) the auto-scroll drives. */
  scroller: HTMLElement;
  /** clientY at the moment the press landed — the finger's anchor. */
  anchorY: number;
  /** Latest clientY, kept fresh for auto-scroll frames between moves. */
  lastClientY: number;
  /** Scroller scrollTop at arm time; the delta since keeps rects/transform honest. */
  startScrollTop: number;
  /** Cached rects of every card (list order, viewport coords at arm time). */
  rects: Rect[];
  raf: number | null;
  onTouchMove: (e: TouchEvent) => void;
}

/** Pending press, before the timer fires (or is cancelled). */
interface Press {
  id: string;
  index: number;
  pointerId: number;
  fgEl: HTMLElement;
  scroller: HTMLElement;
  anchorX: number;
  anchorY: number;
  timer: number;
  onTouchMove: (e: TouchEvent) => void;
}

export interface ReorderBinding {
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
    onContextMenu: (e: ReactMouseEvent) => void;
  };
  onClickCapture: (e: ReactMouseEvent) => void;
  /** Extra `.m-card` classes for this card's current drag/insert state. */
  className: string;
  /** True while this card is the one being dragged — the card disables its swipe. */
  dragging: boolean;
}

export interface UseLongPressReorderResult {
  /** Build the props a Today card spreads onto its swipe surface (plan §4). */
  bind: (id: string, index: number, canDrag: boolean) => ReorderBinding;
  /** The card id being dragged, or null. */
  dragId: string | null;
  /** Insertion slot (0..N) the drag currently targets, or null when it is a
   *  no-op (over the dragged card's own home) — the page draws the indicator. */
  insertSlot: number | null;
}

/**
 * Long-press-drag reorder for Today cards (plan §4, the redesign's highest-risk
 * hook — kept deliberately small). A stationary 400ms hold on a collapsed,
 * non-editing card arms drag mode; the card then follows the finger vertically
 * (direct `translateY` writes) while a slot is computed from the pointer against
 * cached sibling rects ({@link slotForPointerY}). Release commits the same
 * splice math as desktop ({@link reorderTargetIndex} → `reorderToday`).
 *
 * Coexistence with {@link ./useCardSwipe}: both share the card surface. The arm
 * threshold (8px) sits under the swipe slop (12px), so any real movement cancels
 * the hold before the swipe locks — a hold only arms when the finger was still.
 * Native scroll is suppressed the dnd-kit way: a non-passive `touchmove`
 * listener registered at pointerdown calls `preventDefault` *only while armed*
 * (no native pan is in flight then, since arming required no movement). The
 * pointer is captured on the card so drags that leave its bounds keep flowing;
 * the card reports `dragging` so its swipe hook goes inert for the gesture.
 */
export function useLongPressReorder(
  onReorder: (id: string, targetIndex: number) => void,
): UseLongPressReorderResult {
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const press = useRef<Press | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [insertSlot, setInsertSlot] = useState<number | null>(null);

  // Recompute the dragged card's transform and the target slot from the latest
  // finger position and scroll offset. Called on every move and auto-scroll
  // frame. Slot 0..N over the cached rects (the dragged card included, matching
  // desktop); a slot over the card's own home resolves to a no-op → null.
  const updateDrag = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const scrollDelta = d.scroller.scrollTop - d.startScrollTop;
    // The card is in the scroller's flow, so it scrolls with content; add the
    // scroll delta to the finger delta to keep it pinned under the finger.
    const ty = d.lastClientY - d.anchorY + scrollDelta;
    d.liEl.style.transform = `translateY(${ty}px) scale(1.02)`;

    const eff = d.rects.map((r) => ({ top: r.top - scrollDelta, height: r.height }));
    const slot = slotForPointerY(d.lastClientY, eff);
    // A card at `from` owns slots {from, from+1}; both are no-op targets.
    const next = slot === d.from || slot === d.from + 1 ? null : slot;
    setInsertSlot((prev) => (prev === next ? prev : next));
  }, []);

  const autoScroll = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const rect = d.scroller.getBoundingClientRect();
    let delta = 0;
    if (d.lastClientY < rect.top + EDGE) delta = -AUTO_SPEED;
    else if (d.lastClientY > rect.bottom - EDGE) delta = AUTO_SPEED;
    if (delta !== 0) {
      const before = d.scroller.scrollTop;
      d.scroller.scrollTop = before + delta;
      if (d.scroller.scrollTop !== before) updateDrag();
    }
    d.raf = requestAnimationFrame(autoScroll);
  }, [updateDrag]);

  const clearPress = useCallback(() => {
    const p = press.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    p.fgEl.removeEventListener('touchmove', p.onTouchMove);
    press.current = null;
  }, []);

  const arm = useCallback(() => {
    const p = press.current;
    if (!p) return;
    press.current = null; // promoted to a live drag; keep its touchmove listener
    const liEl = p.fgEl.closest('.m-card') as HTMLElement | null;
    const list = liEl?.parentElement;
    if (!liEl || !list) {
      p.fgEl.removeEventListener('touchmove', p.onTouchMove);
      return;
    }
    const rects: Rect[] = Array.from(list.children).map((c) => {
      const r = (c as HTMLElement).getBoundingClientRect();
      return { top: r.top, height: r.height };
    });
    try {
      p.fgEl.setPointerCapture(p.pointerId);
    } catch {
      /* element may be detaching; ignore */
    }
    liEl.style.transition = 'none';
    const d: Drag = {
      id: p.id,
      from: p.index,
      pointerId: p.pointerId,
      fgEl: p.fgEl,
      liEl,
      scroller: p.scroller,
      anchorY: p.anchorY,
      lastClientY: p.anchorY,
      startScrollTop: p.scroller.scrollTop,
      rects,
      raf: null,
      onTouchMove: p.onTouchMove,
    };
    drag.current = d;
    suppressClick.current = true;
    navigator.vibrate?.(10);
    setDragId(d.id);
    updateDrag();
    d.raf = requestAnimationFrame(autoScroll);
  }, [autoScroll, updateDrag]);

  const endDrag = useCallback((commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.raf !== null) cancelAnimationFrame(d.raf);
    d.fgEl.removeEventListener('touchmove', d.onTouchMove);
    try {
      d.fgEl.releasePointerCapture(d.pointerId);
    } catch {
      /* ignore */
    }

    let target: number | null = null;
    if (commit) {
      const scrollDelta = d.scroller.scrollTop - d.startScrollTop;
      const eff = d.rects.map((r) => ({ top: r.top - scrollDelta, height: r.height }));
      const t = reorderTargetIndex(slotForPointerY(d.lastClientY, eff), d.from);
      if (t !== d.from) target = t;
    }

    // Drop the transform; the list re-renders in the new order and the card
    // settles into its flow position.
    d.liEl.style.transition = '';
    d.liEl.style.transform = '';
    setDragId(null);
    setInsertSlot(null);
    if (target !== null) onReorderRef.current(d.id, target);

    // A trailing click only sometimes follows a preventDefaulted touch drag;
    // when none arrives the armed suppression would eat the user's next real
    // tap, so let it lapse shortly after the gesture.
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 250);
  }, []);

  // Guard against unmount mid-gesture (e.g. page swiped away).
  useEffect(
    () => () => {
      clearPress();
      endDrag(false);
    },
    [clearPress, endDrag],
  );

  const onPointerDown = useCallback(
    (id: string, index: number, canDrag: boolean, e: ReactPointerEvent) => {
      if (!canDrag) return;
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      if (press.current || drag.current) return;
      const fgEl = e.currentTarget as HTMLElement;
      const scroller = fgEl.closest('.m-page') as HTMLElement | null;
      if (!scroller) return;
      // Registered now (a non-passive listener added mid-touch would not
      // reliably cancel a scroll already in progress); it no-ops until armed.
      const onTouchMove = (te: TouchEvent) => {
        if (drag.current) te.preventDefault();
      };
      fgEl.addEventListener('touchmove', onTouchMove, { passive: false });
      const timer = window.setTimeout(arm, LONG_PRESS_MS);
      press.current = {
        id,
        index,
        pointerId: e.pointerId,
        fgEl,
        scroller,
        anchorX: e.clientX,
        anchorY: e.clientY,
        timer,
        onTouchMove,
      };
    },
    [arm],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const d = drag.current;
      if (d && e.pointerId === d.pointerId) {
        d.lastClientY = e.clientY;
        updateDrag();
        return;
      }
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      // Any movement past the arm threshold means this is a scroll/swipe, not a
      // hold — abandon the pending arm and let the swipe hook own the gesture.
      if (Math.hypot(e.clientX - p.anchorX, e.clientY - p.anchorY) > MOVE_CANCEL) clearPress();
    },
    [clearPress, updateDrag],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const d = drag.current;
      if (d && e.pointerId === d.pointerId) {
        endDrag(true);
        return;
      }
      const p = press.current;
      if (p && e.pointerId === p.pointerId) clearPress();
    },
    [clearPress, endDrag],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent) => {
      const d = drag.current;
      if (d && e.pointerId === d.pointerId) {
        endDrag(false);
        return;
      }
      const p = press.current;
      if (p && e.pointerId === p.pointerId) clearPress();
    },
    [clearPress, endDrag],
  );

  const onContextMenu = useCallback((e: ReactMouseEvent) => {
    if (press.current || drag.current) e.preventDefault();
  }, []);

  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const bind = useCallback(
    (id: string, index: number, canDrag: boolean): ReorderBinding => {
      const dragging = dragId === id;
      const className =
        (dragging ? ' m-card--drag' : '') + (insertSlot === index ? ' m-card--insert-before' : '');
      return {
        handlers: {
          onPointerDown: (e) => onPointerDown(id, index, canDrag, e),
          onPointerMove,
          onPointerUp,
          onPointerCancel,
          onContextMenu,
        },
        onClickCapture,
        className,
        dragging,
      };
    },
    [dragId, insertSlot, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu, onClickCapture],
  );

  return { bind, dragId, insertSlot };
}
