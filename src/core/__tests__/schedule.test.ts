import { describe, it, expect } from 'vitest';
import { initialState, createTask, updateTask, moveToToday } from '../state';
import { isScheduledOn, formatRepeatDays } from '../schedule';
import { isAppState } from '../storage';
import type { AppState } from '../types';

/**
 * Recurring schedules (D60): a recurring master may list the weekdays it
 * recurs on (0 = Monday … 6 = Sunday). The schedule only drives suggestions on
 * the Plan my day screen — nothing is ever added to Today automatically.
 */
function withRecurring(): { s: AppState; id: string } {
  let s = initialState(new Date('2026-11-21T09:00:00Z'));
  s = createTask(s, { title: 'Gym', isRecurring: true });
  return { s, id: s.tasks[0].id };
}

describe('updateTask repeatDays', () => {
  it('stores the weekdays sorted and de-duplicated', () => {
    const { s, id } = withRecurring();
    const next = updateTask(s, id, { repeatDays: [4, 0, 2, 0] });
    expect(next.tasks[0].repeatDays).toEqual([0, 2, 4]);
  });

  it('throws on a day outside 0–6', () => {
    const { s, id } = withRecurring();
    expect(() => updateTask(s, id, { repeatDays: [7] })).toThrow();
    expect(() => updateTask(s, id, { repeatDays: [1.5] })).toThrow();
  });

  it('an empty list clears the schedule', () => {
    const { s, id } = withRecurring();
    const scheduled = updateTask(s, id, { repeatDays: [0] });
    expect(updateTask(scheduled, id, { repeatDays: [] }).tasks[0].repeatDays).toEqual([]);
  });
});

describe('isScheduledOn', () => {
  // 2026-11-23 is a Monday (0), 2026-11-21 a Saturday (5).
  it('is true for a recurring master on one of its days', () => {
    const { s, id } = withRecurring();
    const t = updateTask(s, id, { repeatDays: [0, 2] }).tasks[0];
    expect(isScheduledOn(t, '2026-11-23')).toBe(true);
    expect(isScheduledOn(t, '2026-11-21')).toBe(false);
  });

  it('is false with no schedule, or when the task is not recurring', () => {
    const { s, id } = withRecurring();
    expect(isScheduledOn(s.tasks[0], '2026-11-23')).toBe(false);
    const t = updateTask(s, id, { repeatDays: [0], isRecurring: false }).tasks[0];
    expect(isScheduledOn(t, '2026-11-23')).toBe(false);
  });
});

describe('day-copies', () => {
  it('do not carry the master schedule', () => {
    const { s, id } = withRecurring();
    const next = moveToToday(updateTask(s, id, { repeatDays: [0] }), id);
    const copy = next.tasks.find((t) => t.sourceTaskId === id)!;
    expect(copy.repeatDays).toBeUndefined();
  });
});

describe('storage validation', () => {
  it('accepts tasks with and without repeatDays (older data has none)', () => {
    const { s, id } = withRecurring();
    expect(isAppState(s)).toBe(true);
    expect(isAppState(updateTask(s, id, { repeatDays: [0, 6] }))).toBe(true);
  });

  it('rejects a malformed repeatDays', () => {
    const { s } = withRecurring();
    const bad = { ...s, tasks: [{ ...s.tasks[0], repeatDays: ['mon'] }] };
    expect(isAppState(bad)).toBe(false);
  });
});

describe('formatRepeatDays', () => {
  it('names the common patterns and lists the rest', () => {
    expect(formatRepeatDays([0, 1, 2, 3, 4, 5, 6])).toBe('daily');
    expect(formatRepeatDays([0, 1, 2, 3, 4])).toBe('weekdays');
    expect(formatRepeatDays([5, 6])).toBe('weekends');
    expect(formatRepeatDays([0, 2, 4])).toBe('mon wed fri');
  });

  it('is null with no schedule', () => {
    expect(formatRepeatDays(undefined)).toBeNull();
    expect(formatRepeatDays([])).toBeNull();
  });
});
