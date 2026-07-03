import type { AppState, Task } from './types';

/** Format a Date as an ISO calendar date (YYYY-MM-DD) in local time. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function newId(): string {
  return crypto.randomUUID();
}

export function initialState(now: Date = new Date()): AppState {
  return { tasks: [], history: [], currentDay: toISODate(now) };
}

export interface CreateTaskInput {
  title: string;
  dueDate?: string | null;
  isRecurring?: boolean;
}

export function createTask(state: AppState, input: CreateTaskInput): AppState {
  const title = input.title.trim();
  if (title === '') throw new Error('Task title is required');

  const task: Task = {
    id: newId(),
    title,
    dueDate: input.dueDate ?? null,
    column: 'master',
    isRecurring: input.isRecurring ?? false,
    isActive: false,
    sourceTaskId: null,
    subtasks: [],
  };
  return { ...state, tasks: [...state.tasks, task] };
}

export interface UpdateTaskPatch {
  title?: string;
  dueDate?: string | null;
  isRecurring?: boolean;
}

export function updateTask(state: AppState, id: string, patch: UpdateTaskPatch): AppState {
  const tasks = state.tasks.map((t) => {
    if (t.id !== id) return t;
    const next: Task = { ...t };
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (title === '') throw new Error('Task title is required');
      next.title = title;
    }
    if (patch.dueDate !== undefined) next.dueDate = patch.dueDate;
    if (patch.isRecurring !== undefined) next.isRecurring = patch.isRecurring;
    return next;
  });
  return { ...state, tasks };
}

export function deleteTask(state: AppState, id: string): AppState {
  return { ...state, tasks: state.tasks.filter((t) => t.id !== id) };
}
