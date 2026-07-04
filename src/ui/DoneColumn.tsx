import { useState } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';
import { SubtaskList } from './SubtaskList';
import { TaskEditForm } from './TaskEditForm';

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
  onUncomplete: (id: string) => void;
  onClear: () => void;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
}

export function DoneColumn({ tasks, onUncomplete, onClear, onUpdate, onDelete }: Props) {
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
            <li key={task.id} className="task task--done">
              <div className="task__main">
                <span className="task__title task__title--done">{task.title}</span>
                {task.sourceTaskId && <span className="badge badge--copy">recurring</span>}
                {task.dueDate && <span className="task__due">{task.dueDate}</span>}
              </div>
              <div className="task__actions">
                <button type="button" onClick={() => onUncomplete(task.id)}>
                  Undo
                </button>
                <button type="button" onClick={() => setEditingId(task.id)}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(task.id)}>
                  Delete
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
