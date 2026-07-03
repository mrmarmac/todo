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

/**
 * Add a master task to Today (SPEC §6.3).
 * - A normal task moves: its column becomes 'today' and it is appended at the
 *   bottom of the Today order (moved to the end of the array).
 * - A recurring task stays in Master; a fresh day-copy is appended to Today with
 *   a new id, deep-copied subtasks, isRecurring cleared, and sourceTaskId set to
 *   the master's id (D9).
 * No-op if the id is not a master task.
 */
export function moveToToday(state: AppState, id: string): AppState {
  const source = state.tasks.find((t) => t.id === id);
  if (!source || source.column !== 'master') return state;

  if (source.isRecurring) {
    const copy: Task = {
      ...source,
      id: newId(),
      column: 'today',
      isRecurring: false,
      isActive: false,
      sourceTaskId: source.id,
      subtasks: source.subtasks.map((s) => ({ ...s, id: newId(), isActive: false })),
    };
    return { ...state, tasks: [...state.tasks, copy] };
  }

  const others = state.tasks.filter((t) => t.id !== id);
  const moved: Task = { ...source, column: 'today' };
  return { ...state, tasks: [...others, moved] };
}

/**
 * Remove a Today task (D6). A normal task returns to Master; a recurring
 * day-copy (sourceTaskId set) is discarded. No-op if the id is not in Today.
 */
export function removeFromToday(state: AppState, id: string): AppState {
  const source = state.tasks.find((t) => t.id === id);
  if (!source || source.column !== 'today') return state;

  if (source.sourceTaskId !== null) {
    return { ...state, tasks: state.tasks.filter((t) => t.id !== id) };
  }
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, column: 'master' } : t)),
  };
}

/**
 * Reorder a task within the Today sequence to `targetIndex` (0-based, in the
 * Today ordering after removal). Master and Done tasks keep their positions.
 * No-op if the id is not in Today.
 */
export function reorderToday(state: AppState, id: string, targetIndex: number): AppState {
  const todayTasks = state.tasks.filter((t) => t.column === 'today');
  const from = todayTasks.findIndex((t) => t.id === id);
  if (from === -1) return state;

  const reordered = [...todayTasks];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(targetIndex, 0, moved);

  let i = 0;
  const tasks = state.tasks.map((t) => (t.column === 'today' ? reordered[i++] : t));
  return { ...state, tasks };
}
