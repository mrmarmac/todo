import { formatRelativeDueDate, dueDateUrgency } from '../core/dates';

interface Props {
  dueDate: string;
  today: string;
  /** Done cards drop the urgency colour — a finished task shouldn't shout (D28). */
  done?: boolean;
}

/** Due-date label showing a relative date, colour-coded by urgency, ISO on hover. */
export function DueDate({ dueDate, today, done = false }: Props) {
  const urgency = done ? 'done' : dueDateUrgency(dueDate, today);
  return (
    <span className={`task__due task__due--${urgency}`} title={dueDate}>
      {formatRelativeDueDate(dueDate, today)}
    </span>
  );
}
