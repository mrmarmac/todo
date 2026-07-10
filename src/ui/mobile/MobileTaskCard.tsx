import { useState } from 'react';
import type { AppState, Task } from '../../core/types';
import {
  moveToToday,
  removeFromToday,
  reorderToday,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  setActive,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  completeSubtask,
  uncompleteSubtask,
  setActiveSubtask,
} from '../../core/state';
import type { UseConfirmResult } from '../ConfirmDialog';
import type { SubtaskHandlers } from '../SubtaskList';
import { AddSubtaskForm } from '../SubtaskList';
import { TaskTitle } from '../TaskTitle';
import { TaskEditForm } from '../TaskEditForm';
import { DueDate } from '../DueDate';
import { Icon, type IconName } from '../Icon';
import { MobileSubtasks } from './MobileSubtasks';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';
import { useCardSwipe } from './useCardSwipe';
import type { ReorderBinding } from './useLongPressReorder';
import type { ToastState } from './Toast';

type ConfirmFn = UseConfirmResult['confirm'];
export type MobileColumn = 'master' | 'today' | 'done';

/** Width (px) of one revealed left-swipe action button. */
const ACTION_BTN = 56;

interface Props {
  task: Task;
  today: string;
  column: MobileColumn;
  expanded: boolean;
  editing: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  apply: (fn: (s: AppState) => AppState) => void;
  confirm: ConfirmFn;
  /** Single revealed card across all pages, and its setter (plan §3). */
  revealedId: string | null;
  onReveal: (id: string | null) => void;
  /** Show an undo/status toast (plan §4). */
  showToast: (toast: ToastState) => void;
  /** This card's position in the Today order — captured for complete-undo. */
  todayIndex?: number;
  /** Long-press-drag reorder wiring (Today collapsed cards only, plan §4). */
  reorder?: ReorderBinding;
}

