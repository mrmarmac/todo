import { useEffect, useRef, useState } from 'react';
import type { AppState, Task } from '../../core/types';
import { reorderToday, uncompleteTask } from '../../core/state';
import type { UseConfirmResult } from '../ConfirmDialog';
import { Icon } from '../Icon';
import { MobileTaskCard } from './MobileTaskCard';
import { useLongPressReorder } from './useLongPressReorder';
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
  const doneTasks = tasks.filter((t) => t.column === 'done');

  // Long-press-drag reorder (plan §4). Same splice contract as desktop
  // `TodayColumn.handleDrop`: the hook hands us the already-adjusted target
  // index, so we dispatch `reorderToday` directly.
  const reorder = useLongPressReorder((id, targetIndex) =>
    apply((s) => reorderToday(s, id, targetIndex)),
  );

  return (
    <>
      <h2 className="m-page__heading">Today</h2>
      {todayTasks.length === 0 && (
        <p className="m-page__placeholder">Add tasks from Master to see them here.</p>
      )}
      <ul className="m-card-list">
        {todayTasks.map((task, i) => {
          // Only a collapsed, non-editing card can arm a reorder drag (plan §4:
          // expanded cards are for working in, not moving).
          const canDrag = expandedId !== task.id && editingId !== task.id;
          return (
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
              reorder={reorder.bind(task.id, i, canDrag)}
            />
          );
        })}
        {/* End-of-list drop indicator, shown when the drag targets past the
            last card (mirrors desktop `.task-list__end--active`). */}
        {reorder.insertSlot === todayTasks.length && (
          <li className="m-list-end-indicator" aria-hidden="true" />
        )}
      </ul>
      <DoneTodaySection tasks={doneTasks} apply={apply} />
    </>
  );
}

/**
 * "Done today (n)" disclosure at the bottom of the Today page (plan §5): the
 * same tasks the Done page lists, shown as a glanceable, inert summary — muted
 * mini-rows with no gestures or expansion, just a "Back to Today" affordance.
 * Collapsed by default; open/closed is local, ephemeral UI state. Hidden
 * entirely once nothing has been completed yet today.
 */
function DoneTodaySection({
  tasks,
  apply,
}: {
  tasks: Task[];
  apply: (fn: (s: AppState) => AppState) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = tasks.length;
  // The count badge pulses on an increase (a fresh completion) — re-triggered
  // by remounting it under a new `key`. Only rising counts pulse; undoing a
  // completion or tapping "Back to Today" (both decreases) stay quiet.
  const prevCount = useRef(count);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (count > prevCount.current) setPulseKey((k) => k + 1);
    prevCount.current = count;
  }, [count]);

  if (count === 0) return null;

  return (
    <section className="m-done-today">
      <button
        type="button"
        className="m-done-today__header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="m-done-today__label">Done today</span>
        <span key={pulseKey} className="m-done-today__count m-pulse">
          {count}
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} />
      </button>
      {open && (
        <ul className="m-done-today__list">
          {tasks.map((task) => (
            <li key={task.id} className="m-done-today__row">
              <span className="m-done-today__title">{task.title}</span>
              <button
                type="button"
                className="m-done-today__back"
                aria-label={`Back to Today: ${task.title}`}
                onClick={() => apply((s) => uncompleteTask(s, task.id))}
              >
                <Icon name="rotate-ccw" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
