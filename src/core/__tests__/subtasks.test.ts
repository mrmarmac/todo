import { describe, it, expect } from 'vitest';
import {
  addSubtask,
  updateSubtask,
  deleteSubtask,
  completeSubtask,
  uncompleteSubtask,
  completeTask,
  moveToToday,
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

const subs = (s: AppState, taskId: string) =>
  s.tasks.find((t) => t.id === taskId)!.subtasks;

describe('addSubtask', () => {
  it('appends a subtask to a today task', () => {
    const s = addSubtask(stateWith([task({ id: 'a', column: 'today' })]), 'a', 'Warm up');
    expect(subs(s, 'a')).toHaveLength(1);
    expect(subs(s, 'a')[0]).toMatchObject({
      title: 'Warm up',
      isCompleted: false,
      isActive: false,
    });
    expect(subs(s, 'a')[0].id).toBeTruthy();
  });

  it('keeps creation order (D7)', () => {
    let s = addSubtask(stateWith([task({ id: 'a', column: 'today' })]), 'a', 'first');
    s = addSubtask(s, 'a', 'second');
    expect(subs(s, 'a').map((x) => x.title)).toEqual(['first', 'second']);
  });

  it('can be added to a master task', () => {
    const s = addSubtask(stateWith([task({ id: 'm' })]), 'm', 'sub');
    expect(subs(s, 'm')).toHaveLength(1);
  });

  it('trims and rejects an empty title', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    expect(() => addSubtask(s0, 'a', '   ')).toThrow();
  });

  it('is a no-op on a done task (invariant: done never holds an open subtask)', () => {
    const s0 = stateWith([task({ id: 'a', column: 'done' })]);
    expect(addSubtask(s0, 'a', 'sub')).toEqual(s0);
  });

  it('is a no-op for an unknown task', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    expect(addSubtask(s0, 'nope', 'sub')).toEqual(s0);
  });

  it('does not mutate the input state', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    addSubtask(s0, 'a', 'sub');
    expect(s0.tasks[0].subtasks).toHaveLength(0);
  });
});

describe('updateSubtask', () => {
  const base = () =>
    stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1', title: 'old' })] })]);

  it('changes the title', () => {
    const s = updateSubtask(base(), 'a', 's1', { title: 'new' });
    expect(subs(s, 'a')[0].title).toBe('new');
  });

  it('trims and rejects an empty title', () => {
    expect(() => updateSubtask(base(), 'a', 's1', { title: '  ' })).toThrow();
  });

  it('is a no-op for an unknown subtask', () => {
    const s0 = base();
    expect(updateSubtask(s0, 'a', 'nope', { title: 'x' })).toEqual(s0);
  });
});

describe('deleteSubtask', () => {
  it('removes the subtask', () => {
    const s0 = stateWith([
      task({
        id: 'a',
        column: 'today',
        subtasks: [subtask({ id: 's1' }), subtask({ id: 's2' })],
      }),
    ]);
    const s = deleteSubtask(s0, 'a', 's1');
    expect(subs(s, 'a').map((x) => x.id)).toEqual(['s2']);
  });

  it('is a no-op for an unknown subtask', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]);
    expect(deleteSubtask(s0, 'a', 'nope')).toEqual(s0);
  });
});

describe('completeSubtask (D5)', () => {
  it('marks the subtask complete', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]);
    const s = completeSubtask(s0, 'a', 's1');
    expect(subs(s, 'a')[0].isCompleted).toBe(true);
  });

  it('clears the subtask active flag on completion', () => {
    const s0 = stateWith([
      task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1', isActive: true })] }),
    ]);
    const s = completeSubtask(s0, 'a', 's1');
    expect(subs(s, 'a')[0].isActive).toBe(false);
  });

  it('is a no-op for an unknown subtask', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1' })] })]);
    expect(completeSubtask(s0, 'a', 'nope')).toEqual(s0);
  });

  it('is a no-op when the parent is a master task (D18: master is a template)', () => {
    const s0 = stateWith([
      task({ id: 'm', column: 'master', subtasks: [subtask({ id: 's1' })] }),
    ]);
    expect(completeSubtask(s0, 'm', 's1')).toEqual(s0);
  });

  it('is a no-op when the parent is a done task (D18)', () => {
    const s0 = stateWith([
      task({ id: 'a', column: 'done', subtasks: [subtask({ id: 's1' })] }),
    ]);
    expect(completeSubtask(s0, 'a', 's1')).toEqual(s0);
  });
});

describe('uncompleteSubtask (D5)', () => {
  it('un-ticks a completed subtask', () => {
    const s0 = stateWith([
      task({ id: 'a', column: 'today', subtasks: [subtask({ id: 's1', isCompleted: true })] }),
    ]);
    const s = uncompleteSubtask(s0, 'a', 's1');
    expect(subs(s, 'a')[0].isCompleted).toBe(false);
  });

  it('is a no-op when the parent is done (invariant preserved)', () => {
    const s0 = stateWith([
      task({ id: 'a', column: 'done', subtasks: [subtask({ id: 's1', isCompleted: true })] }),
    ]);
    expect(uncompleteSubtask(s0, 'a', 's1')).toEqual(s0);
  });

  it('is a no-op when the parent is a master task (D18: master is a template)', () => {
    const s0 = stateWith([
      task({ id: 'm', column: 'master', subtasks: [subtask({ id: 's1', isCompleted: true })] }),
    ]);
    expect(uncompleteSubtask(s0, 'm', 's1')).toEqual(s0);
  });
});

describe('parent completion gate (SPEC §6.4, D11) — real subtasks', () => {
  it('blocks completion while a subtask added via addSubtask is open', () => {
    let s = addSubtask(stateWith([task({ id: 'a', column: 'today' })]), 'a', 'sub');
    expect(() => completeTask(s, 'a')).toThrow();
  });

  it('allows completion once every subtask is ticked', () => {
    let s = addSubtask(stateWith([task({ id: 'a', column: 'today' })]), 'a', 'sub');
    const subId = subs(s, 'a')[0].id;
    s = completeSubtask(s, 'a', subId);
    s = completeTask(s, 'a');
    expect(s.tasks.find((t) => t.id === 'a')!.column).toBe('done');
  });
});

describe('day-copy subtask isolation (extends Slice 2)', () => {
  it('completing a subtask on the copy leaves the master subtask untouched', () => {
    const master = task({
      id: 'm',
      isRecurring: true,
      subtasks: [subtask({ id: 'ms1', title: 'warm up' })],
    });
    let s = moveToToday(stateWith([master]), 'm');
    const copy = s.tasks.find((t) => t.column === 'today')!;
    s = completeSubtask(s, copy.id, copy.subtasks[0].id);

    expect(subs(s, copy.id)[0].isCompleted).toBe(true);
    expect(subs(s, 'm')[0].isCompleted).toBe(false);
  });

  it('resets inherited subtask completion to open on the day-copy (D19)', () => {
    const master = task({
      id: 'm',
      isRecurring: true,
      subtasks: [
        subtask({ id: 'ms1', title: 'warm up', isCompleted: true }),
        subtask({ id: 'ms2', title: 'stretch', isCompleted: true }),
      ],
    });
    const s = moveToToday(stateWith([master]), 'm');
    const copy = s.tasks.find((t) => t.column === 'today')!;
    expect(copy.subtasks.every((x) => x.isCompleted === false)).toBe(true);
  });
});
