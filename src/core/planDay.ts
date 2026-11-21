import type { AppState, Task } from './types';
import { moveToToday, startNewDay } from './state';
import { isScheduledOn } from './schedule';

/** Why a task is suggested for the new day (D61). */
export type SuggestionReason = 'carried' | 'overdue' | 'due' | 'scheduled';

export interface DaySuggestion {
  /** The task to move to Today: for a carried-over day-copy, its recurring master. */
  task: Task;
  reason: SuggestionReason;
}

/**
 * What the Plan my day screen offers for `day`, read from the board as it
 * stands before the new day starts (D61). In order, each task at most once:
 * 1. carried — unfinished Today work (a day-copy is offered as its master);
 * 2. overdue — non-recurring Master tasks due before `day`;
 * 3. due — non-recurring Master tasks due on `day`;
 * 4. scheduled — recurring masters whose schedule includes `day` (D60).
 * Suggestions only: nothing moves until the user starts the day with picks.
 */
export function daySuggestions(state: AppState, day: string): DaySuggestion[] {
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: DaySuggestion[] = [];
  const add = (task: Task | undefined, reason: SuggestionReason) => {
    if (!task || seen.has(task.id)) return;
    seen.add(task.id);
    out.push({ task, reason });
  };

  for (const t of state.tasks) {
    if (t.column === 'today') add(t.sourceTaskId ? byId.get(t.sourceTaskId) : t, 'carried');
  }
  const master = state.tasks.filter((t) => t.column === 'master');
  for (const t of master) {
    if (!t.isRecurring && t.dueDate !== null && t.dueDate < day) add(t, 'overdue');
  }
  for (const t of master) {
    if (!t.isRecurring && t.dueDate === day) add(t, 'due');
  }
  for (const t of master) {
    if (isScheduledOn(t, day)) add(t, 'scheduled');
  }
  return out;
}

/**
 * Start a new day (SPEC §6.7) and put the picked tasks into Today in the order
 * given. Picks are ids from {@link daySuggestions}; after the rollover every
 * one of them sits in Master, so each goes through the ordinary
 * {@link moveToToday} (a recurring master gets a fresh day-copy).
 */
export function startDayWith(state: AppState, now: Date, pickedIds: string[]): AppState {
  return pickedIds.reduce((s, id) => moveToToday(s, id), startNewDay(state, now));
}
