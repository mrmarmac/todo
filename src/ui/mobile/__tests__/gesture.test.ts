import { describe, it, expect } from 'vitest';
import {
  lockAxis,
  shouldCommitSwipe,
  dampen,
  VelocityTracker,
  SLOP,
  slotForPointerY,
  reorderTargetIndex,
} from '../gesture';

describe('lockAxis', () => {
  it('stays null while both deltas are under the slop', () => {
    expect(lockAxis(0, 0)).toBeNull();
    expect(lockAxis(11, 5)).toBeNull();
    expect(lockAxis(-5, -11)).toBeNull();
    expect(lockAxis(SLOP - 1, SLOP - 1)).toBeNull();
  });

  it('locks horizontal when |dx| reaches slop and dominates', () => {
    expect(lockAxis(12, 0)).toBe('horizontal');
    expect(lockAxis(20, 10)).toBe('horizontal');
    expect(lockAxis(-15, 5)).toBe('horizontal');
  });

  it('locks vertical when |dy| reaches slop and is at least |dx|', () => {
    expect(lockAxis(0, 12)).toBe('vertical');
    expect(lockAxis(10, 20)).toBe('vertical');
    expect(lockAxis(5, -15)).toBe('vertical');
  });

  it('resolves a diagonal tie to vertical (never steal native scroll)', () => {
    expect(lockAxis(12, 12)).toBe('vertical');
    expect(lockAxis(-30, 30)).toBe('vertical');
  });

  it('does not lock horizontal on a big-but-tied drag under equal magnitudes', () => {
    // |dx| === |dy| both over slop: horizontal needs strict dominance, so vertical wins.
    expect(lockAxis(40, 40)).toBe('vertical');
  });
});

describe('shouldCommitSwipe', () => {
  it('commits on the distance rule at 35% of a narrow card', () => {
    const width = 300; // 35% = 105, under the 140 cap
    expect(shouldCommitSwipe({ dx: 104, vx: 0, width })).toBe(false);
    expect(shouldCommitSwipe({ dx: 105, vx: 0, width })).toBe(true);
  });

  it('caps the distance threshold at 140px on a wide card', () => {
    const width = 1000; // 35% = 350, but the cap is 140
    expect(shouldCommitSwipe({ dx: 139, vx: 0, width })).toBe(false);
    expect(shouldCommitSwipe({ dx: 140, vx: 0, width })).toBe(true);
  });

  it('commits on a fast flick past the short minimum even when distance is small', () => {
    const width = 400;
    expect(shouldCommitSwipe({ dx: 48, vx: 0.5, width })).toBe(true);
    expect(shouldCommitSwipe({ dx: 60, vx: 0.6, width })).toBe(true);
  });

  it('does not commit a flick that is too slow or too short', () => {
    const width = 400;
    expect(shouldCommitSwipe({ dx: 48, vx: 0.49, width })).toBe(false); // too slow
    expect(shouldCommitSwipe({ dx: 47, vx: 1.0, width })).toBe(false); // too short
  });

  it('does not commit a sub-threshold drag', () => {
    expect(shouldCommitSwipe({ dx: 10, vx: 0, width: 390 })).toBe(false);
  });
});

describe('dampen', () => {
  it('reduces travel by the factor and preserves sign', () => {
    expect(dampen(30)).toBe(10);
    expect(dampen(-30)).toBe(-10);
    expect(dampen(30, 2)).toBe(15);
    expect(dampen(0)).toBe(0);
  });
});

describe('VelocityTracker', () => {
  it('returns 0 with fewer than two samples', () => {
    const v = new VelocityTracker();
    expect(v.velocity()).toBe(0);
    v.add(0, 0);
    expect(v.velocity()).toBe(0);
  });

  it('computes px/ms across the retained window and drops stale samples', () => {
    const v = new VelocityTracker();
    // Samples every 20ms; window is 80ms.
    v.add(0, 0);
    v.add(10, 20);
    v.add(20, 40);
    v.add(30, 60);
    v.add(40, 80);
    v.add(50, 100); // cutoff = 20 → the t=0 sample is dropped
    // Retained: (10,20)…(50,100) → (50-10)/(100-20) = 0.5 px/ms
    expect(v.velocity()).toBeCloseTo(0.5, 5);
  });

  it('reports a negative velocity for a leftward drag', () => {
    const v = new VelocityTracker();
    v.add(100, 0);
    v.add(60, 40);
    v.add(20, 80);
    expect(v.velocity()).toBeLessThan(0);
    expect(v.velocity()).toBeCloseTo(-1, 5);
  });

  it('always keeps at least two samples even after a long pause', () => {
    const v = new VelocityTracker();
    v.add(0, 0);
    v.add(100, 1000); // far outside the window, but must not empty the buffer
    expect(v.velocity()).toBeCloseTo(0.1, 5);
  });

  it('resets to empty', () => {
    const v = new VelocityTracker();
    v.add(0, 0);
    v.add(10, 10);
    v.reset();
    expect(v.velocity()).toBe(0);
  });
});

describe('slotForPointerY', () => {
  // Three stacked 100px cards at y = 0, 100, 200 (midpoints 50, 150, 250).
  const rects = [
    { top: 0, height: 100 },
    { top: 100, height: 100 },
    { top: 200, height: 100 },
  ];

  it('inserts before the first card when the pointer is above everything', () => {
    expect(slotForPointerY(-20, rects)).toBe(0);
    expect(slotForPointerY(0, rects)).toBe(0);
    expect(slotForPointerY(49, rects)).toBe(0);
  });

  it('treats exactly the midpoint as below it (insert after)', () => {
    // clientY < mid is strict, so the midpoint itself falls to the next card.
    expect(slotForPointerY(50, rects)).toBe(1);
    expect(slotForPointerY(150, rects)).toBe(2);
    expect(slotForPointerY(250, rects)).toBe(3);
  });

  it('inserts between cards from the midpoint rule', () => {
    expect(slotForPointerY(51, rects)).toBe(1);
    expect(slotForPointerY(149, rects)).toBe(1);
    expect(slotForPointerY(151, rects)).toBe(2);
  });

  it('inserts after the last card when the pointer is below everything', () => {
    expect(slotForPointerY(260, rects)).toBe(3);
    expect(slotForPointerY(9999, rects)).toBe(3);
  });

  it('returns slot 0 for an empty list', () => {
    expect(slotForPointerY(123, [])).toBe(0);
  });
});

describe('reorderTargetIndex', () => {
  it('shifts a slot past the dragged card down by one', () => {
    // Dragged from index 1; dropping at slot 3 (after the 3rd card) targets 2.
    expect(reorderTargetIndex(3, 1)).toBe(2);
  });

  it('leaves a slot at or before the dragged card unchanged', () => {
    expect(reorderTargetIndex(0, 2)).toBe(0);
    expect(reorderTargetIndex(2, 2)).toBe(2); // slot === from: no shift
  });

  it('maps both of the dragged card own-position slots to a no-op index', () => {
    // A card at `from` occupies slots {from, from+1}; both must resolve to `from`.
    expect(reorderTargetIndex(2, 2)).toBe(2);
    expect(reorderTargetIndex(3, 2)).toBe(2);
  });
});
