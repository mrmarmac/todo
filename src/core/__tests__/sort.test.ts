import { describe, it, expect } from 'vitest';
import { sortMaster } from '../sort';
import type { Task } from '../types';

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

describe('sortMaster', () => {
  it('orders: dated non-recurring (earliest first), then undated, then recurring last', () => {
    const input = [
      task({ id: 'recurring', isRecurring: true, dueDate: '2026-01-01' }),
      task({ id: 'undated' }),
      task({ id: 'late', dueDate: '2026-12-01' }),
      task({ id: 'early', dueDate: '2026-02-01' }),
    ];
    const out = sortMaster(input).map((t) => t.id);
    expect(out).toEqual(['early', 'late', 'undated', 'recurring']);
  });

  it('keeps recurring last regardless of its due date', () => {
    const input = [
      task({ id: 'recurringEarly', isRecurring: true, dueDate: '2020-01-01' }),
      task({ id: 'datedNormal', dueDate: '2030-01-01' }),
    ];
    expect(sortMaster(input).map((t) => t.id)).toEqual(['datedNormal', 'recurringEarly']);
  });

  it('is stable within the undated group', () => {
    const input = [task({ id: 'x' }), task({ id: 'y' }), task({ id: 'z' })];
    expect(sortMaster(input).map((t) => t.id)).toEqual(['x', 'y', 'z']);
  });

  it('is stable within the recurring group', () => {
    const input = [
      task({ id: 'r1', isRecurring: true }),
      task({ id: 'r2', isRecurring: true }),
    ];
    expect(sortMaster(input).map((t) => t.id)).toEqual(['r1', 'r2']);
  });

  it('does not mutate the input array', () => {
    const input = [task({ id: 'b', dueDate: '2026-05-01' }), task({ id: 'a', dueDate: '2026-01-01' })];
    const before = input.map((t) => t.id);
    sortMaster(input);
    expect(input.map((t) => t.id)).toEqual(before);
  });
});
