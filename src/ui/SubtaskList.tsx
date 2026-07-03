import { useState } from 'react';
import type { Task } from '../core/types';

export interface SubtaskHandlers {
  onAddSubtask: (taskId: string, title: string) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, patch: { title?: string }) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onCompleteSubtask: (taskId: string, subtaskId: string) => void;
  onUncompleteSubtask: (taskId: string, subtaskId: string) => void;
}

interface Props extends SubtaskHandlers {
  task: Task;
  /** Read-only rendering (Done column): show subtasks struck-through, no controls. */
  readOnly?: boolean;
}

export function SubtaskList({ task, readOnly = false, ...h }: Props) {
  if (readOnly) {
    if (task.subtasks.length === 0) return null;
    return (
      <ul className="subtask-list">
        {task.subtasks.map((s) => (
          <li key={s.id} className="subtask">
            <span
              className={'subtask__title' + (s.isCompleted ? ' subtask__title--done' : '')}
            >
              {s.title}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="subtasks">
      <ul className="subtask-list">
        {task.subtasks.map((s) => (
          <SubtaskRow key={s.id} taskId={task.id} subtask={s} {...h} />
        ))}
      </ul>
      <AddSubtaskForm taskId={task.id} onAddSubtask={h.onAddSubtask} />
    </div>
  );
}

function SubtaskRow({
  taskId,
  subtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onCompleteSubtask,
  onUncompleteSubtask,
}: SubtaskHandlers & { taskId: string; subtask: Task['subtasks'][number] }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onUpdateSubtask(taskId, subtask.id, { title });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="subtask subtask--editing">
        <form className="subtask__edit" onSubmit={saveEdit}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Edit subtask"
            autoFocus
          />
          <button type="submit">Save</button>
          <button
            type="button"
            onClick={() => {
              setTitle(subtask.title);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="subtask">
      <label className="subtask__check">
        <input
          type="checkbox"
          checked={subtask.isCompleted}
          onChange={(e) =>
            e.target.checked
              ? onCompleteSubtask(taskId, subtask.id)
              : onUncompleteSubtask(taskId, subtask.id)
          }
        />
        <span
          className={'subtask__title' + (subtask.isCompleted ? ' subtask__title--done' : '')}
        >
          {subtask.title}
        </span>
      </label>
      <span className="subtask__actions">
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" onClick={() => onDeleteSubtask(taskId, subtask.id)}>
          ✕
        </button>
      </span>
    </li>
  );
}

function AddSubtaskForm({
  taskId,
  onAddSubtask,
}: {
  taskId: string;
  onAddSubtask: (taskId: string, title: string) => void;
}) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onAddSubtask(taskId, title);
    setTitle('');
  }

  return (
    <form className="subtask-add" onSubmit={submit}>
      <input
        type="text"
        placeholder="Add subtask…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="New subtask"
      />
      <button type="submit" disabled={title.trim() === ''}>
        +
      </button>
    </form>
  );
}
