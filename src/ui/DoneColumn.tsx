import { useState } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';
import { SubtaskList } from './SubtaskList';
import { TaskEditForm } from './TaskEditForm';
import { DueDate } from './DueDate';
import { Icon } from './Icon';
import { handleArrowNav, isCardTarget, isDeleteKey } from './cardKeys';

const noopSubtaskHandlers = {
  onAddSubtask: () => {},
  onUpdateSubtask: () => {},
  onDeleteSubtask: () => {},
  onCompleteSubtask: () => {},
  onUncompleteSubtask: () => {},
  onSetActiveSubtask: () => {},
};

interface Props {
  tasks: Task[];
  today: string;
  onUncomplete: (id: string) => void;
  onClear: () => void;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
}

export function DoneColumn({ tasks, today, onUncomplete, onClear, onUpdate, onDelete }: Props) {
  const doneTasks = tasks.filter((t) => t.column === 'done');
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="column column--done">
      <div className="column__head">
        <h2>Done</h2>
        <button type="button" disabled={doneTasks.length === 0} onClick={onClear}>
          Clear
        </button>
      </div>
      {doneTasks.length === 0 && (
        <p className="column__placeholder">Completed tasks land here until you Clear them.</p>
      )}
      <ul className="task-list">
        {doneTasks.map((task) => {
          if (editingId === task.id) {
            return (
              <li key={task.id} className="task task--done task--editing">
                <TaskEditForm
                  task={task}
                  onSave={(patch) => {
                    onUpdate(task.id, patch);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            );
          }
          return (
            <li
              key={task.id}
              className="task task--done"
              tabIndex={0}
              onKeyDown={(e) => {
                if (handleArrowNav(e)) return;
                if (!isCardTarget(e)) return;
                if (e.key === 'u') {
                  e.preventDefault();
                  onUncomplete(task.id);
                } else if (e.key === 'e') {
                  e.preventDefault();
                  setEditingId(task.id);
                } else if (isDeleteKey(e.key)) {
                  e.preventDefault();
                  onDelete(task.id);
                }
              }}
            >
              <div className="task__main">
                <span className="task__title task__title--done">{task.title}</span>
                {task.sourceTaskId && <span className="badge badge--copy">recurring</span>}
                {task.dueDate && <DueDate dueDate={task.dueDate} today={today} />}
              </div>
              <div className="task__actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Undo (back to Today)"
                  title="Undo (back to Today)"
                  onClick={() => onUncomplete(task.id)}
                >
                  <Icon name="rotate-ccw" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Edit"
                  title="Edit"
                  onClick={() => setEditingId(task.id)}
                >
                  <Icon name="pencil" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Delete"
                  title="Delete"
                  onClick={() => onDelete(task.id)}
                >
                  <Icon name="trash" />
                </button>
              </div>
              <SubtaskList task={task} readOnly {...noopSubtaskHandlers} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
