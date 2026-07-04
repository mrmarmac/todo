import type { AppState, HistoryEntry, Subtask, Task } from './types';
import { initialState } from './state';

export const STORAGE_KEY = 'todo-pwa/state/v1';

export function save(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** True when the value is a valid Subtask (required fields present and correctly typed). */
function isSubtask(value: unknown): value is Subtask {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.isCompleted === 'boolean' &&
    typeof v.isActive === 'boolean'
  );
}

/** True when the value is a valid Task (required fields present and correctly typed). */
function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    (typeof v.dueDate === 'string' || v.dueDate === null) &&
    (v.column === 'master' || v.column === 'today' || v.column === 'done') &&
    typeof v.isRecurring === 'boolean' &&
    typeof v.isActive === 'boolean' &&
    (typeof v.sourceTaskId === 'string' || v.sourceTaskId === null) &&
    Array.isArray(v.subtasks) &&
    v.subtasks.every(isSubtask)
  );
}

/** True when the value is a valid HistoryEntry (required fields present and correctly typed). */
function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    (v.occurrenceType === 'task' || v.occurrenceType === 'subtask') &&
    typeof v.taskId === 'string' &&
    (typeof v.parentTaskId === 'string' || v.parentTaskId === null) &&
    typeof v.title === 'string' &&
    typeof v.completedAt === 'string' &&
    typeof v.day === 'string'
  );
}

/** True when the parsed value is a valid AppState: every task, subtask, and history entry is deep-checked. */
export function isAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.tasks) &&
    v.tasks.every(isTask) &&
    Array.isArray(v.history) &&
    v.history.every(isHistoryEntry) &&
    typeof v.currentDay === 'string'
  );
}

/**
 * Return a copy of state with every isActive flag (tasks and subtasks) cleared
 * when the incoming data violates the single-active invariant: at most one
 * isActive across all tasks/subtasks combined; an active task must be in
 * 'today'; an active subtask's parent must be in 'today' and the subtask must
 * not be completed. Otherwise returns the state unchanged.
 */
export function sanitizeActiveFlags(state: AppState): AppState {
  let activeCount = 0;
  let violated = false;

  for (const task of state.tasks) {
    if (task.isActive) {
      activeCount++;
      if (task.column !== 'today') violated = true;
    }
    for (const subtask of task.subtasks) {
      if (subtask.isActive) {
        activeCount++;
        if (task.column !== 'today' || subtask.isCompleted) violated = true;
      }
    }
  }

  if (activeCount <= 1 && !violated) return state;

  return {
    ...state,
    tasks: state.tasks.map((task) => ({
      ...task,
      isActive: false,
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, isActive: false })),
    })),
  };
}

/**
 * Load app state from localStorage. Returns a fresh initial state when nothing
 * is stored, or when the stored data is missing/corrupt/wrong-shaped, so a bad
 * blob can never crash startup.
 */
export function load(now: Date = new Date()): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return initialState(now);
  try {
    const parsed = JSON.parse(raw);
    if (!isAppState(parsed)) return initialState(now);
    return sanitizeActiveFlags(parsed);
  } catch {
    return initialState(now);
  }
}
