import type { AppState, Task } from '../../core/types';
import { sortMaster } from '../../core/sort';
import type { UseConfirmResult } from '../ConfirmDialog';
import { MobileTaskCard } from './MobileTaskCard';

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
}

/** Master page of the mobile pager: accordion cards (Phase 2, plan §Files). */
export function MobileMasterPage({
  tasks,
  today,
  apply,
  confirm,
  expandedId,
  editingId,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
}: Props) {
  const masterTasks = sortMaster(tasks.filter((t) => t.column === 'master'));

  return (
    <>
      <h2 className="m-page__heading">Master</h2>
      {masterTasks.length === 0 && (
        <p className="m-page__placeholder">No tasks yet. Use the + button to add one.</p>
      )}
      <ul className="m-card-list">
        {masterTasks.map((task) => (
          <MobileTaskCard
            key={task.id}
            task={task}
            today={today}
            column="master"
            expanded={expandedId === task.id}
            editing={editingId === task.id}
            onToggleExpand={() => onToggleExpand(task.id)}
            onStartEdit={() => onStartEdit(task.id)}
            onCancelEdit={onCancelEdit}
            apply={apply}
            confirm={confirm}
          />
        ))}
      </ul>
    </>
  );
}
