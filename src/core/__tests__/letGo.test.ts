import { describe, it, expect } from 'vitest';
import { initialState, createTask, moveToToday, startNewDay, removeFromToday } from '../state';
import { startDayWith } from '../planDay';
import { isAppState } from '../storage';
import type { AppState } from '../types';

/**
 * Stuck tasks (D65): each New Day that finds a task unfinished in Today adds
 * one to its carry-over count; Plan my day can let it go.
 */
const day = (d: number) => new Date(`2026-11-${String(d).padStart(2, '0')}T08:00:00`);
const byTitle = (s: AppState, title: string) => s.tasks.find((t) => t.title === title)!;

function seed(): AppState {
  let s = initialState(day(20));
  s = createTask(s, { title: 'Stuck' });
  s = createTask(s, { title: 'Idle' });
  return moveToToday(s, byTitle(s, 'Stuck').id);
}

describe('carriedDays', () => {
  it('counts each New Day that found the task unfinished in Today', () => {
    let s = startNewDay(seed(), day(21));
    expect(byTitle(s, 'Stuck').carriedDays).toBe(1);
    s = startNewDay(moveToToday(s, byTitle(s, 'Stuck').id), day(22));
    expect(byTitle(s, 'Stuck').carriedDays).toBe(2);
  });

  it('keeps the count while the task sits in Master, and never counts Master tasks', () => {
    let s = startNewDay(seed(), day(21));
    s = startNewDay(s, day(22)); // left in Master all day
    expect(byTitle(s, 'Stuck').carriedDays).toBe(1);
    expect(byTitle(s, 'Idle').carriedDays).toBeUndefined();
  });

  it('is not touched by manually removing a task from Today', () => {
    const s = removeFromToday(seed(), byTitle(seed(), 'Stuck').id);
    expect(byTitle(s, 'Stuck').carriedDays).toBeUndefined();
  });

  it('is validated when loading saved data', () => {
    const s = startNewDay(seed(), day(21));
    expect(isAppState(s)).toBe(true);
    const bad = { ...s, tasks: [{ ...s.tasks[0], carriedDays: -1 }] };
    expect(isAppState(bad)).toBe(false);
  });
});

describe('startDayWith letting go', () => {
  it('deletes the let-go tasks and keeps the picks', () => {
    let s = seed();
    s = createTask(s, { title: 'Also carried' });
    s = moveToToday(s, byTitle(s, 'Also carried').id);
    const next = startDayWith(s, day(21), [byTitle(s, 'Also carried').id], [byTitle(s, 'Stuck').id]);
    expect(next.tasks.map((t) => t.title).sort()).toEqual(['Also carried', 'Idle']);
    expect(byTitle(next, 'Also carried').column).toBe('today');
  });
});
