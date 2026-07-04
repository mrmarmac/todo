import { describe, it, expect } from 'vitest';
import { startNewDay } from '../state';
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

describe('startNewDay (SPEC §6.7)', () => {
  const now = new Date('2026-07-04T09:00:00.000Z');

  it('collapses Done into History under the OLD currentDay (step 1)', () => {
    const s0 = stateWith([task({ id: 'd', title: 'Done', column: 'done' })]);
    const s = startNewDay(s0, now);
    expect(ids(s, 'done')).toEqual([]);
    const entry = s.history.find((h) => h.taskId === 'd');
    expect(entry).toMatchObject({
      occurrenceType: 'task',
      title: 'Done',
      day: '2026-07-03', // old day, not the new one
      completedAt: now.toISOString(),
    });
  });

  it('logs completed subtasks of a Done task under the old day (step 1)', () => {
    const s0 = stateWith([
      task({
        id: 'd',
        column: 'done',
        subtasks: [subtask({ id: 's1', title: 'Sub', isCompleted: true })],
      }),
    ]);
    const s = startNewDay(s0, now);
    const sub = s.history.find((h) => h.occurrenceType === 'subtask');
    expect(sub).toMatchObject({ taskId: 's1', parentTaskId: 'd', day: '2026-07-03' });
  });

  it('discards unfinished recurring day-copies, logging nothing (step 2)', () => {
    const s0 = stateWith([
      task({ id: 'm', column: 'master', isRecurring: true }),
      task({ id: 'copy', column: 'today', sourceTaskId: 'm' }),
    ]);
    const s = startNewDay(s0, now);
    expect(s.tasks.find((t) => t.id === 'copy')).toBeUndefined();
    expect(ids(s, 'master')).toEqual(['m']); // master untouched, no copy returned
    expect(s.history).toEqual([]); // nothing logged for the discarded copy
  });

  it('returns unfinished normal Today tasks to Master, logging nothing (step 3)', () => {
    const s0 = stateWith([task({ id: 't', column: 'today' })]);
    const s = startNewDay(s0, now);
    expect(ids(s, 'master')).toEqual(['t']);
    expect(ids(s, 'today')).toEqual([]);
    expect(s.history).toEqual([]);
  });

  it('resets completed subtasks on a returning parent to incomplete (step 3)', () => {
    const s0 = stateWith([
      task({
        id: 't',
        column: 'today',
        subtasks: [
          subtask({ id: 's1', isCompleted: true }),
          subtask({ id: 's2', isCompleted: false }),
        ],
      }),
    ]);
    const s = startNewDay(s0, now);
    const returned = s.tasks.find((t) => t.id === 't')!;
    expect(returned.column).toBe('master');
    expect(returned.subtasks.every((s) => !s.isCompleted)).toBe(true);
  });

  it('clears any active flag on task and subtask (step 4)', () => {
    const s0 = stateWith([
      task({ id: 't', column: 'today', isActive: true }),
      task({
        id: 'u',
        column: 'today',
        subtasks: [subtask({ id: 's1', isActive: true })],
      }),
    ]);
    const s = startNewDay(s0, now);
    expect(s.tasks.some((t) => t.isActive)).toBe(false);
    expect(s.tasks.flatMap((t) => t.subtasks).some((s) => s.isActive)).toBe(false);
  });

  it('advances currentDay to the date from now (step 5)', () => {
    const s = startNewDay(stateWith([]), now);
    expect(s.currentDay).toBe('2026-07-04');
  });

  it('handles an empty Today (only advances the day)', () => {
    const s0 = stateWith([task({ id: 'm', column: 'master' })]);
    const s = startNewDay(s0, now);
    expect(ids(s, 'master')).toEqual(['m']);
    expect(s.currentDay).toBe('2026-07-04');
    expect(s.history).toEqual([]);
  });

  it('a second immediate call changes nothing but currentDay', () => {
    const s0 = stateWith([
      task({ id: 'd', column: 'done' }),
      task({ id: 't', column: 'today' }),
      task({ id: 'copy', column: 'today', sourceTaskId: 'm' }),
      task({ id: 'm', column: 'master', isRecurring: true }),
    ]);
    const s1 = startNewDay(s0, now);
    const later = new Date('2026-07-05T09:00:00.000Z');
    const s2 = startNewDay(s1, later);
    expect({ ...s2, currentDay: s1.currentDay }).toEqual(s1);
    expect(s2.currentDay).toBe('2026-07-05');
  });

  it('does not mutate the input state', () => {
    const s0 = stateWith([
      task({ id: 'd', column: 'done' }),
      task({ id: 't', column: 'today', isActive: true }),
    ]);
    startNewDay(s0, now);
    expect(s0.tasks[0].column).toBe('done');
    expect(s0.tasks[1].isActive).toBe(true);
    expect(s0.currentDay).toBe('2026-07-03');
    expect(s0.history).toHaveLength(0);
  });
});
