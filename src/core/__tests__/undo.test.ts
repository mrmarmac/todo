import { describe, it, expect } from 'vitest';
import { initialState, createTask, deleteTask, moveToToday } from '../state';
import { liveUndo, type PendingUndo } from '../undo';

/**
 * Undo restores a full pre-action snapshot, so it is only safe while nothing
 * else has changed since the action it undoes. Any later change — a tick, an
 * edit, a sync pull — must retire it, or Undo would silently revert that change.
 */
function setup() {
  let before = initialState(new Date('2026-11-21T09:00:00Z'));
  before = createTask(before, { title: 'A' });
  before = createTask(before, { title: 'B' });
  const a = before.tasks[0].id;
  const after = deleteTask(before, a);
  const pending: PendingUndo = { message: 'Task deleted', snapshot: before, after };
  return { before, after, pending };
}

describe('liveUndo', () => {
  it('keeps the undo while state is exactly what the action produced', () => {
    const { after, pending } = setup();
    expect(liveUndo(pending, after)).toBe(pending);
  });

  it('retires the undo once anything else changed state', () => {
    const { after, pending } = setup();
    const b = after.tasks[0].id;
    const later = moveToToday(after, b);
    expect(liveUndo(pending, later)).toBeNull();
  });

  it('is null when there is no pending undo', () => {
    const { after } = setup();
    expect(liveUndo(null, after)).toBeNull();
  });
});
