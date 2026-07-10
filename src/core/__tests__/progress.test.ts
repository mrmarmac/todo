import { describe, it, expect } from 'vitest';
import { dayProgress } from '../progress';
import {
  initialState,
  createTask,
  moveToToday,
  completeTask,
  clearDone,
  startNewDay,
} from '../state';
import type { AppState } from '../types';

/**
 * dayProgress (plan §5) drives the mobile day-progress bar. Its contract:
 * "done" counts both tasks still sitting in the Done column and task
 * occurrences already collapsed into history under the current day — so the
 * bar survives a Clear — while history from other days never leaks in.
 */

const NOW = new Date('2026-07-10T09:00:00Z');

function seedToday(titles: string[]): AppState {
  let s = initialState(NOW);
  for (const title of titles) s = createTask(s, { title });
  for (const title of titles) {
    const id = s.tasks.find((t) => t.title === title && t.column === 'master')!.id;
    s = moveToToday(s, id);
  }
  return s;
}

function completeByTitle(s: AppState, title: string): AppState {
  const id = s.tasks.find((t) => t.title === title)!.id;
  return completeTask(s, id);
}

describe('dayProgress', () => {
  it('is 0/0 on an empty state', () => {
    expect(dayProgress(initialState(NOW))).toEqual({ done: 0, total: 0 });
  });

  it('ignores tasks still in Master', () => {
    let s = initialState(NOW);
    s = createTask(s, { title: 'someday' });
    expect(dayProgress(s)).toEqual({ done: 0, total: 0 });
  });

  it('counts open Today tasks in the total and Done-column tasks as done', () => {
    let s = seedToday(['A', 'B', 'C']);
    expect(dayProgress(s)).toEqual({ done: 0, total: 3 });

    s = completeByTitle(s, 'B');
    expect(dayProgress(s)).toEqual({ done: 1, total: 3 });
  });

  it('survives Clear: cleared history for the current day still counts as done', () => {
    let s = seedToday(['A', 'B']);
    s = completeByTitle(s, 'A');
    s = clearDone(s, NOW);
    expect(s.tasks.filter((t) => t.column === 'done')).toHaveLength(0);
    expect(dayProgress(s)).toEqual({ done: 1, total: 2 });
  });

  it('counts only task occurrences, not their subtask history entries', () => {
    let s = seedToday(['A']);
    // Complete a subtask before completing the parent, so clearDone logs both
    // a task and a subtask entry for the same day.
    const a = s.tasks.find((t) => t.title === 'A')!;
    s = {
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === a.id
          ? { ...t, subtasks: [{ id: 'sub', title: 'part', isCompleted: true, isActive: false }] }
          : t,
      ),
    };
    s = completeByTitle(s, 'A');
    s = clearDone(s, NOW);
    expect(s.history).toHaveLength(2);
    expect(dayProgress(s)).toEqual({ done: 1, total: 1 });
  });

  it('resets after startNewDay: yesterday’s history is excluded', () => {
    let s = seedToday(['A', 'B']);
    s = completeByTitle(s, 'A');
    s = startNewDay(s, new Date('2026-07-11T08:00:00Z'));
    // A's completion is logged under 2026-07-10; B returned to Master.
    expect(s.history.some((h) => h.day === '2026-07-10')).toBe(true);
    expect(dayProgress(s)).toEqual({ done: 0, total: 0 });
  });
});
