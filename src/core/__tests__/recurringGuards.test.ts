import { describe, it, expect } from 'vitest';
import {
  createTask,
  deleteTask,
  hasDayCopyInToday,
  initialState,
  moveToToday,
  removeFromToday,
  reorderToday,
  startNewDay,
} from '../state';
import type { AppState } from '../types';

const NOW = new Date('2026-07-25T09:00:00Z');

function lastId(state: AppState): string {
  return state.tasks[state.tasks.length - 1].id;
}

/** A recurring master plus its day-copy in Today. */
function withRecurringInToday(): { state: AppState; masterId: string; copyId: string } {
  let state = createTask(initialState(NOW), { title: 'Stretch', isRecurring: true });
  const masterId = lastId(state);
  state = moveToToday(state, masterId);
  return { state, masterId, copyId: lastId(state) };
}

describe('deleteTask cascades to day-copies (D42)', () => {
  it('removes the Today copy along with its recurring master', () => {
    const { state, masterId } = withRecurringInToday();
    expect(state.tasks).toHaveLength(2);

    const next = deleteTask(state, masterId);
    expect(next.tasks).toHaveLength(0);
  });

  it('removes a Done copy along with its master', () => {
    const { state, masterId, copyId } = withRecurringInToday();
    const completed: AppState = {
      ...state,
      tasks: state.tasks.map((t) => (t.id === copyId ? { ...t, column: 'done' as const } : t)),
    };
    expect(deleteTask(completed, masterId).tasks).toHaveLength(0);
  });

  it('leaves an unrelated recurring task and its copy alone', () => {
    let state = createTask(initialState(NOW), { title: 'Stretch', isRecurring: true });
    const keepId = lastId(state);
    state = moveToToday(state, keepId);
    state = createTask(state, { title: 'Read', isRecurring: true });
    const dropId = lastId(state);
    state = moveToToday(state, dropId);

    const next = deleteTask(state, dropId);
    expect(next.tasks.map((t) => t.title)).toEqual(['Stretch', 'Stretch']);
  });

  it('still deletes a plain master with no copies', () => {
    const state = createTask(initialState(NOW), { title: 'One-off' });
    const id = lastId(state);
    expect(deleteTask(state, id).tasks).toHaveLength(0);
  });

  it('no longer leaves an orphan that removeFromToday silently destroys', () => {
    // The bug: the master went away, the copy kept a sourceTaskId pointing at
    // nothing, and removeFromToday then took the "discard the day-copy" branch
    // instead of returning the task to Master.
    const { state, masterId, copyId } = withRecurringInToday();
    const orphaned = deleteTask(state, masterId);
    expect(orphaned.tasks.find((t) => t.id === copyId)).toBeUndefined();
  });
});

describe('moveToToday guards against duplicate day-copies (D43)', () => {
  it('ignores a second add while a copy is already in Today', () => {
    const { state, masterId } = withRecurringInToday();
    const next = moveToToday(state, masterId);

    expect(next).toBe(state);
    expect(next.tasks.filter((t) => t.column === 'today')).toHaveLength(1);
  });

  it('allows a fresh copy once the previous one leaves Today', () => {
    const { state, masterId, copyId } = withRecurringInToday();
    const removed = removeFromToday(state, copyId);
    const readded = moveToToday(removed, masterId);

    expect(readded.tasks.filter((t) => t.column === 'today')).toHaveLength(1);
    expect(readded.tasks.filter((t) => t.column === 'master')).toHaveLength(1);
  });

  it('allows a fresh copy on the next day', () => {
    const { state, masterId } = withRecurringInToday();
    const tomorrow = startNewDay(state, new Date('2026-07-26T09:00:00Z'));
    const readded = moveToToday(tomorrow, masterId);

    expect(readded.tasks.filter((t) => t.column === 'today')).toHaveLength(1);
  });

  it('does not block a different recurring master', () => {
    let { state } = withRecurringInToday();
    state = createTask(state, { title: 'Read', isRecurring: true });
    const otherId = lastId(state);

    const next = moveToToday(state, otherId);
    expect(next.tasks.filter((t) => t.column === 'today')).toHaveLength(2);
  });

  it('still moves a non-recurring master exactly once', () => {
    let state = createTask(initialState(NOW), { title: 'One-off' });
    const id = lastId(state);
    state = moveToToday(state, id);

    // Second call is already a no-op: the task is no longer in Master.
    expect(moveToToday(state, id)).toBe(state);
    expect(state.tasks.filter((t) => t.column === 'today')).toHaveLength(1);
  });

  it('hasDayCopyInToday reports the guard condition', () => {
    const { state, masterId, copyId } = withRecurringInToday();
    expect(hasDayCopyInToday(state, masterId)).toBe(true);
    expect(hasDayCopyInToday(removeFromToday(state, copyId), masterId)).toBe(false);
    expect(hasDayCopyInToday(state, 'nope')).toBe(false);
  });
});

describe('reorderToday clamps targetIndex', () => {
  function threeInToday(): AppState {
    let state = initialState(NOW);
    for (const title of ['a', 'b', 'c']) {
      state = createTask(state, { title });
      state = moveToToday(state, lastId(state));
    }
    return state;
  }

  const titles = (s: AppState) => s.tasks.map((t) => t.title);

  it('treats a negative index as the front, not an offset from the end', () => {
    // Unclamped, splice(-1) inserts second-from-last: ['b','a','c'].
    expect(titles(reorderToday(threeInToday(), threeInToday().tasks[0].id, -1))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('clamps a large index to the end', () => {
    const state = threeInToday();
    expect(titles(reorderToday(state, state.tasks[0].id, 99))).toEqual(['b', 'c', 'a']);
  });

  it('truncates a fractional index', () => {
    const state = threeInToday();
    expect(titles(reorderToday(state, state.tasks[0].id, 1.9))).toEqual(['b', 'a', 'c']);
  });

  it('treats a non-finite index as the front', () => {
    const state = threeInToday();
    expect(titles(reorderToday(state, state.tasks[0].id, Number.NaN))).toEqual(['a', 'b', 'c']);
  });

  it('still performs an ordinary in-range move', () => {
    const state = threeInToday();
    expect(titles(reorderToday(state, state.tasks[2].id, 0))).toEqual(['c', 'a', 'b']);
  });
});
