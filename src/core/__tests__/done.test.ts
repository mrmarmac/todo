import { describe, it, expect } from 'vitest';
import { completeTask, uncompleteTask, clearDone } from '../state';
import type { AppState, Task, Subtask } from '../types';

function subtask(partial: Partial<Subtask> & { id: string }): Subtask {
  return { title: partial.id, isCompleted: false, isActive: false, ...partial };
}

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    title: partial.id,
    dueDate: null,
    column: 'master',
    isRecurring: false,
    isActive: false,
    sourceTaskId: null,
    subtasks: [],
    ...partial,
  };
}

function stateWith(tasks: Task[], history: AppState['history'] = []): AppState {
  return { tasks, history, currentDay: '2026-07-03' };
}

const ids = (s: AppState, col: Task['column']) =>
  s.tasks.filter((t) => t.column === col).map((t) => t.id);

describe('completeTask', () => {
  it('moves a today task to done', () => {
    const s = completeTask(stateWith([task({ id: 'a', column: 'today' })]), 'a');
    expect(ids(s, 'today')).toEqual([]);
    expect(ids(s, 'done')).toEqual(['a']);
  });

  it('clears isActive on the completed task', () => {
    const s = completeTask(stateWith([task({ id: 'a', column: 'today', isActive: true })]), 'a');
    expect(s.tasks.find((t) => t.id === 'a')!.isActive).toBe(false);
  });

  it('only acts on today tasks (no-op from master)', () => {
    const s0 = stateWith([task({ id: 'a', column: 'master' })]);
    expect(completeTask(s0, 'a')).toEqual(s0);
  });

  it('is allowed when all subtasks are complete', () => {
    const s0 = stateWith([
      task({
        id: 'a',
        column: 'today',
        subtasks: [subtask({ id: 's1', isCompleted: true })],
      }),
    ]);
    expect(ids(completeTask(s0, 'a'), 'done')).toEqual(['a']);
  });

  it('is blocked (throws) while any subtask is open', () => {
    const s0 = stateWith([
      task({
        id: 'a',
        column: 'today',
        subtasks: [
          subtask({ id: 's1', isCompleted: true }),
          subtask({ id: 's2', isCompleted: false }),
        ],
      }),
    ]);
    expect(() => completeTask(s0, 'a')).toThrow();
  });

  it('does not mutate the input state', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    completeTask(s0, 'a');
    expect(s0.tasks[0].column).toBe('today');
  });
});

describe('uncompleteTask (D5)', () => {
  it('returns a done task to the end of Today order', () => {
    const s0 = stateWith([
      task({ id: 'x', column: 'today' }),
      task({ id: 'a', column: 'done' }),
      task({ id: 'y', column: 'today' }),
    ]);
    const s = uncompleteTask(s0, 'a');
    expect(ids(s, 'today')).toEqual(['x', 'y', 'a']);
    expect(ids(s, 'done')).toEqual([]);
  });

  it('only acts on done tasks', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    expect(uncompleteTask(s0, 'a')).toEqual(s0);
  });
});

describe('clearDone (SPEC §6.6)', () => {
  const now = new Date('2026-07-03T14:30:00.000Z');

  it('logs one task entry per done task and removes them from tasks', () => {
    const s0 = stateWith([
      task({ id: 'm', column: 'master' }),
      task({ id: 't', column: 'today' }),
      task({ id: 'd1', title: 'Done one', column: 'done' }),
      task({ id: 'd2', title: 'Done two', column: 'done' }),
    ]);
    const s = clearDone(s0, now);
    expect(ids(s, 'done')).toEqual([]);
    const taskEntries = s.history.filter((h) => h.occurrenceType === 'task');
    expect(taskEntries.map((h) => h.taskId)).toEqual(['d1', 'd2']);
    expect(taskEntries[0]).toMatchObject({
      occurrenceType: 'task',
      taskId: 'd1',
      title: 'Done one',
      parentTaskId: null,
      day: '2026-07-03',
      completedAt: now.toISOString(),
    });
  });

  it('logs one subtask entry per completed subtask, with parentTaskId', () => {
    const s0 = stateWith([
      task({
        id: 'd',
        column: 'done',
        subtasks: [
          subtask({ id: 's1', title: 'Sub one', isCompleted: true }),
          subtask({ id: 's2', title: 'Sub two', isCompleted: true }),
        ],
      }),
    ]);
    const s = clearDone(s0, now);
    const subEntries = s.history.filter((h) => h.occurrenceType === 'subtask');
    expect(subEntries).toHaveLength(2);
    expect(subEntries[0]).toMatchObject({
      occurrenceType: 'subtask',
      taskId: 's1',
      parentTaskId: 'd',
      title: 'Sub one',
      day: '2026-07-03',
      completedAt: now.toISOString(),
    });
  });

  it('leaves Today and Master untouched', () => {
    const s0 = stateWith([
      task({ id: 'm', column: 'master' }),
      task({ id: 't', column: 'today' }),
      task({ id: 'd', column: 'done' }),
    ]);
    const s = clearDone(s0, now);
    expect(ids(s, 'master')).toEqual(['m']);
    expect(ids(s, 'today')).toEqual(['t']);
  });

  it('appends chronologically after existing history', () => {
    const existing = {
      id: 'h0',
      occurrenceType: 'task' as const,
      taskId: 'old',
      parentTaskId: null,
      title: 'Old',
      completedAt: '2026-07-02T10:00:00.000Z',
      day: '2026-07-02',
    };
    const s0 = stateWith([task({ id: 'd', column: 'done' })], [existing]);
    const s = clearDone(s0, now);
    expect(s.history[0]).toEqual(existing);
    expect(s.history).toHaveLength(2);
  });

  it('is a no-op when Done is empty', () => {
    const s0 = stateWith([task({ id: 't', column: 'today' })]);
    expect(clearDone(s0, now)).toEqual(s0);
  });

  it('is repeatable (second call with empty Done changes nothing)', () => {
    const s0 = stateWith([task({ id: 'd', column: 'done' })]);
    const s1 = clearDone(s0, now);
    expect(clearDone(s1, now)).toEqual(s1);
  });

  it('does not mutate the input state', () => {
    const s0 = stateWith([task({ id: 'd', column: 'done' })]);
    clearDone(s0, now);
    expect(s0.tasks).toHaveLength(1);
    expect(s0.history).toHaveLength(0);
  });
});
