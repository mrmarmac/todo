import { useEffect, useRef, useState } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';
import type { SubtaskHandlers } from './SubtaskList';
import { AddSubtaskForm } from './SubtaskList';
import { Icon, type IconName } from './Icon';

interface MoveAction {
  /** Full description for title/aria (e.g. "Move to Today"). */
  label: string;
  /** The destination, shown as visible button text so the arrow isn't decoded. */
  shortLabel: 'Today' | 'Master';
  icon: IconName;
  /** Tints the button with the destination column's colour (D34/D52). */
  destination: 'today' | 'master';
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
  const panelRef = useRef<HTMLDivElement>(null);

  // A blank title reverts to the old one (D-inline); any real change is saved.
  function commitTitle() {
    if (title.trim() === '') {
      setTitle(task.title);
      return;
    }
    if (title !== task.title) onUpdate({ title });
  }

  // Click-away closes the panel; the fields' own blur-commits mean click-away
  // therefore *persists* the edit (D52/WP5).
  //
  // This MUST listen for `click`, never `pointerdown`. Ordering: an outside
  // pointerdown makes the focused input fire `blur` (its commit runs) → then the
  // `click` fires → we close. Closing on pointerdown would unmount the inputs
  // before React's onBlur runs and lose the pending edit. Do not change this to
  // pointerdown.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      const panel = panelRef.current;
      if (!panel) return;
      // A target detached by a re-render before we look (a subtask row that a
      // blur just deleted) originated inside the panel — treat it as inside.
      if (!document.contains(target)) return;
      // Any click within a task row is handled by that row: clicks inside this
      // panel keep it open; clicks on another card let that card manage the
      // switch (in Today the shared editing state closes this one for us). Only
      // a click on genuinely empty chrome closes-and-persists here. Modal
      // surfaces are left alone too.
      if (target instanceof Element && target.closest('.task, .confirm-dialog, .toast')) {
        return;
      }
      onClose();
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
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

      {/*
        Fixed slot order in both editors: [move] · [reorder — Today only] ·
        spacer · [delete] · [Done]. Move is always leftmost and reads its
        destination as text, so the arrow never flips meaning between sections
        (D52/WP6); delete sits apart next to Done via the delete button's
        auto left margin, so nothing shifts position between the two editors.
      */}
      <div className="edit-panel__actions">
        {move && (
          <button
            type="button"
            className={`edit-panel__move edit-panel__move--${move.destination}`}
            aria-label={move.label}
            title={move.label}
            disabled={move.disabled}
            onClick={move.onMove}
          >
            <Icon name={move.icon} />
            <span>{move.shortLabel}</span>
          </button>
        )}
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
        <button
          type="button"
          className="icon-btn edit-panel__delete"
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
