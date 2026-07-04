import { useState } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';

interface Props {
  task: Task;
  onSave: (patch: UpdateTaskPatch) => void;
  onCancel: () => void;
  /** Master-only: recurring is a Master-template concept (D23). */
  recurringEditable?: boolean;
}

/**
 * Shared inline edit form for a task's title/due date (and, in Master, the
 * recurring flag). Mounted only while editing, so its local state always
 * seeds fresh from the current `task` — no stale values survive a state
 * replacement (e.g. Import) that happens while a card sits unedited (C11).
 */
export function TaskEditForm({ task, onSave, onCancel, recurringEditable = false }: Props) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [isRecurring, setIsRecurring] = useState(task.isRecurring);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    const patch: UpdateTaskPatch = { title, dueDate: dueDate || null };
    if (recurringEditable) patch.isRecurring = isRecurring;
    onSave(patch);
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Edit title"
        autoFocus
      />
      <div className="edit-form__row">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {recurringEditable && (
          <label>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Recurring
          </label>
        )}
      </div>
      <div className="task__actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
