import { describe, it, expect } from 'vitest';
import { HISTORY_RETENTION_DAYS, pruneHistory, startNewDay } from '../state';
import type { AppState, HistoryEntry } from '../types';

function entry(day: string, title = day): HistoryEntry {
  return {
    id: `h-${title}`,
    occurrenceType: 'task',
    taskId: `t-${title}`,
    parentTaskId: null,
    title,
    completedAt: `${day}T12:00:00.000Z`,
    day,
  };
}

function stateWith(history: HistoryEntry[], currentDay = '2026-07-25'): AppState {
  return { tasks: [], history, currentDay };
}

describe('pruneHistory (D44)', () => {
  it('is a no-op on empty history', () => {
    const s = stateWith([]);
    expect(pruneHistory(s)).toBe(s);
  });

  it('returns the same object when nothing is old enough to drop', () => {
    const s = stateWith([entry('2026-07-25'), entry('2026-07-01')]);
    expect(pruneHistory(s)).toBe(s);
  });

  it('keeps an entry exactly on the retention boundary', () => {
    // 30 days before 2026-07-25 is 2026-06-25 — the cutoff is inclusive.
    const s = stateWith([entry('2026-07-25'), entry('2026-06-25')]);
    expect(pruneHistory(s).history.map((h) => h.day)).toEqual(['2026-07-25', '2026-06-25']);
  });

  it('drops the entry one day past the boundary', () => {
    const s = stateWith([entry('2026-07-25'), entry('2026-06-24')]);
    expect(pruneHistory(s).history.map((h) => h.day)).toEqual(['2026-07-25']);
  });

  it('keeps the retention window at the documented 30 days', () => {
    expect(HISTORY_RETENTION_DAYS).toBe(30);
  });

  it('preserves the order of surviving entries', () => {
    const s = stateWith([
      entry('2026-05-01'),
      entry('2026-07-01'),
      entry('2026-07-25'),
      entry('2026-07-10'),
    ]);
    expect(pruneHistory(s).history.map((h) => h.day)).toEqual([
      '2026-07-01',
      '2026-07-25',
      '2026-07-10',
    ]);
  });

  it('measures the window from the newest logged day, not the wall clock', () => {
    // History days come from the manual currentDay (D3), which can sit far
    // behind real time. Anchoring on `new Date()` would delete entries that
    // were logged moments ago; anchoring on the newest logged day keeps them.
    const s = stateWith([entry('2020-03-01'), entry('2020-03-15')], '2020-03-15');
    expect(pruneHistory(s).history).toHaveLength(2);
  });

  it('does not discard entries startNewDay just collapsed under a stale day', () => {
    // The user last pressed New Day in January but is completing tasks today.
    const state: AppState = {
      currentDay: '2026-01-01',
      history: [],
      tasks: [
        {
          id: 'a',
          title: 'Finished today',
          dueDate: null,
          column: 'done',
          isRecurring: false,
          isActive: false,
          sourceTaskId: null,
          subtasks: [],
        },
      ],
    };
    const next = startNewDay(state, new Date('2026-07-25T18:00:00Z'));
    expect(next.history.map((h) => h.title)).toEqual(['Finished today']);
  });
});

describe('startNewDay prunes History (D44)', () => {
  it('drops entries beyond the retention window on rollover', () => {
    const state = stateWith([entry('2026-01-01', 'ancient'), entry('2026-07-20', 'recent')]);
    const next = startNewDay(state, new Date('2026-07-25T09:00:00Z'));
    expect(next.history.map((h) => h.title)).toEqual(['recent']);
  });

  it('leaves a within-window History untouched', () => {
    const state = stateWith([entry('2026-07-20', 'recent'), entry('2026-07-24', 'newer')]);
    const next = startNewDay(state, new Date('2026-07-25T09:00:00Z'));
    expect(next.history.map((h) => h.title)).toEqual(['recent', 'newer']);
  });
});
