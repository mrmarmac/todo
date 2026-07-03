import type { Task } from './types';

/**
 * Sort master-column tasks (SPEC §7):
 *   1. Non-recurring with a due date, earliest first.
 *   2. Non-recurring with no due date.
 *   3. Recurring, always last regardless of due date.
 * Stable within each group. Returns a new array; input is not mutated.
 */
export function sortMaster(tasks: Task[]): Task[] {
  const rank = (t: Task): number => {
    if (t.isRecurring) return 2;
    if (t.dueDate) return 0;
    return 1;
  };

  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const ra = rank(a.task);
      const rb = rank(b.task);
      if (ra !== rb) return ra - rb;
      // Within the dated group, earliest due date first.
      if (ra === 0 && a.task.dueDate !== b.task.dueDate) {
        return a.task.dueDate! < b.task.dueDate! ? -1 : 1;
      }
      // Otherwise keep original order (stable).
      return a.index - b.index;
    })
    .map((entry) => entry.task);
}
