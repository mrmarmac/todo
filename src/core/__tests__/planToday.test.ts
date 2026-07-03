import { describe, it, expect } from 'vitest';
import { moveToToday, removeFromToday, reorderToday, deleteTask } from '../state';
import type { AppState, Task } from '../types';

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

const todayIds = (s: AppState) => s.tasks.filter((t) => t.column === 'today').map((t) => t.id);
const masterIds = (s: AppState) => s.tasks.filter((t) => t.column === 'master').map((t) => t.id);

describe('moveToToday — normal task', () => {
  it('moves the task out of master into today', () => {
    const s = moveToToday(stateWith([task({ id: 'a' })]), 'a');
    expect(masterIds(s)).toEqual([]);
    expect(todayIds(s)).toEqual(['a']);
    expect(s.tasks.find((t) => t.id === 'a')!.column).toBe('today');
  });

  it('appends at the bottom of the existing Today order', () => {
    const s0 = stateWith([
      task({ id: 'x', column: 'today' }),
      task({ id: 'y', column: 'today' }),
      task({ id: 'a' }),
    ]);
    expect(todayIds(moveToToday(s0, 'a'))).toEqual(['x', 'y', 'a']);
  });

  it('only acts on master tasks', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    expect(moveToToday(s0, 'a')).toEqual(s0);
  });

  it('does not mutate the input state', () => {
    const s0 = stateWith([task({ id: 'a' })]);
    moveToToday(s0, 'a');
    expect(s0.tasks[0].column).toBe('master');
  });
});

describe('moveToToday — recurring task creates a day-copy', () => {
  const master = task({ id: 'm', title: 'Stretch', isRecurring: true });

  it('leaves the recurring master untouched in master', () => {
    const s = moveToToday(stateWith([master]), 'm');
    const kept = s.tasks.find((t) => t.id === 'm')!;
    expect(kept.column).toBe('master');
    expect(kept.isRecurring).toBe(true);
    expect(kept.sourceTaskId).toBeNull();
  });

  it('creates a distinct day-copy in today with provenance', () => {
    const s = moveToToday(stateWith([master]), 'm');
    const copy = s.tasks.find((t) => t.column === 'today')!;
    expect(copy.id).not.toBe('m');
    expect(copy.title).toBe('Stretch');
    expect(copy.column).toBe('today');
    expect(copy.isRecurring).toBe(false); // D9
    expect(copy.sourceTaskId).toBe('m');
  });

  it('deep-copies subtasks so master and copy are independent', () => {
    const withSubs = task({
      id: 'm',
      isRecurring: true,
      subtasks: [{ id: 's1', title: 'Warm up', isCompleted: false, isActive: false }],
    });
    const s = moveToToday(stateWith([withSubs]), 'm');
    const copy = s.tasks.find((t) => t.column === 'today')!;
    expect(copy.subtasks).toHaveLength(1);
    expect(copy.subtasks[0].id).not.toBe('s1');
    expect(copy.subtasks[0].title).toBe('Warm up');
    expect(copy.subtasks).not.toBe(withSubs.subtasks);
    expect(copy.subtasks[0]).not.toBe(withSubs.subtasks[0]);
  });

  it('allows the same recurring master to be added twice (two copies)', () => {
    let s = moveToToday(stateWith([master]), 'm');
    s = moveToToday(s, 'm');
    expect(todayIds(s)).toHaveLength(2);
    expect(masterIds(s)).toEqual(['m']);
  });
});

describe('removeFromToday (D6)', () => {
  it('returns a normal task to master', () => {
    const s0 = stateWith([task({ id: 'a', column: 'today' })]);
    const s = removeFromToday(s0, 'a');
    expect(masterIds(s)).toEqual(['a']);
    expect(todayIds(s)).toEqual([]);
  });

  it('discards a recurring day-copy, leaving its master intact', () => {
    const s0 = stateWith([
      task({ id: 'm', isRecurring: true }),
      task({ id: 'c', column: 'today', sourceTaskId: 'm' }),
    ]);
    const s = removeFromToday(s0, 'c');
    expect(s.tasks.map((t) => t.id)).toEqual(['m']);
    expect(masterIds(s)).toEqual(['m']);
  });

  it('only acts on today tasks', () => {
    const s0 = stateWith([task({ id: 'a' })]);
    expect(removeFromToday(s0, 'a')).toEqual(s0);
  });
});

describe('reorderToday', () => {
  const base = () =>
    stateWith([
      task({ id: 'A', column: 'today' }),
      task({ id: 'M', column: 'master' }),
      task({ id: 'B', column: 'today' }),
      task({ id: 'C', column: 'today' }),
    ]);

  it('moves an item to the front', () => {
    expect(todayIds(reorderToday(base(), 'C', 0))).toEqual(['C', 'A', 'B']);
  });

  it('moves an item to the back', () => {
    expect(todayIds(reorderToday(base(), 'A', 2))).toEqual(['B', 'C', 'A']);
  });

  it('leaves master and done tasks untouched', () => {
    const s = reorderToday(base(), 'C', 0);
    expect(masterIds(s)).toEqual(['M']);
  });

  it('is a no-op for an id not in today', () => {
    const s0 = base();
    expect(reorderToday(s0, 'M', 0)).toEqual(s0);
  });
});

describe('deleteTask — recurring master rule (SPEC §6.2)', () => {
  it('deleting a recurring master leaves its day-copies intact', () => {
    const s0 = stateWith([
      task({ id: 'm', isRecurring: true }),
      task({ id: 'c', column: 'today', sourceTaskId: 'm' }),
    ]);
    const s = deleteTask(s0, 'm');
    expect(s.tasks.map((t) => t.id)).toEqual(['c']);
    expect(s.tasks[0].sourceTaskId).toBe('m'); // dangling ref is fine
  });
});
