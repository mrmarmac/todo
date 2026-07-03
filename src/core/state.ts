import type { AppState, HistoryEntry, Subtask, Task } from './types';

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
  // A returning task cannot stay active (active ⇒ Today): clear its flags.
  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            column: 'master',
            isActive: false,
            subtasks: t.subtasks.map((s) => ({ ...s, isActive: false })),
          }
        : t,
    ),
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

/**
 * Complete a Today task (SPEC §6.5): move it to Done and clear its active flag.
 * Rejected while any subtask is still open — a parent cannot complete with an
 * open subtask. No-op if the id is not a Today task.
 */
export function completeTask(state: AppState, id: string): AppState {
  const source = state.tasks.find((t) => t.id === id);
  if (!source || source.column !== 'today') return state;

  if (source.subtasks.some((s) => !s.isCompleted)) {
    throw new Error('Cannot complete a task with open subtasks');
  }

  return {
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === id ? { ...t, column: 'done', isActive: false } : t,
    ),
  };
}

/**
 * Undo a completion (D5): return a Done task to the end of the Today order.
 * No-op if the id is not a Done task.
 */
export function uncompleteTask(state: AppState, id: string): AppState {
  const source = state.tasks.find((t) => t.id === id);
  if (!source || source.column !== 'done') return state;

  const others = state.tasks.filter((t) => t.id !== id);
  const moved: Task = { ...source, column: 'today' };
  return { ...state, tasks: [...others, moved] };
}

/** Replace the subtasks of one task, leaving every other task untouched. */
function mapSubtasks(
  state: AppState,
  taskId: string,
  fn: (subtasks: Subtask[]) => Subtask[],
): AppState {
  const tasks = state.tasks.map((t) =>
    t.id === taskId ? { ...t, subtasks: fn(t.subtasks) } : t,
  );
  return { ...state, tasks };
}

/**
 * Add a subtask (SPEC §6.4) to any non-Done task, appended in creation order
 * (D7). Rejects an empty/whitespace title. No-op on a Done task — a done task
 * must never hold an open subtask — or an unknown id.
 */
export function addSubtask(state: AppState, taskId: string, title: string): AppState {
  const parent = state.tasks.find((t) => t.id === taskId);
  if (!parent || parent.column === 'done') return state;

  const trimmed = title.trim();
  if (trimmed === '') throw new Error('Subtask title is required');

  const subtask: Subtask = { id: newId(), title: trimmed, isCompleted: false, isActive: false };
  return mapSubtasks(state, taskId, (subs) => [...subs, subtask]);
}

/** Edit a subtask's title. Rejects empty; no-op for an unknown subtask. */
export function updateSubtask(
  state: AppState,
  taskId: string,
  subtaskId: string,
  patch: { title?: string },
): AppState {
  return mapSubtasks(state, taskId, (subs) =>
    subs.map((s) => {
      if (s.id !== subtaskId) return s;
      const next: Subtask = { ...s };
      if (patch.title !== undefined) {
        const title = patch.title.trim();
        if (title === '') throw new Error('Subtask title is required');
        next.title = title;
      }
      return next;
    }),
  );
}

/** Delete a subtask; no-op for an unknown subtask. */
export function deleteSubtask(state: AppState, taskId: string, subtaskId: string): AppState {
  return mapSubtasks(state, taskId, (subs) => subs.filter((s) => s.id !== subtaskId));
}

/**
 * Tick a subtask complete (SPEC §6.4), clearing its active flag. No-op for an
 * unknown subtask.
 */
export function completeSubtask(state: AppState, taskId: string, subtaskId: string): AppState {
  return mapSubtasks(state, taskId, (subs) =>
    subs.map((s) => (s.id === subtaskId ? { ...s, isCompleted: true, isActive: false } : s)),
  );
}

/**
 * Un-tick a completed subtask (D5), allowed until its parent is cleared to
 * History. No-op when the parent is in Done — a done task must never hold an
 * open subtask; undo the parent completion first.
 */
export function uncompleteSubtask(state: AppState, taskId: string, subtaskId: string): AppState {
  const parent = state.tasks.find((t) => t.id === taskId);
  if (!parent || parent.column === 'done') return state;

  return mapSubtasks(state, taskId, (subs) =>
    subs.map((s) => (s.id === subtaskId ? { ...s, isCompleted: false } : s)),
  );
}

/**
 * Collapse Done into History (SPEC §6.6). Each Done task produces one `task`
 * History entry plus one `subtask` entry per completed subtask (carrying its
 * parentTaskId), all stamped with the current day and `now`. Cleared tasks are
 * removed from `tasks`; Today and Master are untouched. No-op when Done is empty
 * and repeatable any number of times.
 */
export function clearDone(state: AppState, now: Date): AppState {
  const doneTasks = state.tasks.filter((t) => t.column === 'done');
  if (doneTasks.length === 0) return state;

  const completedAt = now.toISOString();
  const day = state.currentDay;
  const entries: HistoryEntry[] = [];

  for (const t of doneTasks) {
    entries.push({
      id: newId(),
      occurrenceType: 'task',
      taskId: t.id,
      parentTaskId: null,
      title: t.title,
      completedAt,
      day,
    });
    for (const s of t.subtasks) {
      if (!s.isCompleted) continue;
      entries.push({
        id: newId(),
        occurrenceType: 'subtask',
        taskId: s.id,
        parentTaskId: t.id,
        title: s.title,
        completedAt,
        day,
      });
    }
  }

  return {
    ...state,
    tasks: state.tasks.filter((t) => t.column !== 'done'),
    history: [...state.history, ...entries],
  };
}

/** Clear every active flag across all tasks and their subtasks (invariant helper). */
function clearAllActiveFlags(tasks: Task[]): Task[] {
  return tasks.map((t) => ({
    ...t,
    isActive: false,
    subtasks: t.subtasks.map((s) => ({ ...s, isActive: false })),
  }));
}

/**
 * Set a Today task as the single active item (SPEC §6.8). Clears any previously
 * active task or subtask first. Clicking the already-active task toggles it off.
 * No-op unless the task exists and is in Today.
 */
export function setActive(state: AppState, taskId: string): AppState {
  const target = state.tasks.find((t) => t.id === taskId);
  if (!target || target.column !== 'today') return state;

  const cleared = clearAllActiveFlags(state.tasks);
  if (target.isActive) return { ...state, tasks: cleared }; // toggle off

  return {
    ...state,
    tasks: cleared.map((t) => (t.id === taskId ? { ...t, isActive: true } : t)),
  };
}

/**
 * Set a subtask as the single active item (SPEC §6.8). The parent must be in
 * Today. Clears any previously active task or subtask first; clicking the
 * already-active subtask toggles it off. No-op for an unknown subtask.
 */
export function setActiveSubtask(state: AppState, taskId: string, subtaskId: string): AppState {
  const parent = state.tasks.find((t) => t.id === taskId);
  if (!parent || parent.column !== 'today') return state;
  const target = parent.subtasks.find((s) => s.id === subtaskId);
  if (!target) return state;

  const cleared = clearAllActiveFlags(state.tasks);
  if (target.isActive) return { ...state, tasks: cleared }; // toggle off

  return {
    ...state,
    tasks: cleared.map((t) =>
      t.id === taskId
        ? {
            ...t,
            subtasks: t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, isActive: true } : s,
            ),
          }
        : t,
    ),
  };
}

/** Un-set any active item (SPEC §6.8). */
export function clearActive(state: AppState): AppState {
  return { ...state, tasks: clearAllActiveFlags(state.tasks) };
}
