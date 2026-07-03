import { useState } from 'react';
import type { Task } from '../core/types';
import type { CreateTaskInput, UpdateTaskPatch } from '../core/state';
import { sortMaster } from '../core/sort';
import { SubtaskList, type SubtaskHandlers } from './SubtaskList';

interface Props {
  tasks: Task[];
  onCreate: (input: CreateTaskInput) => void;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
  onAddToday: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
}

export function MasterColumn({
  tasks,
  onCreate,
  onUpdate,
  onDelete,
  onAddToday,
  subtaskHandlers,
}: Props) {
  const masterTasks = sortMaster(tasks.filter((t) => t.column === 'master'));

  return (
    <section className="column column--master">
      <h2>Master</h2>
      <AddTaskForm onCreate={onCreate} />
      <ul className="task-list">
        {masterTasks.map((task) => (
          <MasterTask
            key={task.id}
            task={task}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAddToday={onAddToday}
            subtaskHandlers={subtaskHandlers}
          />
        ))}
      </ul>
    </section>
  );
}

function AddTaskForm({ onCreate }: { onCreate: (input: CreateTaskInput) => void }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onCreate({ title, dueDate: dueDate || null, isRecurring });
    setTitle('');
    setDueDate('');
    setIsRecurring(false);
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        className="add-form__title"
        type="text"
        placeholder="New task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Task title"
      />
      <div className="add-form__row">
        <label className="add-form__due">
          Due
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="add-form__recurring">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
          />
          Recurring
        </label>
        <button type="submit" disabled={title.trim() === ''}>
          Add
        </button>
      </div>
    </form>
  );
}

function MasterTask({
  task,
  onUpdate,
  onDelete,
  onAddToday,
  subtaskHandlers,
}: {
  task: Task;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
  onAddToday: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [isRecurring, setIsRecurring] = useState(task.isRecurring);

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onUpdate(task.id, { title, dueDate: dueDate || null, isRecurring });
    setEditing(false);
  }

  function cancelEdit() {
    setTitle(task.title);
    setDueDate(task.dueDate ?? '');
    setIsRecurring(task.isRecurring);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="task task--editing">
        <form className="edit-form" onSubmit={saveEdit}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Edit title"
            autoFocus
          />
          <div className="edit-form__row">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <label>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring
            </label>
          </div>
          <div className="task__actions">
            <button type="submit">Save</button>
            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`task${task.isRecurring ? ' task--recurring' : ''}`}>
      <div className="task__main">
        <span className="task__title">{task.title}</span>
        {task.isRecurring && <span className="badge badge--recurring">recurring</span>}
        {task.dueDate && <span className="task__due">{task.dueDate}</span>}
      </div>
      <div className="task__actions">
        <button type="button" className="btn-primary" onClick={() => onAddToday(task.id)}>
          → Today
        </button>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" onClick={() => onDelete(task.id)}>
          Delete
        </button>
      </div>
      <SubtaskList task={task} {...subtaskHandlers} />
    </li>
  );
}
