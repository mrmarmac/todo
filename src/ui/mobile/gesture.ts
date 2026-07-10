/**
 * Pure, DOM-free helpers for the mobile card-swipe state machine (plan §3
 * gestures). Kept separate from {@link ./useCardSwipe} so the tricky numeric
 * rules — axis locking, commit thresholds, resistance, velocity — are unit
 * testable in the node vitest environment with no jsdom or pointer plumbing.
 * All functions are side-effect free.
 */

/** Minimum finger travel (px) before a drag axis is committed. */
export const SLOP = 12;

/** Sliding window (ms) the velocity tracker averages over. */
export const VELOCITY_WINDOW_MS = 80;

/**
 * Decide the drag axis from the running deltas, or `null` while still under the
 * {@link SLOP} threshold (movement too small to be intentional). Horizontal
 * wins only when it clearly dominates (`|dx| > |dy|`); a diagonal tie
 * (`|dx| === |dy|`) resolves to vertical so native scrolling — the more common
 * intent on a tall list — is never stolen by an ambiguous drag.
 */
export function lockAxis(dx: number, dy: number): 'horizontal' | 'vertical' | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= SLOP && ax > ay) return 'horizontal';
  if (ay >= SLOP && ay >= ax) return 'vertical';
  return null;
}

export interface CommitInput {
  /** Horizontal offset of the card from rest (px, positive = rightward). */
  dx: number;
  /** Horizontal velocity at release (px/ms, positive = rightward). */
  vx: number;
  /** Card width (px) — the distance rule scales with it, capped at 140px. */
  width: number;
}

/**
 * Whether a right-swipe should commit its action on release. Commits when the
 * card has been dragged far enough (35% of its width, capped at 140px so a wide
 * card never demands an unreachable drag) OR flicked fast enough (≥0.5 px/ms)
 * past a short minimum travel (48px) so a quick decisive flick counts even when
 * short.
 */
export function shouldCommitSwipe({ dx, vx, width }: CommitInput): boolean {
  const distanceThreshold = Math.min(0.35 * width, 140);
  if (dx >= distanceThreshold) return true;
  return vx >= 0.5 && dx >= 48;
}

/**
 * Rubber-band resistance for a drag that cannot travel freely (a blocked
 * right-swipe, or overscroll past a reveal stop): the finger still moves the
 * card, but only a fraction `1/factor` as far, so the surface feels pinned
 * without going rigid. Sign-preserving.
 */
export function dampen(dx: number, factor = 3): number {
  return dx / factor;
}

/**
 * Fixed-window velocity tracker: feed it timestamped x samples during a drag
 * and read `velocity()` at release. Averages over the most recent
 * {@link VELOCITY_WINDOW_MS} so a slow drag that ends in a flick reports the
 * flick, not the whole-gesture average, while always retaining at least two
 * samples so a value is available even right after a pause.
 */
export class VelocityTracker {
  private samples: { x: number; t: number }[] = [];

  reset(): void {
    this.samples = [];
  }

  add(x: number, t: number): void {
    this.samples.push({ x, t });
    const cutoff = t - VELOCITY_WINDOW_MS;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
  }

  /** px/ms across the retained window; 0 with fewer than two samples or no elapsed time. */
  velocity(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return 0;
    return (last.x - first.x) / dt;
  }
}
