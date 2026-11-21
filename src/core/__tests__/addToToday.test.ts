import { describe, it, expect } from 'vitest';
import { initialState, createTask, moveToToday, removeFromToday } from '../state';

/** Adding straight to Today (D63): a normal task created in Today, at the end of the order. */
describe('createTask into Today', () => {
  it('creates the task in Today, after the existing Today tasks', () => {
    let s = initialState(new Date('2026-11-21T09:00:00'));
    s = createTask(s, { title: 'First' });
    s = moveToToday(s, s.tasks[0].id);
    s = createTask(s, { title: 'Second', column: 'today', dueDate: '2026-11-22' });
    const today = s.tasks.filter((t) => t.column === 'today');
    expect(today.map((t) => t.title)).toEqual(['First', 'Second']);
    expect(today[1].dueDate).toBe('2026-11-22');
  });

  it('is never recurring (a repeating task needs a Master original)', () => {
    const s = createTask(initialState(), { title: 'X', column: 'today', isRecurring: true });
    expect(s.tasks[0].isRecurring).toBe(false);
  });

  it('defaults to Master, and removing it from Today sends it to Master', () => {
    let s = createTask(initialState(), { title: 'M' });
    expect(s.tasks[0].column).toBe('master');
    s = createTask(s, { title: 'T', column: 'today' });
    const t = s.tasks.find((x) => x.title === 'T')!;
    expect(removeFromToday(s, t.id).tasks.find((x) => x.id === t.id)!.column).toBe('master');
  });
});
