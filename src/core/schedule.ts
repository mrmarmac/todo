import type { Task } from './types';
import { isoWeekday } from './dates';

/** True for a valid weekday index, 0 = Monday … 6 = Sunday (matches {@link isoWeekday}). */
export function isWeekday(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
}

/**
 * True when a recurring master is scheduled for `day` (D60). A schedule only
 * produces a suggestion on the Plan my day screen; it never adds anything to
 * Today by itself.
 */
export function isScheduledOn(task: Task, day: string): boolean {
  return task.isRecurring && (task.repeatDays ?? []).includes(isoWeekday(day));
}

/** Short weekday names, index 0 = Monday (matches {@link isoWeekday}). */
export const WEEKDAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Compact label for a schedule ("daily", "weekdays", "mon wed fri"), or null when there is none. */
export function formatRepeatDays(days: number[] | undefined): string | null {
  if (!days || days.length === 0) return null;
  const key = days.join(',');
  if (key === '0,1,2,3,4,5,6') return 'daily';
  if (key === '0,1,2,3,4') return 'weekdays';
  if (key === '5,6') return 'weekends';
  return days.map((d) => WEEKDAY_NAMES[d]).join(' ');
}
