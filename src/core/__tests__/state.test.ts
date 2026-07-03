import { describe, it, expect } from 'vitest';
import { initialState, createTask, updateTask, deleteTask } from '../state';

describe('initialState', () => {
  it('starts empty with currentDay from the given date', () => {
    const s = initialState(new Date('2026-07-03T09:00:00Z'));
    expect(s.tasks).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.currentDay).toBe('2026-07-03');
  });
});

describe('createTask', () => {
  it('adds a task to master with sensible defaults', () => {
    const s = createTask(initialState(), { title: 'Buy milk' });
    expect(s.tasks).toHaveLength(1);
    const t = s.tasks[0];
    expect(t.title).toBe('Buy milk');
    expect(t.column).toBe('master');
    expect(t.dueDate).toBeNull();
    expect(t.isRecurring).toBe(false);
    expect(t.isActive).toBe(false);
    expect(t.sourceTaskId).toBeNull();
    expect(t.subtasks).toEqual([]);
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
  });

  it('honours optional dueDate and isRecurring', () => {
    const s = createTask(initialState(), {
      title: 'Water plants',
      dueDate: '2026-07-10',
      isRecurring: true,
    });
    expect(s.tasks[0].dueDate).toBe('2026-07-10');
    expect(s.tasks[0].isRecurring).toBe(true);
  });

  it('gives each task a distinct id', () => {
    let s = createTask(initialState(), { title: 'A' });
    s = createTask(s, { title: 'B' });
    expect(s.tasks[0].id).not.toBe(s.tasks[1].id);
  });

  it('trims the title', () => {
    const s = createTask(initialState(), { title: '  Tidy desk  ' });
    expect(s.tasks[0].title).toBe('Tidy desk');
  });

  it('rejects an empty or whitespace-only title', () => {
    expect(() => createTask(initialState(), { title: '' })).toThrow();
    expect(() => createTask(initialState(), { title: '   ' })).toThrow();
  });

  it('does not mutate the input state', () => {
    const s0 = initialState();
    createTask(s0, { title: 'A' });
    expect(s0.tasks).toHaveLength(0);
  });
});

describe('updateTask', () => {
  it('patches title, dueDate and isRecurring', () => {
    let s = createTask(initialState(), { title: 'Old' });
    const id = s.tasks[0].id;
    s = updateTask(s, id, { title: 'New', dueDate: '2026-08-01', isRecurring: true });
    expect(s.tasks[0].title).toBe('New');
    expect(s.tasks[0].dueDate).toBe('2026-08-01');
    expect(s.tasks[0].isRecurring).toBe(true);
  });

  it('trims an updated title and rejects a blank one', () => {
    let s = createTask(initialState(), { title: 'Old' });
    const id = s.tasks[0].id;
    s = updateTask(s, id, { title: '  Kept  ' });
    expect(s.tasks[0].title).toBe('Kept');
    expect(() => updateTask(s, id, { title: '   ' })).toThrow();
  });

  it('leaves other tasks untouched', () => {
    let s = createTask(initialState(), { title: 'A' });
    s = createTask(s, { title: 'B' });
    const idA = s.tasks[0].id;
    s = updateTask(s, idA, { title: 'A2' });
    expect(s.tasks[1].title).toBe('B');
  });
});

describe('deleteTask', () => {
  it('removes the task by id', () => {
    let s = createTask(initialState(), { title: 'A' });
    s = createTask(s, { title: 'B' });
    const idA = s.tasks[0].id;
    s = deleteTask(s, idA);
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0].title).toBe('B');
  });

  it('is a no-op for an unknown id', () => {
    const s = createTask(initialState(), { title: 'A' });
    expect(deleteTask(s, 'nope').tasks).toHaveLength(1);
  });
});
