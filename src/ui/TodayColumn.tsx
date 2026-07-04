import { useState } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';
import { SubtaskList, type SubtaskHandlers } from './SubtaskList';
import { TaskEditForm } from './TaskEditForm';

interface Props {
  tasks: Task[];
  onReorder: (id: string, targetIndex: number) => void;
  onRemove: (id: string) => void;
  onComplete: (id: string) => void;
  onSetActive: (id: string) => void;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
}

export function TodayColumn({
  tasks,
  onReorder,
  onRemove,
  onComplete,
  onSetActive,
  onUpdate,
  onDelete,
  subtaskHandlers,
}: Props) {
  const todayTasks = tasks.filter((t) => t.column === 'today');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleDrop(targetIndex: number) {
    if (draggingId) onReorder(draggingId, targetIndex);
    setDraggingId(null);
    setOverIndex(null);
  }

  return (
    <section className="column column--today">
      <h2>Today</h2>
      {todayTasks.length === 0 && (
        <p className="column__placeholder">Add tasks from Master with “→ Today”.</p>
      )}
      <ul className="task-list">
        {todayTasks.map((task, index) => {
          if (editingId === task.id) {
            return (
              <li key={task.id} className="task task--today task--editing">
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
              className={
                'task task--today' +
                (task.isActive ? ' task--active' : '') +
                (draggingId === task.id ? ' task--dragging' : '') +
                (overIndex === index ? ' task--drop-target' : '')
              }
              draggable
              onDragStart={(e) => {
                setDraggingId(task.id);
                e.dataTransfer.setData('text/plain', task.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(index);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setOverIndex(null);
              }}
            >
              <div className="task__main">
                <span className="task__drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <button
                  type="button"
                  className={'task__title task__activate' + (task.isActive ? ' task__title--active' : '')}
                  title={task.isActive ? 'Unset active' : 'Set as active'}
                  onClick={() => onSetActive(task.id)}
                >
                  {task.title}
                </button>
                {task.sourceTaskId && <span className="badge badge--copy">recurring</span>}
                {task.dueDate && <span className="task__due">{task.dueDate}</span>}
              </div>
              <div className="task__actions">
                {(() => {
                  const openSubtasks = task.subtasks.some((s) => !s.isCompleted);
                  return (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={openSubtasks}
                      title={openSubtasks ? 'Finish all subtasks first' : undefined}
                      onClick={() => onComplete(task.id)}
                    >
                      Complete
                    </button>
                  );
                })()}
                <button type="button" onClick={() => setEditingId(task.id)}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(task.id)}>
                  Delete
                </button>
                <button type="button" onClick={() => onRemove(task.id)}>
                  Remove
                </button>
              </div>
              <SubtaskList task={task} activatable {...subtaskHandlers} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
