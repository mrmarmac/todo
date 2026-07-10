import type { AppState, Task } from '../../core/types';
import type { UseConfirmResult } from '../ConfirmDialog';
import { TaskTitle } from '../TaskTitle';
import { DueDate } from '../DueDate';

type ConfirmFn = UseConfirmResult['confirm'];

interface Props {
  tasks: Task[];
  today: string;
  /** Not read yet — plumbed through for Phase 2's card actions. */
  apply: (fn: (s: AppState) => AppState) => void;
  /** Not read yet — plumbed through for Phase 2's card actions. */
  confirm: ConfirmFn;
}

/** Compact "n/m" subtask completion chip with a micro progress bar; `null` when there are no subtasks. */
function SubtaskProgressChip({ task }: { task: Task }) {
  const total = task.subtasks.length;
  if (total === 0) return null;
  const completed = task.subtasks.filter((s) => s.isCompleted).length;
  const pct = Math.round((completed / total) * 100);
  return (
    <span className="m-progress-chip" aria-label={`${completed} of ${total} subtasks done`}>
      <span className="m-progress-chip__label">
        {completed}/{total}
      </span>
      <span className="m-progress-chip__bar">
        <span className="m-progress-chip__fill" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

/**
 * Today page of the mobile pager: static collapsed cards, no actions yet
 * (Phase 1). `tasks` is already in Today order (array order is the manual
 * Today order, SPEC), so filtering preserves it. The active task gets the
 * accent left-bar treatment via `.m-card--active`.
 */
export function MobileTodayPage({ tasks, today }: Props) {
  const todayTasks = tasks.filter((t) => t.column === 'today');

  return (
    <>
      <h2 className="m-page__heading">Today</h2>
      {todayTasks.length === 0 && (
        <p className="m-page__placeholder">Add tasks from Master to see them here.</p>
      )}
      <ul className="m-card-list">
        {todayTasks.map((task) => (
          <li
            key={task.id}
            className={'m-card' + (task.isActive ? ' m-card--active' : '')}
          >
            <div className="m-card__main">
              <TaskTitle title={task.title} className="m-card__title" />
              {task.sourceTaskId && <span className="badge badge--copy">recurring</span>}
              {task.dueDate && <DueDate dueDate={task.dueDate} today={today} />}
            </div>
            <SubtaskProgressChip task={task} />
          </li>
        ))}
      </ul>
    </>
  );
}
