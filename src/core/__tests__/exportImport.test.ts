import { describe, it, expect } from 'vitest';
import { exportState, importState, SCHEMA_VERSION } from '../exportImport';
import type { AppState } from '../types';

const sample: AppState = {
  currentDay: '2026-07-04',
  history: [
    {
      id: 'h1',
      occurrenceType: 'task',
      taskId: 'd1',
      parentTaskId: null,
      title: 'Done thing',
      completedAt: '2026-07-03T10:00:00.000Z',
      day: '2026-07-03',
    },
  ],
  tasks: [
    {
      id: 't1',
      title: 'A task',
      dueDate: '2026-07-10',
      column: 'today',
      isRecurring: false,
      isActive: true,
      sourceTaskId: null,
      subtasks: [{ id: 's1', title: 'A sub', isCompleted: false, isActive: false }],
    },
  ],
};

describe('exportState', () => {
  it('produces JSON carrying the full state and a schemaVersion', () => {
    const parsed = JSON.parse(exportState(sample));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.state).toEqual(sample);
  });
});

describe('importState', () => {
  it('restores the AppState from an export envelope', () => {
    const restored = importState(exportState(sample));
    expect(restored).toEqual(sample);
  });

  it('round-trips: importState(exportState(s)) deep-equals s', () => {
    expect(importState(exportState(sample))).toEqual(sample);
    const empty: AppState = { tasks: [], history: [], currentDay: '2026-07-04' };
    expect(importState(exportState(empty))).toEqual(empty);
  });

  it('throws a clear error on non-JSON input (no crash)', () => {
    expect(() => importState('not json {')).toThrow(/valid JSON|import/i);
  });

  it('throws a clear error when the envelope lacks a valid state', () => {
    expect(() => importState(JSON.stringify({ schemaVersion: 1 }))).toThrow(/state|import/i);
    expect(() => importState(JSON.stringify({ schemaVersion: 1, state: 42 }))).toThrow(
      /state|import/i,
    );
    expect(() =>
      importState(JSON.stringify({ schemaVersion: 1, state: { tasks: 'x' } })),
    ).toThrow(/state|import/i);
  });

  it('throws a clear error on a JSON value that is not an export envelope', () => {
    expect(() => importState(JSON.stringify([1, 2, 3]))).toThrow(/import/i);
    expect(() => importState('null')).toThrow(/import/i);
  });
});
