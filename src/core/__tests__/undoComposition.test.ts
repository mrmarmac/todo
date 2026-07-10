import { describe, it, expect } from 'vitest';
import { initialState, createTask, moveToToday, completeTask, uncompleteTask, reorderToday, removeFromToday } from '../state';
import type { AppState } from '../types';

/**
 * Undo composition (plan §4): the mobile swipe-undo toast never snapshots
 * state — it composes existing inverse reducers. These tests pin the exact
 * compositions the Toast wires up so a reducer change that breaks them fails
 * here rather than only under a finger on a phone.
 */

function todayTitles(s: AppState): string[] {
  return s.tasks.filter((t) => t.column === 'today').map((t) => t.title);
}

function seedThreeInToday(): AppState {
  let s = initialState(new Date('2026-07-10T09:00:00Z'));
  for (const title of ['A', 'B', 'C']) {
    s = createTask(s, { title });
  }
  // Move each master into Today in order → Today order is [A, B, C].
  for (const title of ['A', 'B', 'C']) {
    const id = s.tasks.find((t) => t.title === title && t.column === 'master')!.id;
    s = moveToToday(s, id);
  }
  return s;
}

describe('complete → undo restores the exact Today order for a middle task', () => {
  it('reorderToday(uncompleteTask(s, id), id, oldIndex) puts B back at index 1', () => {
    const seeded = seedThreeInToday();
    expect(todayTitles(seeded)).toEqual(['A', 'B', 'C']);

    const b = seeded.tasks.find((t) => t.title === 'B')!;
    const oldIndex = seeded.tasks.filter((t) => t.column === 'today').findIndex((t) => t.id === b.id);
    expect(oldIndex).toBe(1);

    const completed = completeTask(seeded, b.id);
    expect(todayTitles(completed)).toEqual(['A', 'C']);
    expect(completed.tasks.find((t) => t.id === b.id)!.column).toBe('done');

    // uncompleteTask alone appends B to the end; reorder restores its slot.
    const appended = uncompleteTask(completed, b.id);
    expect(todayTitles(appended)).toEqual(['A', 'C', 'B']);

    const undone = reorderToday(appended, b.id, oldIndex);
    expect(todayTitles(undone)).toEqual(['A', 'B', 'C']);
  });
});

describe('recurring-copy reverse-find removes the newest copy', () => {
  it('removes only the second copy when the same master was added twice', () => {
    let s = initialState(new Date('2026-07-10T09:00:00Z'));
    s = createTask(s, { title: 'Standup', isRecurring: true });
    const masterId = s.tasks[0].id;

    s = moveToToday(s, masterId); // copy #1
    s = moveToToday(s, masterId); // copy #2 (newest)

    const copies = s.tasks.filter((t) => t.column === 'today' && t.sourceTaskId === masterId);
    expect(copies).toHaveLength(2);
    const newest = copies[copies.length - 1];

    // The undo closure's reverse-find over all tasks.
    const found = [...s.tasks].reverse().find((t) => t.column === 'today' && t.sourceTaskId === masterId);
    expect(found!.id).toBe(newest.id);

    const undone = removeFromToday(s, found!.id);
    const remaining = undone.tasks.filter((t) => t.column === 'today' && t.sourceTaskId === masterId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(newest.id);
    // The recurring master itself is untouched.
    expect(undone.tasks.find((t) => t.id === masterId)!.column).toBe('master');
  });
});
