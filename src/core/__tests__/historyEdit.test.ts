import { describe, it, expect } from 'vitest';
import {
  clearDone,
  deleteHistoryEntry,
  historyDeletionScope,
  updateHistoryEntry,
} from '../state';
import type { AppState, HistoryEntry } from '../types';

function taskEntry(id: string, title: string, day = '2026-07-25'): HistoryEntry {
  return {
    id,
    occurrenceType: 'task',
    taskId: `t-${id}`,
    parentTaskId: null,
    title,
    completedAt: `${day}T12:00:00.000Z`,
    day,
  };
}

function subtaskEntry(
  id: string,
  title: string,
  parentEntryId: string,
  day = '2026-07-25',
): HistoryEntry {
  return {
    id,
    occurrenceType: 'subtask',
    taskId: `s-${id}`,
    parentTaskId: `t-${parentEntryId}`,
    title,
    completedAt: `${day}T12:00:00.000Z`,
    day,
  };
}

function stateWith(history: HistoryEntry[], currentDay = '2026-07-25'): AppState {
  return { tasks: [], history, currentDay };
}

describe('updateHistoryEntry (D50)', () => {
  it('rewrites the title of the targeted entry only', () => {
    const s = stateWith([taskEntry('a', 'Wrong'), taskEntry('b', 'Untouched')]);
    const next = updateHistoryEntry(s, 'a', { title: 'Right' });
    expect(next.history.map((e) => e.title)).toEqual(['Right', 'Untouched']);
  });

  it('trims the new title', () => {
    const s = stateWith([taskEntry('a', 'Wrong')]);
    expect(updateHistoryEntry(s, 'a', { title: '  Right  ' }).history[0].title).toBe('Right');
  });

  it('throws on an empty or whitespace title (D11 title rule)', () => {
    const s = stateWith([taskEntry('a', 'Wrong')]);
    expect(() => updateHistoryEntry(s, 'a', { title: '' })).toThrow();
    expect(() => updateHistoryEntry(s, 'a', { title: '   ' })).toThrow();
  });

  it('leaves every other field of the entry alone', () => {
    const original = taskEntry('a', 'Wrong');
    const next = updateHistoryEntry(stateWith([original]), 'a', { title: 'Right' });
    expect(next.history[0]).toEqual({ ...original, title: 'Right' });
  });

  it('edits a subtask entry the same way', () => {
    const s = stateWith([taskEntry('a', 'Parent'), subtaskEntry('a1', 'Typo', 'a')]);
    const next = updateHistoryEntry(s, 'a1', { title: 'Fixed' });
    expect(next.history[1].title).toBe('Fixed');
    expect(next.history[1].occurrenceType).toBe('subtask');
  });

  it('is a no-op for an unknown id', () => {
    const s = stateWith([taskEntry('a', 'Wrong')]);
    expect(updateHistoryEntry(s, 'nope', { title: 'Right' }).history).toEqual(s.history);
  });

  it('does not touch tasks or currentDay', () => {
    const s = stateWith([taskEntry('a', 'Wrong')]);
    const next = updateHistoryEntry(s, 'a', { title: 'Right' });
    expect(next.tasks).toBe(s.tasks);
    expect(next.currentDay).toBe(s.currentDay);
  });
});

describe('historyDeletionScope (D50)', () => {
  it('is empty for an unknown id', () => {
    expect(historyDeletionScope(stateWith([taskEntry('a', 'A')]), 'nope')).toEqual([]);
  });

  it('is just the entry for a subtask entry', () => {
    const s = stateWith([taskEntry('a', 'A'), subtaskEntry('a1', 'A1', 'a')]);
    expect(historyDeletionScope(s, 'a1').map((e) => e.id)).toEqual(['a1']);
  });

  it('covers a task entry and its logged subtasks', () => {
    const s = stateWith([
      taskEntry('a', 'A'),
      subtaskEntry('a1', 'A1', 'a'),
      subtaskEntry('a2', 'A2', 'a'),
      taskEntry('b', 'B'),
      subtaskEntry('b1', 'B1', 'b'),
    ]);
    expect(historyDeletionScope(s, 'a').map((e) => e.id)).toEqual(['a', 'a1', 'a2']);
  });

  it('does not reach across days', () => {
    const s = stateWith([
      taskEntry('a', 'A', '2026-07-25'),
      // Same parent task id, logged on a different day — a separate occurrence.
      subtaskEntry('a1', 'A1', 'a', '2026-07-24'),
    ]);
    expect(historyDeletionScope(s, 'a').map((e) => e.id)).toEqual(['a']);
  });
});

describe('deleteHistoryEntry (D50)', () => {
  it('removes a subtask entry without touching its parent', () => {
    const s = stateWith([taskEntry('a', 'A'), subtaskEntry('a1', 'A1', 'a')]);
    expect(deleteHistoryEntry(s, 'a1').history.map((e) => e.id)).toEqual(['a']);
  });

  it('cascades from a task entry to its logged subtasks', () => {
    const s = stateWith([
      taskEntry('a', 'A'),
      subtaskEntry('a1', 'A1', 'a'),
      taskEntry('b', 'B'),
      subtaskEntry('b1', 'B1', 'b'),
    ]);
    expect(deleteHistoryEntry(s, 'a').history.map((e) => e.id)).toEqual(['b', 'b1']);
  });

  it('is a no-op for an unknown id', () => {
    const s = stateWith([taskEntry('a', 'A')]);
    expect(deleteHistoryEntry(s, 'nope')).toBe(s);
  });

  it('leaves tasks and currentDay alone', () => {
    const s = stateWith([taskEntry('a', 'A')]);
    const next = deleteHistoryEntry(s, 'a');
    expect(next.tasks).toBe(s.tasks);
    expect(next.currentDay).toBe(s.currentDay);
    expect(next.history).toEqual([]);
  });

  it('cascades over entries produced by clearDone', () => {
    // End-to-end against real ids rather than hand-built fixtures: the cascade
    // has to match how clearDone actually links subtask entries to parents.
    const base: AppState = {
      tasks: [
        {
          id: 'task-1',
          title: 'Ship it',
          dueDate: null,
          column: 'done',
          isRecurring: false,
          isActive: false,
          sourceTaskId: null,
          subtasks: [
            { id: 'sub-1', title: 'Write it', isCompleted: true, isActive: false },
            { id: 'sub-2', title: 'Test it', isCompleted: true, isActive: false },
          ],
        },
      ],
      history: [],
      currentDay: '2026-07-25',
    };
    const logged = clearDone(base, new Date('2026-07-25T18:00:00.000Z'));
    expect(logged.history).toHaveLength(3);

    const parentId = logged.history.find((e) => e.occurrenceType === 'task')!.id;
    expect(deleteHistoryEntry(logged, parentId).history).toEqual([]);
  });
});
