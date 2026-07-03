import { useState } from 'react';
import type { Task } from '../core/types';
import { SubtaskList, type SubtaskHandlers } from './SubtaskList';

interface Props {
  tasks: Task[];
  onReorder: (id: string, targetIndex: number) => void;
  onRemove: (id: string) => void;
  onComplete: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
}

export function TodayColumn({ tasks, onReorder, onRemove, onComplete, subtaskHandlers }: Props) {
  const todayTasks = tasks.filter((t) => t.column === 'today');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

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
        {todayTasks.map((task, index) => (
          <li
            key={task.id}
            className={
              'task task--today' +
              (draggingId === task.id ? ' task--dragging' : '') +
              (overIndex === index ? ' task--drop-target' : '')
            }
            draggable
            onDragStart={() => setDraggingId(task.id)}
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
              <span className="task__title">{task.title}</span>
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
              <button type="button" onClick={() => onRemove(task.id)}>
                Remove
              </button>
            </div>
            <SubtaskList task={task} {...subtaskHandlers} />
          </li>
        ))}
      </ul>
    </section>
  );
}
