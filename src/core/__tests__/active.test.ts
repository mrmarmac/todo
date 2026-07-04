import { describe, it, expect } from 'vitest';
import {
  setActive,
  setActiveSubtask,
  removeFromToday,
  completeTask,
  completeSubtask,
  deleteTask,
  deleteSubtask,
} from '../state';
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

function stateWith(tasks: Task[]): AppState {
  return { tasks, history: [], currentDay: '2026-07-03' };
}

const find = (s: AppState, id: string) => s.tasks.find((t) => t.id === id)!;
const findSub = (s: AppState, taskId: string, subId: string) =>
  find(s, taskId).subtasks.find((x) => x.id === subId)!;

/** Total count of active flags across tasks and subtasks (invariant: ≤ 1). */
const activeCount = (s: AppState) =>
  s.tasks.filter((t) => t.isActive).length +
  s.tasks.reduce((n, t) => n + t.subtasks.filter((x) => x.isActive).length, 0);

describe('setActive', () => {
  it('marks a Today task active', () => {
    const s = setActive(stateWith([task({ id: 'a', column: 'today' })]), 'a');
    expect(find(s, 'a').isActive).toBe(true);
  });

  it('is a no-op for a Master task (must sit in Today)', () => {
    const s0 = stateWith([task({ id: 'm', column: 'master' })]);
    expect(setActive(s0, 'm')).toEqual(s0);
  });

  it('is a no-op for a Done task', () => {
    const s0 = stateWith([task({ id: 'd', column: 'done' })]);
    expect(setActive(s0, 'd')).toEqual(s0);
  });

  it('is a no-op for an unknown id', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    expect(setActive(s0, 'nope')).toEqual(s0);
  });

  it('toggles off when the active task is set again', () => {
    let s = setActive(stateWith([task({ id: 'a', column: 'today' })]), 'a');
    s = setActive(s, 'a');
    expect(find(s, 'a').isActive).toBe(false);
    expect(activeCount(s)).toBe(0);
  });

  it('clears a previously active task (single-active invariant)', () => {
    let s = stateWith([
      task({ id: 'a', column: 'today' }),
      task({ id: 'b', column: 'today' }),
    ]);
    s = setActive(s, 'a');
    s = setActive(s, 'b');
    expect(find(s, 'a').isActive).toBe(false);
    expect(find(s, 'b').isActive).toBe(true);
    expect(activeCount(s)).toBe(1);
  });

  it('clears a previously active subtask (single-active across task/subtask)', () => {
    let s = stateWith([
      task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] }),
      task({ id: 'b', column: 'today' }),
    ]);
    s = setActiveSubtask(s, 'a', 's1');
    s = setActive(s, 'b');
    expect(findSub(s, 'a', 's1').isActive).toBe(false);
    expect(find(s, 'b').isActive).toBe(true);
    expect(activeCount(s)).toBe(1);
  });

  it('does not mutate the input state', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    setActive(s0, 'a');
    expect(s0.tasks[0].isActive).toBe(false);
  });
});

describe('setActiveSubtask', () => {
  it('marks a subtask active when its parent is in Today', () => {
    const s = setActiveSubtask(
      stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]),
      'a',
      's1',
    );
    expect(findSub(s, 'a', 's1').isActive).toBe(true);
  });

  it('is a no-op when the parent is not in Today', () => {
    const s0 = stateWith([task({ id: 'a', column: 'master', subtasks: [subtask({ id: 's1' })] })]);
    expect(setActiveSubtask(s0, 'a', 's1')).toEqual(s0);
  });

  it('is a no-op for an unknown subtask', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]);
    expect(setActiveSubtask(s0, 'a', 'nope')).toEqual(s0);
  });

  it('toggles off when the active subtask is set again', () => {
    let s = setActiveSubtask(
      stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]),
      'a',
      's1',
    );
    s = setActiveSubtask(s, 'a', 's1');
    expect(findSub(s, 'a', 's1').isActive).toBe(false);
    expect(activeCount(s)).toBe(0);
  });

  it('clears a previously active task', () => {
    let s = stateWith([
      task({ id: 'a', column: 'today' }),
      task({ id: 'b', column: 'today', subtasks: [subtask({ id: 's1' })] }),
    ]);
    s = setActive(s, 'a');
    s = setActiveSubtask(s, 'b', 's1');
    expect(find(s, 'a').isActive).toBe(false);
    expect(findSub(s, 'b', 's1').isActive).toBe(true);
    expect(activeCount(s)).toBe(1);
  });

  it('is a no-op on a completed subtask (D20: active ⇒ open item)', () => {
    const s0 = stateWith([
      task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1', isCompleted: true })] }),
    ]);
    expect(setActiveSubtask(s0, 'a', 's1')).toEqual(s0);
    expect(activeCount(setActiveSubtask(s0, 'a', 's1'))).toBe(0);
  });
});

describe('auto-clear active on other operations', () => {
  it('removeFromToday clears the active flag of a returning normal task', () => {
    let s = setActive(stateWith([task({ id: 'a', column: 'today' })]), 'a');
    s = removeFromToday(s, 'a');
    expect(find(s, 'a').column).toBe('master');
    expect(find(s, 'a').isActive).toBe(false);
    expect(activeCount(s)).toBe(0);
  });

  it('removeFromToday clears an active subtask of a returning normal task', () => {
    let s = setActiveSubtask(
      stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]),
      'a',
      's1',
    );
    s = removeFromToday(s, 'a');
    expect(find(s, 'a').column).toBe('master');
    expect(activeCount(s)).toBe(0);
  });

  it('completeTask leaves nothing active when the active task is completed', () => {
    let s = setActive(stateWith([task({ id: 'a', column: 'today' })]), 'a');
    s = completeTask(s, 'a');
    expect(activeCount(s)).toBe(0);
  });

  it('completeTask clears an active flag sitting on a completed subtask (D20)', () => {
    // A subtask carrying isActive alongside isCompleted is an off-path state;
    // completeTask must still scrub it so Done never carries an active subtask.
    const s0 = stateWith([
      task({
        id: 'a',
        column: 'today',
        subtasks: [subtask({ id: 's1', isCompleted: true, isActive: true })],
      }),
    ]);
    const s = completeTask(s0, 'a');
    expect(find(s, 'a').column).toBe('done');
    expect(findSub(s, 'a', 's1').isActive).toBe(false);
    expect(activeCount(s)).toBe(0);
  });

  it('completeSubtask leaves nothing active when the active subtask is ticked', () => {
    let s = setActiveSubtask(
      stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]),
      'a',
      's1',
    );
    s = completeSubtask(s, 'a', 's1');
    expect(activeCount(s)).toBe(0);
  });

  it('deleteTask of the active task leaves nothing active', () => {
    let s = setActive(stateWith([task({ id: 'a', column: 'today' })]), 'a');
    s = deleteTask(s, 'a');
    expect(activeCount(s)).toBe(0);
  });

  it('deleteSubtask of the active subtask leaves nothing active', () => {
    let s = setActiveSubtask(
      stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]),
      'a',
      's1',
    );
    s = deleteSubtask(s, 'a', 's1');
    expect(activeCount(s)).toBe(0);
  });
});
