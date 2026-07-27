import { useState } from 'react';
import type { Task } from '../core/types';
import { UrlPill } from './TaskTitle';
import { parseUrl } from '../core/urls';

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

/**
 * The subtask rows shown on a card in its normal (non-editing) state: a
 * completion checkbox plus the title. Editing, adding and deleting subtasks all
 * happen in the card's inline edit view (`TaskEditPanel`), so no per-row action
 * buttons live here anymore.
 */
export function SubtaskList({ task, readOnly = false, activatable = false, ...h }: Props) {
  // Ticking is a Today-only activity (D18) — Master subtask checkboxes are
  // disabled since core no-ops the tick outside Today.
  const tickable = task.column === 'today';

  if (readOnly) {
    if (task.subtasks.length === 0) return null;
    return (
      <ul className="subtask-list">
        {task.subtasks.map((s) => (
          <li key={s.id} className="subtask">
            {parseUrl(s.title) ? (
              <UrlPill title={s.title} />
            ) : (
              <span
                className={'subtask__title' + (s.isCompleted ? ' subtask__title--done' : '')}
              >
                {s.title}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (task.subtasks.length === 0) return null;

  return (
    <ul className="subtask-list">
      {task.subtasks.map((s) => (
        <SubtaskRow
          key={s.id}
          taskId={task.id}
          subtask={s}
          activatable={activatable}
          tickable={tickable}
          onCompleteSubtask={h.onCompleteSubtask}
          onUncompleteSubtask={h.onUncompleteSubtask}
          onSetActiveSubtask={h.onSetActiveSubtask}
        />
      ))}
    </ul>
  );
}

function SubtaskRow({
  taskId,
  subtask,
  activatable,
  tickable,
  onCompleteSubtask,
  onUncompleteSubtask,
  onSetActiveSubtask,
}: {
  taskId: string;
  subtask: Task['subtasks'][number];
  activatable: boolean;
  tickable: boolean;
  onCompleteSubtask: (taskId: string, subtaskId: string) => void;
  onUncompleteSubtask: (taskId: string, subtaskId: string) => void;
  onSetActiveSubtask: (taskId: string, subtaskId: string) => void;
}) {
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
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            e.target.checked
              ? onCompleteSubtask(taskId, subtask.id)
              : onUncompleteSubtask(taskId, subtask.id)
          }
        />
        {parseUrl(subtask.title) ? (
          <UrlPill title={subtask.title} active={subtask.isActive} />
        ) : activatable && !subtask.isCompleted ? (
          <button
            type="button"
            className={titleClass + ' subtask__activate'}
            title={subtask.isActive ? 'Unset active' : 'Set as active'}
            onClick={(e) => {
              e.stopPropagation();
              onSetActiveSubtask(taskId, subtask.id);
            }}
          >
            {subtask.title}
          </button>
        ) : (
          <span className={titleClass}>{subtask.title}</span>
        )}
      </span>
    </li>
  );
}

export function AddSubtaskForm({
  taskId,
  onAddSubtask,
  onClose,
}: {
  taskId: string;
  onAddSubtask: (taskId: string, title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onAddSubtask(taskId, title);
    // Keep the field open + focused so several subtasks can be added in a row.
    setTitle('');
  }

  return (
    <form className="subtask-add" onSubmit={submit}>
      <input
        type="text"
        placeholder="Add subtask…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          // Close just this add field — don't let Escape bubble up and close
          // the whole edit panel too.
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        // Close when the user clicks away without typing anything.
        onBlur={() => {
          if (title.trim() === '') onClose();
        }}
        aria-label="New subtask"
        autoFocus
      />
      <button type="submit" disabled={title.trim() === ''}>
        +
      </button>
    </form>
  );
}
