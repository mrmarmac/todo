import type { AppState, HistoryEntry, Task } from '../../core/types';
import type { UseConfirmResult } from '../ConfirmDialog';
import { HistoryPanel } from '../HistoryPanel';
import { MobileTaskCard } from './MobileTaskCard';
import type { ToastState } from './Toast';

type ConfirmFn = UseConfirmResult['confirm'];

interface Props {
  tasks: Task[];
  today: string;
  history: HistoryEntry[];
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
 * Done page of the mobile pager: accordion cards (Phase 2, plan §Files). Also
 * hosts the relocated {@link HistoryPanel} (App.tsx no longer renders it
 * directly on mobile — see the `isMobile` branch there).
 */
export function MobileDonePage({
  tasks,
  today,
  history,
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
  const doneTasks = tasks.filter((t) => t.column === 'done');

  return (
    <>
      <h2 className="m-page__heading">Done</h2>
      {doneTasks.length === 0 && (
        <p className="m-page__placeholder">Completed tasks land here until you Clear them.</p>
      )}
      <ul className="m-card-list">
        {doneTasks.map((task) => (
          <MobileTaskCard
            key={task.id}
            task={task}
            today={today}
            column="done"
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
          />
        ))}
      </ul>
      <HistoryPanel history={history} />
    </>
  );
}
