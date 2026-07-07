import { formatRelativeDueDate } from '../core/dates';

/** Due-date label showing a relative date, with the raw ISO date on hover. */
export function DueDate({ dueDate, today }: { dueDate: string; today: string }) {
  return (
    <span className="task__due" title={dueDate}>
      {formatRelativeDueDate(dueDate, today)}
    </span>
  );
}
