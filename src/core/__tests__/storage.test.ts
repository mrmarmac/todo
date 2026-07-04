import { describe, it, expect, beforeEach, vi } from 'vitest';
import { save, load, STORAGE_KEY, isAppState, sanitizeActiveFlags } from '../storage';
import { initialState, createTask } from '../state';
import type { AppState, Task, HistoryEntry } from '../types';

function validTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'A task',
    dueDate: null,
    column: 'master',
    isRecurring: false,
    isActive: false,
    sourceTaskId: null,
    subtasks: [],
    ...overrides,
  };
}

function validHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'h1',
    occurrenceType: 'task',
    taskId: 't1',
    parentTaskId: null,
    title: 'Done thing',
    completedAt: '2026-07-03T10:00:00.000Z',
    day: '2026-07-03',
    ...overrides,
  };
}

// Minimal in-memory localStorage for the node test environment.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

describe('save / load', () => {
  it('round-trips app state', () => {
    const s = createTask(initialState(new Date('2026-07-03T00:00:00Z')), { title: 'Persist me' });
    save(s);
    expect(load()).toEqual(s);
  });

  it('returns a fresh initial state when nothing is stored', () => {
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.currentDay).toBe('2026-07-03');
  });

  it('returns a fresh initial state when stored data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
    expect(s.currentDay).toBe('2026-07-03');
  });

  it('returns a fresh initial state when stored JSON is the wrong shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
  });

  it('returns a fresh initial state when a task element is null', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks: [null], history: [], currentDay: '2026-07-03' }),
    );
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
  });

  it('returns a fresh initial state when a task is missing its subtasks array', () => {
    const badTask = validTask();
    delete (badTask as Partial<Task>).subtasks;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks: [badTask], history: [], currentDay: '2026-07-03' }),
    );
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
  });

  it('returns a fresh initial state when a history entry is malformed', () => {
    const badEntry = { ...validHistoryEntry(), occurrenceType: 'nope' };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks: [], history: [badEntry], currentDay: '2026-07-03' }),
    );
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.history).toEqual([]);
  });

  it('sanitises active flags on load when two tasks are active', () => {
    const state: AppState = {
      tasks: [
        validTask({ id: 't1', column: 'today', isActive: true }),
        validTask({ id: 't2', column: 'today', isActive: true }),
      ],
      history: [],
      currentDay: '2026-07-03',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks.every((t) => !t.isActive)).toBe(true);
  });
});

describe('isAppState', () => {
  it('accepts a fully valid state', () => {
    const state: AppState = {
      tasks: [validTask({ subtasks: [{ id: 's1', title: 'sub', isCompleted: false, isActive: false }] })],
      history: [validHistoryEntry()],
      currentDay: '2026-07-03',
    };
    expect(isAppState(state)).toBe(true);
  });

  it('rejects tasks that are null elements', () => {
    expect(isAppState({ tasks: [null], history: [], currentDay: '2026-07-03' })).toBe(false);
  });

  it('rejects a task missing subtasks', () => {
    const badTask = validTask();
    delete (badTask as Partial<Task>).subtasks;
    expect(isAppState({ tasks: [badTask], history: [], currentDay: '2026-07-03' })).toBe(false);
  });

  it('rejects a task with wrong-typed column', () => {
    const badTask = { ...validTask(), column: 'nope' };
    expect(isAppState({ tasks: [badTask], history: [], currentDay: '2026-07-03' })).toBe(false);
  });

  it('rejects a subtask missing isCompleted', () => {
    const badTask = validTask({ subtasks: [{ id: 's1', title: 'sub', isActive: false } as never] });
    expect(isAppState({ tasks: [badTask], history: [], currentDay: '2026-07-03' })).toBe(false);
  });

  it('rejects a malformed history entry', () => {
    const badEntry = { ...validHistoryEntry(), occurrenceType: 'nope' };
    expect(isAppState({ tasks: [], history: [badEntry], currentDay: '2026-07-03' })).toBe(false);
  });

  it('accepts extra unknown properties on task/subtask/history objects', () => {
    const task = { ...validTask(), extra: 'ignored' };
    const entry = { ...validHistoryEntry(), extra: 'ignored' };
    expect(isAppState({ tasks: [task], history: [entry], currentDay: '2026-07-03' })).toBe(true);
  });
});

describe('sanitizeActiveFlags', () => {
  it('leaves a valid state unchanged', () => {
    const state: AppState = {
      tasks: [validTask({ column: 'today', isActive: true })],
      history: [],
      currentDay: '2026-07-03',
    };
    expect(sanitizeActiveFlags(state)).toEqual(state);
  });

  it('clears all active flags when two tasks are active', () => {
    const state: AppState = {
      tasks: [
        validTask({ id: 't1', column: 'today', isActive: true }),
        validTask({ id: 't2', column: 'today', isActive: true }),
      ],
      history: [],
      currentDay: '2026-07-03',
    };
    const result = sanitizeActiveFlags(state);
    expect(result.tasks.every((t) => !t.isActive)).toBe(true);
  });

  it('clears an active task that is not in today', () => {
    const state: AppState = {
      tasks: [validTask({ column: 'master', isActive: true })],
      history: [],
      currentDay: '2026-07-03',
    };
    const result = sanitizeActiveFlags(state);
    expect(result.tasks[0].isActive).toBe(false);
  });

  it('clears an active subtask whose parent is not in today', () => {
    const state: AppState = {
      tasks: [
        validTask({
          column: 'master',
          subtasks: [{ id: 's1', title: 'sub', isCompleted: false, isActive: true }],
        }),
      ],
      history: [],
      currentDay: '2026-07-03',
    };
    const result = sanitizeActiveFlags(state);
    expect(result.tasks[0].subtasks[0].isActive).toBe(false);
  });

  it('clears an active subtask that is completed', () => {
    const state: AppState = {
      tasks: [
        validTask({
          column: 'today',
          subtasks: [{ id: 's1', title: 'sub', isCompleted: true, isActive: true }],
        }),
      ],
      history: [],
      currentDay: '2026-07-03',
    };
    const result = sanitizeActiveFlags(state);
    expect(result.tasks[0].subtasks[0].isActive).toBe(false);
  });
});
