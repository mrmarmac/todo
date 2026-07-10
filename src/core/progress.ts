import type { AppState } from './types';

/**
 * Day-progress selector for the mobile shell's progress bar. "done" combines
 * tasks currently sitting in the Done column with ones already collapsed into
 * History under today's date, so the ratio survives a Clear (which only moves
 * Done → History) and resets to 0/0 on New Day (which advances currentDay).
 * "total" adds the still-open Today count.
 */
export function dayProgress(state: AppState): { done: number; total: number } {
  const doneNow = state.tasks.filter((t) => t.column === 'done').length;
  const cleared = state.history.filter(
    (h) => h.occurrenceType === 'task' && h.day === state.currentDay,
  ).length;
  const open = state.tasks.filter((t) => t.column === 'today').length;
  const done = doneNow + cleared;
  return { done, total: done + open };
}
