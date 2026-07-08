import { formatRelativeDueDate, dueDateUrgency } from '../core/dates';

/** Due-date label showing a relative date, colour-coded by urgency, ISO on hover. */
export function DueDate({ dueDate, today }: { dueDate: string; today: string }) {
  const urgency = dueDateUrgency(dueDate, today);
  return (
    <span className={`task__due task__due--${urgency}`} title={dueDate}>
      {formatRelativeDueDate(dueDate, today)}
    </span>
  );
}
