import { useState } from 'react';
import type { AppState, Task } from '../../core/types';
import {
  moveToToday,
  removeFromToday,
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
import { Icon } from '../Icon';
import { MobileSubtasks } from './MobileSubtasks';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';

type ConfirmFn = UseConfirmResult['confirm'];
export type MobileColumn = 'master' | 'today' | 'done';

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

  const cardClass =
    'm-card' +
    (expanded ? ' m-card--expanded' : '') +
    (task.isActive ? ' m-card--active' : '') +
    (editing ? ' m-card--editing' : '');

  if (editing) {
    return (
      <li className={cardClass}>
        <TaskEditForm
          task={task}
          recurringEditable={column === 'master'}
          onSave={(patch) => {
            apply((s) => updateTask(s, task.id, patch));
            onCancelEdit();
          }}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  return (
    <li className={cardClass}>
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
      {sheetOpen && (
        <ActionSheet items={sheetItems} onClose={() => setSheetOpen(false)} />
      )}
    </li>
  );
}
