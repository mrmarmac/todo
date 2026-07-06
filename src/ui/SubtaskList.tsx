import { useState } from 'react';
import type { Task } from '../core/types';

export interface SubtaskHandlers {
  onAddSubtask: (taskId: string, title: string) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, patch: { title?: string }) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onCompleteSubtask: (taskId: string, subtaskId: string) => void;
  onUncompleteSubtask: (taskId: string, subtaskId: string) => void;
  onSetActiveSubtask: (taskId: string, subtaskId: string) => void;
}

interface Props extends SubtaskHandlers {
  task: Task;
  /** Read-only rendering (Done column): show subtasks struck-through, no controls. */
  readOnly?: boolean;
  /** Today only: subtask titles are clickable to set/unset active (SPEC §6.8). */
  activatable?: boolean;
}

export function SubtaskList({ task, readOnly = false, activatable = false, ...h }: Props) {
  // Ticking is a Today-only activity (D18) — Master subtask checkboxes must be
  // disabled since core now no-ops the tick outside Today.
  const tickable = task.column === 'today';

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
          <SubtaskRow
            key={s.id}
            taskId={task.id}
            subtask={s}
            activatable={activatable}
            tickable={tickable}
            {...h}
          />
        ))}
      </ul>
      <AddSubtaskForm taskId={task.id} onAddSubtask={h.onAddSubtask} />
    </div>
  );
}

function SubtaskRow({
  taskId,
  subtask,
  activatable,
  tickable,
  onUpdateSubtask,
  onDeleteSubtask,
  onCompleteSubtask,
  onUncompleteSubtask,
  onSetActiveSubtask,
}: SubtaskHandlers & {
  taskId: string;
  subtask: Task['subtasks'][number];
  activatable: boolean;
  tickable: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="subtask subtask--editing">
        <SubtaskEditForm
          subtask={subtask}
          onSave={(patch) => {
            onUpdateSubtask(taskId, subtask.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const titleClass =
    'subtask__title' +
    (subtask.isCompleted ? ' subtask__title--done' : '') +
    (subtask.isActive ? ' subtask__title--active' : '');

  return (
    <li className={'subtask' + (subtask.isActive ? ' subtask--active' : '')}>
      <span className="subtask__check">
        <input
          type="checkbox"
          aria-label={`Complete ${subtask.title}`}
          checked={subtask.isCompleted}
          disabled={!tickable}
          title={tickable ? undefined : 'Ticking is only available in Today'}
          onChange={(e) =>
            e.target.checked
              ? onCompleteSubtask(taskId, subtask.id)
              : onUncompleteSubtask(taskId, subtask.id)
          }
        />
        {activatable && !subtask.isCompleted ? (
          <button
            type="button"
            className={titleClass + ' subtask__activate'}
            title={subtask.isActive ? 'Unset active' : 'Set as active'}
            onClick={() => onSetActiveSubtask(taskId, subtask.id)}
          >
            {subtask.title}
          </button>
        ) : (
          <span className={titleClass}>{subtask.title}</span>
        )}
      </span>
      <span className="subtask__actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Edit subtask"
          title="Edit"
          onClick={() => setEditing(true)}
        >
          ✎
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Delete subtask"
          title="Delete"
          onClick={() => onDeleteSubtask(taskId, subtask.id)}
        >
          ✕
        </button>
      </span>
    </li>
  );
}

/**
 * Mounted only while editing, so its local state always seeds fresh from the
 * current `subtask` — avoids the stale-seeding bug (C11) that a
 * useState(subtask.title) set up once at row-mount time would have.
 */
function SubtaskEditForm({
  subtask,
  onSave,
  onCancel,
}: {
  subtask: Task['subtasks'][number];
  onSave: (patch: { title: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(subtask.title);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onSave({ title });
  }

  return (
    <form className="subtask__edit" onSubmit={submit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Edit subtask"
        autoFocus
      />
      <button type="submit">Save</button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
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