/** Compact "n/m" subtask completion chip with a micro progress bar; `null` when there are no subtasks. */
export function SubtaskProgressChip({ task }: { task: Task }) {
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
 * Shared collapsed/expanded card used by all three mobile pages (plan §Files,
 * §6). Collapsed matches Phase 1 exactly; tapping the header expands it in
 * place (accordion — `expanded`/`onToggleExpand` are lifted to
 * {@link ./MobileBoard} so only one card is ever open). The expanded body adds
 * subtasks, an inline add-subtask affordance, a Focus chip (Today only), and a
 * ⋯ menu for the rarer actions (move/complete/delete) — no permanent icon row.
 */
export function MobileTaskCard({
  task,
  today,
  column,
  expanded,
  editing,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  apply,
  confirm,
  revealedId,
  onReveal,
  showToast,
  todayIndex,
  reorder,
}: Props) {
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const subtaskHandlers: SubtaskHandlers = {
    onAddSubtask: (taskId, title) => apply((s) => addSubtask(s, taskId, title)),
    onUpdateSubtask: (taskId, subtaskId, patch) =>
      apply((s) => updateSubtask(s, taskId, subtaskId, patch)),
    onDeleteSubtask: (taskId, subtaskId) => apply((s) => deleteSubtask(s, taskId, subtaskId)),
    onCompleteSubtask: (taskId, subtaskId) => apply((s) => completeSubtask(s, taskId, subtaskId)),
    onUncompleteSubtask: (taskId, subtaskId) =>
      apply((s) => uncompleteSubtask(s, taskId, subtaskId)),
    onSetActiveSubtask: (taskId, subtaskId) => apply((s) => setActiveSubtask(s, taskId, subtaskId)),
  };

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this task?',
      body: `“${task.title}” and its subtasks will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) apply((s) => deleteTask(s, task.id));
  }

  const openSubtasks = task.subtasks.some((s) => !s.isCompleted);

  const sheetItems: ActionSheetItem[] =
    column === 'master'
      ? [
          { label: 'Edit', onSelect: onStartEdit },
          { label: 'Add to Today', onSelect: () => apply((s) => moveToToday(s, task.id)) },
          { label: 'Delete', danger: true, onSelect: handleDelete },
        ]
      : column === 'today'
        ? [
            { label: 'Edit', onSelect: onStartEdit },
            { label: 'Move to Master', onSelect: () => apply((s) => removeFromToday(s, task.id)) },
            {
              label: 'Complete',
              // completeTask throws on open subtasks — the item is disabled
              // in that case, but guard here too since disabled is UI-only.
              onSelect: () => {
                if (!openSubtasks) apply((s) => completeTask(s, task.id));
              },
              disabled: openSubtasks,
              hint: openSubtasks ? 'Finish all subtasks first' : undefined,
            },
            { label: 'Delete', danger: true, onSelect: handleDelete },
          ]
        : [{ label: 'Back to Today', onSelect: () => apply((s) => uncompleteTask(s, task.id)) }];

  // ── Swipe wiring (plan §3/§4) ──────────────────────────────────────────
  // Right-swipe: forward/positive action per column, each dispatched
  // immediately on commit with an undo toast composed from inverse reducers
  // (plan §4). Left-swipe reveals the same rare actions as the ⋯ sheet.
  function moveMasterToday() {
    const wasRecurring = task.isRecurring;
    const id = task.id;
    apply((s) => moveToToday(s, id));
    showToast({
      message: 'Added to Today',
      actionLabel: 'Undo',
      onAction: () =>
        apply((s) => {
          if (!wasRecurring) return removeFromToday(s, id);
          // A recurring master spawns a fresh day-copy; undo removes the
          // newest copy of this master (reverse-find by sourceTaskId).
          const copy = [...s.tasks]
            .reverse()
            .find((t) => t.column === 'today' && t.sourceTaskId === id);
          return copy ? removeFromToday(s, copy.id) : s;
        }),
    });
  }

  function completeToday() {
    if (openSubtasks) return; // guarded — swipe is blocked in this state anyway
    const id = task.id;
    const oldIndex = todayIndex ?? 0;
    apply((s) => completeTask(s, id));
    showToast({
      message: 'Completed',
      actionLabel: 'Undo',
      // uncomplete appends to the end of Today; reorder back to where it was.
      onAction: () => apply((s) => reorderToday(uncompleteTask(s, id), id, oldIndex)),
    });
  }

  function backToToday() {
    // Done → Today is itself an undo, so no toast (plan §4).
    apply((s) => uncompleteTask(s, task.id));
  }

  function moveTodayToMaster() {
    const id = task.id;
    const sourceId = task.sourceTaskId;
    apply((s) => removeFromToday(s, id));
    showToast({
      message: 'Moved to Master',
      actionLabel: 'Undo',
      // Normal task returns to Master under its own id; a day-copy is deleted,
      // so undo re-adds via its master (a fresh copy — ticks reset, per plan).
      onAction: () => apply((s) => moveToToday(s, sourceId ?? id)),
    });
  }

  const onCommitRight =
    column === 'master' ? moveMasterToday : column === 'today' ? completeToday : backToToday;

  // Left-swipe action layer: Master = [Delete]; Today = [→ Master][Delete];
  // Done = none (right-swipe already is the undo).
  interface RevealAction {
    key: string;
    label: string;
    icon: IconName;
    tone: 'accent' | 'danger';
    onSelect: () => void;
  }
  const revealActions: RevealAction[] =
    column === 'master'
      ? [{ key: 'del', label: 'Delete', icon: 'trash', tone: 'danger', onSelect: handleDelete }]
      : column === 'today'
        ? [
            {
              key: 'master',
              label: 'Master',
              icon: 'arrow-left',
              tone: 'accent',
              onSelect: moveTodayToMaster,
            },
            { key: 'del', label: 'Delete', icon: 'trash', tone: 'danger', onSelect: handleDelete },
          ]
        : [];

  const hasLeftActions = revealActions.length > 0;
  const revealWidth = revealActions.length * ACTION_BTN;
  const rightBlocked = column === 'today' && openSubtasks;
  // Right-underlay glyph/tone per column.
  const rightUnder: { icon: IconName; tone: 'ok' | 'accent' } =
    column === 'master'
      ? { icon: 'arrow-right', tone: 'ok' }
      : column === 'today'
        ? { icon: 'check', tone: 'ok' }
        : { icon: 'rotate-ccw', tone: 'accent' };

  const swipe = useCardSwipe({
    // Disabled while editing, and while this card is being drag-reordered so the
    // swipe machine can't fight the long-press drag (plan §4 coexistence).
    disabled: editing || !!reorder?.dragging,
    onCommitRight,
    rightBlocked,
    onBlockedHint: () => showToast({ message: 'Finish subtasks first' }),
    hasLeftActions,
    revealWidth,
    cardId: task.id,
    revealedId,
    onReveal,
  });

  const cardClass =
    'm-card' +
    (expanded ? ' m-card--expanded' : '') +
    (task.isActive ? ' m-card--active' : '') +
    (editing ? ' m-card--editing' : '') +
    (reorder?.className ?? '');

  if (editing) {
    return (
      <li className={cardClass}>
        <div className="m-card__editbody">
          <TaskEditForm
            task={task}
            recurringEditable={column === 'master'}
            onSave={(patch) => {
              apply((s) => updateTask(s, task.id, patch));
              onCancelEdit();
            }}
            onCancel={onCancelEdit}
          />
        </div>
      </li>
    );
  }

  return (
    <li className={cardClass}>
      {/* Right-commit underlay, revealed as the foreground slides right. */}
      <div
        className={`m-card__under m-card__under--complete m-card__under--${rightUnder.tone}`}
        ref={swipe.underCompleteRef}
        aria-hidden="true"
      >
        <Icon name={rightUnder.icon} />
      </div>
      {/* Left-reveal action layer, exposed as the foreground slides left. */}
      {hasLeftActions && (
        <div className="m-card__under m-card__under--actions" ref={swipe.underActionsRef}>
          {revealActions.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`m-card__under-btn m-card__under-btn--${a.tone}`}
              onClick={() => {
                onReveal(null);
                a.onSelect();
              }}
            >
              <Icon name={a.icon} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <div
        className="m-card__fg"
        ref={swipe.fgRef}
        // Swipe and long-press reorder share this surface (plan §4): both see
        // each pointer event; the movement thresholds decide which one wins.
        onPointerDown={(e) => {
          swipe.handlers.onPointerDown(e);
          reorder?.handlers.onPointerDown(e);
        }}
        onPointerMove={(e) => {
          swipe.handlers.onPointerMove(e);
          reorder?.handlers.onPointerMove(e);
        }}
        onPointerUp={(e) => {
          swipe.handlers.onPointerUp(e);
          reorder?.handlers.onPointerUp(e);
        }}
        onPointerCancel={(e) => {
          swipe.handlers.onPointerCancel(e);
          reorder?.handlers.onPointerCancel(e);
        }}
        onContextMenu={reorder?.handlers.onContextMenu}
        onClickCapture={(e) => {
          reorder?.onClickCapture(e);
          if (!e.isPropagationStopped()) swipe.onClickCapture(e);
        }}
      >
        <div
          className="m-card__header"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={onToggleExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleExpand();
            }
          }}
        >
          <div className="m-card__main">
            <TaskTitle title={task.title} className="m-card__title" />
            {column === 'master' && task.isRecurring && (
              <span className="badge badge--recurring">recurring</span>
            )}
            {column !== 'master' && task.sourceTaskId && (
              <span className="badge badge--copy">recurring</span>
            )}
            {task.dueDate && <DueDate dueDate={task.dueDate} today={today} />}
          </div>
          <SubtaskProgressChip task={task} />
          {expanded && (
            <button
              type="button"
              className="m-card__more"
              aria-label="More actions"
              onClick={(e) => {
                e.stopPropagation();
                setSheetOpen(true);
              }}
            >
              <Icon name="dots" />
            </button>
          )}
        </div>
        <div className="m-card__expand">
          <div className="m-card__expand-inner">
            {column === 'today' && (
              <button
                type="button"
                className={'m-focus-chip' + (task.isActive ? ' m-focus-chip--on' : '')}
                aria-pressed={task.isActive}
                onClick={() => apply((s) => setActive(s, task.id))}
              >
                <Icon name="star" />
                {task.isActive ? 'Focusing' : 'Focus'}
              </button>
            )}
            <MobileSubtasks
              task={task}
              interactive={column === 'today'}
              readOnly={column === 'done'}
              {...subtaskHandlers}
            />
            {column !== 'done' &&
              (addingSubtask ? (
                <AddSubtaskForm
                  taskId={task.id}
                  onAddSubtask={subtaskHandlers.onAddSubtask}
                  onClose={() => setAddingSubtask(false)}
                />
              ) : (
                <button
                  type="button"
                  className="m-card__add-subtask"
                  onClick={() => setAddingSubtask(true)}
                >
                  <Icon name="plus" /> Add subtask
                </button>
              ))}
          </div>
        </div>
      </div>
      {sheetOpen && <ActionSheet items={sheetItems} onClose={() => setSheetOpen(false)} />}
    </li>
  );
}
