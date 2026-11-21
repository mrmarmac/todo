import { describe, it, expect } from 'vitest';
import { initialState, createTask, updateTask, moveToToday, completeTask } from '../state';
import { daySuggestions, startDayWith } from '../planDay';
import type { AppState } from '../types';

// The new day being planned: Monday 2026-11-23 (weekday 0).
const DAY = '2026-11-23';
const NOW = new Date('2026-11-23T08:00:00');

function idOf(s: AppState, title: string, column?: string): string {
  return s.tasks.find((t) => t.title === title && (!column || t.column === column))!.id;
}

/** Yesterday's board: some work left in Today, some done, a varied Master. */
function seed(): AppState {
  let s = initialState(new Date('2026-11-22T09:00:00'));
  s = createTask(s, { title: 'Carry me' });
  s = createTask(s, { title: 'Finished' });
  s = createTask(s, { title: 'Late', dueDate: '2026-11-20' });
  s = createTask(s, { title: 'Due now', dueDate: DAY });
  s = createTask(s, { title: 'Later', dueDate: '2026-12-01' });
  s = createTask(s, { title: 'Undated' });
  s = createTask(s, { title: 'Gym', isRecurring: true });
  s = createTask(s, { title: 'Sunday chore', isRecurring: true });
  s = createTask(s, { title: 'Standup', isRecurring: true });
  s = updateTask(s, idOf(s, 'Gym'), { repeatDays: [0, 2, 4] });
  s = updateTask(s, idOf(s, 'Sunday chore'), { repeatDays: [6] });
  s = updateTask(s, idOf(s, 'Standup'), { repeatDays: [0, 1, 2, 3, 4] });
  s = moveToToday(s, idOf(s, 'Carry me'));
  s = moveToToday(s, idOf(s, 'Finished'));
  s = completeTask(s, idOf(s, 'Finished'));
  s = moveToToday(s, idOf(s, 'Standup')); // an unfinished day-copy
  return s;
}

describe('daySuggestions', () => {
  it('suggests carried-over, overdue, due and scheduled work, in that order', () => {
    const s = seed();
    const got = daySuggestions(s, DAY).map((x) => [x.task.title, x.reason]);
    expect(got).toEqual([
      ['Carry me', 'carried'],
      ['Standup', 'carried'],
      ['Late', 'overdue'],
      ['Due now', 'due'],
      ['Gym', 'scheduled'],
    ]);
  });

  it('suggests a carried-over day-copy as its master, so picking it makes a fresh copy', () => {
    const s = seed();
    const standup = daySuggestions(s, DAY).find((x) => x.task.title === 'Standup')!;
    expect(standup.task.id).toBe(idOf(s, 'Standup', 'master'));
  });

  it('lists a task once even when it qualifies twice', () => {
    let s = seed();
    s = moveToToday(s, idOf(s, 'Late')); // now both carried and overdue
    const titles = daySuggestions(s, DAY).map((x) => x.task.title);
    expect(titles.filter((t) => t === 'Late')).toHaveLength(1);
    expect(daySuggestions(s, DAY).find((x) => x.task.title === 'Late')!.reason).toBe('carried');
  });

  it('suggests nothing on an empty board', () => {
    expect(daySuggestions(initialState(NOW), DAY)).toEqual([]);
  });
});

describe('startDayWith', () => {
  it('starts the new day, then puts the picked tasks into Today in pick order', () => {
    const s = seed();
    const picks = [idOf(s, 'Gym'), idOf(s, 'Carry me')];
    const next = startDayWith(s, NOW, picks);
    expect(next.currentDay).toBe(DAY);
    expect(next.tasks.filter((t) => t.column === 'today').map((t) => t.title)).toEqual([
      'Gym',
      'Carry me',
    ]);
    // Yesterday's Done went to History; the unpicked carry-over is back in Master.
    expect(next.history.map((h) => h.title)).toContain('Finished');
    expect(next.tasks.find((t) => t.title === 'Standup' && t.column === 'today')).toBeUndefined();
    expect(next.tasks.find((t) => t.title === 'Gym' && t.column === 'master')).toBeDefined();
  });

  it('with no picks is exactly a plain New Day', () => {
    const s = seed();
    const next = startDayWith(s, NOW, []);
    expect(next.tasks.filter((t) => t.column === 'today')).toEqual([]);
    expect(next.currentDay).toBe(DAY);
  });
});
