import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';

/**
 * Two-phase exit-commit (D52).
 *
 * The core reducers are instant and inverse-less: `completeTask`,
 * `moveToToday`, `removeFromToday` move a task between columns in a single
 * state commit, so the row unmounts from one list and mounts in the other on
 * the very next render — there is no window to animate. This hook opens that
 * window: `beginExit` marks a still-mounted row with an animation class, waits
 * for the animation to finish, *then* runs the actual `setState`.
 *
 * Why the commit must not depend on a visible duration: under
 * `prefers-reduced-motion` every animation is clamped to ~0ms, so `animationend`
 * still fires (near-instantly) and the row still commits. A fallback timeout
 * covers the case where `animationend` never arrives at all (interrupted
 * animation, a browser that drops the event). Never gate a state change on an
 * animation that might not run.
 */

/**
 * Longest we wait for `animationend` before committing anyway, in ms. Must
 * exceed the slowest exit animation (completion, ~400ms). Under reduced motion
 * the animation ends first and this never fires.
 */
const EXIT_FALLBACK_MS = 550;

export interface UseRowExitResult {
  /** The exit class to apply to the row `id`, or '' when it is not exiting. */
  exitClassFor: (id: string) => string;
  /**
   * Start an exit on row `id`: apply `className`, then run `commit` once the
   * row's own animation ends (or the fallback fires). A repeat call for an id
   * already exiting is ignored, so a rapid double-click or key-repeat commits
   * exactly once.
   */
  beginExit: (id: string, className: string, commit: () => void) => void;
  /**
   * Wire to the row's `onAnimationEnd`. Commits when the row's *own* exit
   * animation ends — child animations (tick draw, strikethrough) bubble to the
   * same handler and are ignored via the target/currentTarget check.
   */
  onRowAnimationEnd: (id: string, e: AnimationEvent) => void;
}

export function useRowExit(): UseRowExitResult {
  const [exiting, setExiting] = useState<Record<string, string>>({});
  // Pending commits + fallback timers keyed by row id. Refs, so the stable
  // callbacks below never capture a stale map and cleanup can reach them.
  const commits = useRef<Map<string, () => void>>(new Map());
  const timers = useRef<Map<string, number>>(new Map());

  const runCommit = useCallback((id: string) => {
    const commit = commits.current.get(id);
    // Already fired (a second animationend, or fallback racing the event) —
    // this is the single-commit guard.
    if (commit === undefined) return;
    commits.current.delete(id);
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setExiting((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    commit();
  }, []);

  const beginExit = useCallback(
    (id: string, className: string, commit: () => void) => {
      if (commits.current.has(id)) return; // already exiting — ignore
      commits.current.set(id, commit);
      setExiting((prev) => ({ ...prev, [id]: className }));
      timers.current.set(
        id,
        window.setTimeout(() => runCommit(id), EXIT_FALLBACK_MS),
      );
    },
    [runCommit],
  );

  const onRowAnimationEnd = useCallback(
    (id: string, e: AnimationEvent) => {
      // Only the row-level exit commits; descendant animations bubble here too.
      if (e.target !== e.currentTarget) return;
      runCommit(id);
    },
    [runCommit],
  );

  const exitClassFor = useCallback((id: string) => exiting[id] ?? '', [exiting]);

  // Clear pending fallback timers if the column unmounts mid-exit.
  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach((timer) => window.clearTimeout(timer));
      t.clear();
    };
  }, []);

  return { exitClassFor, beginExit, onRowAnimationEnd };
}
