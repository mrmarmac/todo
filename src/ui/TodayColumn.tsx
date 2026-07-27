import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Task } from '../core/types';
import type { UpdateTaskPatch } from '../core/state';
import { SubtaskList, type SubtaskHandlers } from './SubtaskList';
import { TaskEditPanel } from './TaskEditPanel';
import { DueDate } from './DueDate';
import { TaskTitle } from './TaskTitle';
import { handleArrowNav, isCardTarget, isDeleteKey, isEditTarget } from './cardKeys';

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

/**
 * The insertion slot (0..N) a card-level drag points at: the top half of the
 * card at `index` inserts before it (slot = index), the bottom half after it
 * (slot = index + 1). N slots + 1 = one line between every pair of cards, plus
 * the ends.
 */
function slotForCard(e: DragEvent<HTMLLIElement>, index: number): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const inTopHalf = e.clientY < rect.top + rect.height / 2;
  return inTopHalf ? index : index + 1;
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
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // `insertAt` is a slot in the full list (0..N). `reorderToday` expects the
  // index *after* the dragged card is spliced out, so a slot past the card's
  // own position shifts down by one.
  function handleDrop(slot: number) {
    if (draggingId) {
      const from = todayTasks.findIndex((t) => t.id === draggingId);
      onReorder(draggingId, slot > from ? slot - 1 : slot);
    }
    setDraggingId(null);
    setInsertAt(null);
  }

  return (
    <>
      {todayTasks.length === 0 && (
        <p className="col__placeholder">Add tasks from Master with “→”.</p>
      )}
      <ul className="task-list">
        {todayTasks.map((task, index) => {
          if (editingId === task.id) {
            return (
              <li key={task.id} className="task task--today task--editing">
                <TaskEditPanel
                  task={task}
                  onUpdate={(patch) => onUpdate(task.id, patch)}
                  onDelete={() => onDelete(task.id)}
                  onClose={() => setEditingId(null)}
                  subtaskHandlers={subtaskHandlers}
                  move={{
                    label: 'Move to Master',
                    icon: 'arrow-left',
                    onMove: () => {
                      onRemove(task.id);
                      setEditingId(null);
                    },
                  }}
                  reorder={{
                    onUp: () => onReorder(task.id, index - 1),
                    onDown: () => onReorder(task.id, index + 1),
                    canUp: index > 0,
                    canDown: index < todayTasks.length - 1,
                  }}
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
                (insertAt === index ? ' task--insert-before' : '')
              }
              tabIndex={0}
              draggable
              onClick={(e) => {
                if (isEditTarget(e)) setEditingId(task.id);
              }}
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
                setInsertAt(slotForCard(e, index));
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(slotForCard(e, index));
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setInsertAt(null);
              }}
            >
              <button
                type="button"
                className="task__mark"
                aria-label={task.isActive ? 'Unset active' : 'Set as active'}
                title={task.isActive ? 'Unset active' : 'Set as active'}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetActive(task.id);
                }}
              />
              <div className="task__main">
                <span className="task__drag-handle" aria-hidden="true">
                  ⠿
                </span>
                <TaskTitle title={task.title} className="task__title" />
                {task.sourceTaskId && <span className="task__tag">copy</span>}
              </div>
              {task.dueDate ? (
                <DueDate dueDate={task.dueDate} today={today} />
              ) : (
                <span className="task__due task__due--none" aria-hidden="true">
                  —
                </span>
              )}
              <span className="task__check">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={openSubtasks}
                  aria-label="Complete task"
                  title={openSubtasks ? 'Finish all subtasks first' : 'Complete'}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onComplete(task.id)}
                />
              </span>
              <SubtaskList task={task} activatable {...subtaskHandlers} />
            </li>
          );
        })}
        {draggingId !== null && (
          <li
            className={
              'task-list__end' +
              (insertAt === todayTasks.length ? ' task-list__end--active' : '')
            }
            aria-hidden="true"
            onDragOver={(e) => {
              e.preventDefault();
              setInsertAt(todayTasks.length);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(todayTasks.length);
            }}
          />
        )}
      </ul>
    </>
  );
}
