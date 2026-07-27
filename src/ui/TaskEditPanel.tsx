import { useState } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';
import type { SubtaskHandlers } from './SubtaskList';
import { AddSubtaskForm } from './SubtaskList';
import { Icon, type IconName } from './Icon';

interface MoveAction {
  label: string;
  icon: IconName;
  disabled?: boolean;
  onMove: () => void;
}

interface ReorderAction {
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}

interface Props {
  task: Task;
  /** Pre-bound to the task id by the caller — the single `updateTask` path. */
  onUpdate: (patch: UpdateTaskPatch) => void;
  onDelete: () => void;
  onClose: () => void;
  subtaskHandlers: SubtaskHandlers;
  /** Master only: recurring is a Master-template concept (D23). */
  recurringEditable?: boolean;
  /** The move-between-columns arrow (→ Today for Master, ← Master for Today). */
  move?: MoveAction;
  /** Today only: reorder this card within the manual Today order. */
  reorder?: ReorderAction;
}

/**
 * Inline edit view for one task, opened by tapping the card body. Replaces the
 * old floating action toolbar and the title-only edit form: retitling,
 * re-dating, editing/adding/deleting subtasks, deleting, moving between columns
 * and reordering all live here, one card at a time.
 *
 * Mounted only while editing, so each field's local state seeds fresh from the
 * current task/subtask — no stale value survives a state replacement (Import,
 * sync pull) that lands while a different card sat open (bug C11).
 */
export function TaskEditPanel({
  task,
  onUpdate,
  onDelete,
  onClose,
  subtaskHandlers,
  recurringEditable = false,
  move,
  reorder,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [adding, setAdding] = useState(false);

  // A blank title reverts to the old one (D-inline); any real change is saved.
  function commitTitle() {
    if (title.trim() === '') {
      setTitle(task.title);
      return;
    }
    if (title !== task.title) onUpdate({ title });
  }

  return (
    <div
      className="edit-panel"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <input
        className="edit-panel__title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitTitle();
            onClose();
          }
        }}
        aria-label="Edit title"
        autoFocus
      />

      <div className="edit-panel__row">
        <input
          className="edit-panel__date"
          type="date"
          value={task.dueDate ?? ''}
          onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
          aria-label="Due date"
        />
        {recurringEditable && (
          <label className="edit-panel__recur">
            <input
              type="checkbox"
              checked={task.isRecurring}
              onChange={(e) => onUpdate({ isRecurring: e.target.checked })}
            />
            Recurring
          </label>
        )}
      </div>

      {task.subtasks.length > 0 && (
        <ul className="edit-panel__subtasks">
          {task.subtasks.map((s) => (
            <SubtaskEditRow
              key={s.id}
              subtask={s}
              onSave={(patch) => subtaskHandlers.onUpdateSubtask(task.id, s.id, patch)}
              onDelete={() => subtaskHandlers.onDeleteSubtask(task.id, s.id)}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <AddSubtaskForm
          taskId={task.id}
          onAddSubtask={subtaskHandlers.onAddSubtask}
          onClose={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="edit-panel__add" onClick={() => setAdding(true)}>
          + Add subtask
        </button>
      )}

      <div className="edit-panel__actions">
        {reorder && (
          <>
            <button
              type="button"
              className="icon-btn"
              aria-label="Move up"
              title="Move up"
              disabled={!reorder.canUp}
              onClick={reorder.onUp}
            >
              <Icon name="chevron-up" />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Move down"
              title="Move down"
              disabled={!reorder.canDown}
              onClick={reorder.onDown}
            >
              <Icon name="chevron-down" />
            </button>
          </>
        )}
        {move && (
          <button
            type="button"
            className="icon-btn"
            aria-label={move.label}
            title={move.label}
            disabled={move.disabled}
            onClick={move.onMove}
          >
            <Icon name={move.icon} />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="Delete task"
          title="Delete"
          onClick={onDelete}
        >
          <Icon name="trash" />
        </button>
        <button type="button" className="edit-panel__done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

/**
 * One subtask as an inline input. Blanking the field and leaving it deletes the
 * subtask (D-inline); any other change is saved. Mounted per-subtask and keyed
 * by id so its local state always seeds fresh (bug C11).
 */
function SubtaskEditRow({
  subtask,
  onSave,
  onDelete,
}: {
  subtask: Task['subtasks'][number];
  onSave: (patch: { title: string }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(subtask.title);

  function commit() {
    if (title.trim() === '') {
      onDelete();
      return;
    }
    if (title !== subtask.title) onSave({ title });
  }

  return (
    <li className="edit-panel__subtask">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`Edit subtask: ${subtask.title}`}
      />
      <button
        type="button"
        className="icon-btn"
        aria-label="Delete subtask"
        title="Delete subtask"
        onClick={onDelete}
      >
        <Icon name="x" />
      </button>
    </li>
  );
}
