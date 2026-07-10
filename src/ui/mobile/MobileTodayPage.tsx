import type { AppState, Task } from '../../core/types';
import type { UseConfirmResult } from '../ConfirmDialog';
import { MobileTaskCard } from './MobileTaskCard';
import type { ToastState } from './Toast';

type ConfirmFn = UseConfirmResult['confirm'];

interface Props {
  tasks: Task[];
  today: string;
  apply: (fn: (s: AppState) => AppState) => void;
  confirm: ConfirmFn;
  expandedId: string | null;
  editingId: string | null;
  onToggleExpand: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  revealedId: string | null;
  onReveal: (id: string | null) => void;
  showToast: (toast: ToastState) => void;
}

/**
 * Today page of the mobile pager: accordion cards (Phase 2, plan §Files).
 * `tasks` is already in Today order (array order is the manual Today order,
 * SPEC), so filtering preserves it.
 */
export function MobileTodayPage({
  tasks,
  today,
  apply,
  confirm,
  expandedId,
  editingId,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  revealedId,
  onReveal,
  showToast,
}: Props) {
  const todayTasks = tasks.filter((t) => t.column === 'today');

  return (
    <>
      <h2 className="m-page__heading">Today</h2>
      {todayTasks.length === 0 && (
        <p className="m-page__placeholder">Add tasks from Master to see them here.</p>
      )}
      <ul className="m-card-list">
        {todayTasks.map((task, i) => (
          <MobileTaskCard
            key={task.id}
            task={task}
            today={today}
            column="today"
            expanded={expandedId === task.id}
            editing={editingId === task.id}
            onToggleExpand={() => onToggleExpand(task.id)}
            onStartEdit={() => onStartEdit(task.id)}
            onCancelEdit={onCancelEdit}
            apply={apply}
            confirm={confirm}
            revealedId={revealedId}
            onReveal={onReveal}
            showToast={showToast}
            todayIndex={i}
          />
        ))}
      </ul>
    </>
  );
}
