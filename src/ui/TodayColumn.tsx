import { useState } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';
import { SubtaskList, type SubtaskHandlers } from './SubtaskList';
import { TaskEditForm } from './TaskEditForm';
import { DueDate } from './DueDate';
import { handleArrowNav, isCardTarget, isDeleteKey } from './cardKeys';
import { Icon } from './Icon';

interface Props {
  tasks: Task[];
  today: string;
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
  today,
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
  const [addingSubtaskId, setAddingSubtaskId] = useState<string | null>(null);

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
          const openSubtasks = task.subtasks.some((s) => !s.isCompleted);
          return (
            <li
              key={task.id}
              className={
                'task task--today' +
                (task.isActive ? ' task--active' : '') +
                (draggingId === task.id ? ' task--dragging' : '') +
                (overIndex === index ? ' task--drop-target' : '')
              }
              tabIndex={0}
              draggable
              onKeyDown={(e) => {
                if (handleArrowNav(e)) return;
                if (!isCardTarget(e)) return;
                if (e.key === ' ') {
                  e.preventDefault();
                  onSetActive(task.id);
                } else if (e.key === 'c') {
                  if (openSubtasks) return;
                  e.preventDefault();
                  onComplete(task.id);
                } else if (e.key === 'e') {
                  e.preventDefault();
                  setEditingId(task.id);
                } else if (e.key === 's') {
                  e.preventDefault();
                  setAddingSubtaskId(task.id);
                } else if (e.key === 'r') {
                  e.preventDefault();
                  onRemove(task.id);
                } else if (isDeleteKey(e.key)) {
                  e.preventDefault();
                  onDelete(task.id);
                }
              }}
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
                {task.dueDate && <DueDate dueDate={task.dueDate} today={today} />}
              </div>
              <div className="task__actions">
                <button
                  type="button"
                  className="icon-btn btn-primary"
                  disabled={openSubtasks}
                  aria-label="Complete"
                  title={openSubtasks ? 'Finish all subtasks first' : 'Complete'}
                  onClick={() => onComplete(task.id)}
                >
                  <Icon name="check" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Add subtask"
                  title="Add subtask (s)"
                  onClick={() => setAddingSubtaskId(task.id)}
                >
                  <Icon name="plus" />
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
                  aria-label="Remove from Today"
                  title="Remove from Today"
                  onClick={() => onRemove(task.id)}
                >
                  <Icon name="arrow-left" />
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
              <SubtaskList
                task={task}
                activatable
                adding={addingSubtaskId === task.id}
                onAddingChange={(v) => setAddingSubtaskId(v ? task.id : null)}
                {...subtaskHandlers}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
