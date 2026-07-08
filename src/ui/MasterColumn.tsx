import { useState } from 'react';
import type { RefObject } from 'react';
import type { Task } from '../core/types';
import type { CreateTaskInput, UpdateTaskPatch } from '../core/state';
import { sortMaster } from '../core/sort';
import { addDaysISO } from '../core/dates';
import { Icon } from './Icon';
import { SubtaskList, type SubtaskHandlers } from './SubtaskList';
import { TaskEditForm } from './TaskEditForm';
import { DueDate } from './DueDate';
import { TaskTitle } from './TaskTitle';
import { handleArrowNav, isCardTarget, isDeleteKey } from './cardKeys';

interface Props {
  tasks: Task[];
  today: string;
  addInputRef?: RefObject<HTMLInputElement>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCreate: (input: CreateTaskInput) => void;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
  onAddToday: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
}

export function MasterColumn({
  tasks,
  today,
  addInputRef,
  collapsed = false,
  onToggleCollapse,
  onCreate,
  onUpdate,
  onDelete,
  onAddToday,
  subtaskHandlers,
}: Props) {
  const masterTasks = sortMaster(tasks.filter((t) => t.column === 'master'));

  // Collapsed slim rail (plan R2 §1): a thin strip with a vertical label so
  // Today/Done get the focus. Task data is untouched and returns on expand.
  if (collapsed) {
    return (
      <section className="column column--master column--collapsed">
        <button
          type="button"
          className="column__expand"
          aria-label="Expand Master"
          title="Expand Master (m)"
          onClick={onToggleCollapse}
        >
          <span className="column__rail-label">Master</span>
          <span aria-hidden="true">›</span>
        </button>
      </section>
    );
  }

  return (
    <section className="column column--master">
      <div className="column__head">
        <h2>Master</h2>
        <button
          type="button"
          className="icon-btn column__collapse"
          aria-label="Collapse Master"
          title="Collapse Master (m)"
          onClick={onToggleCollapse}
        >
          ‹
        </button>
      </div>
      <AddTaskForm onCreate={onCreate} inputRef={addInputRef} today={today} />
      {masterTasks.length === 0 && (
        <p className="column__placeholder">No tasks yet — add one above to get started.</p>
      )}
      <ul className="task-list">
        {masterTasks.map((task) => (
          <MasterTask
            key={task.id}
            task={task}
            today={today}
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

function AddTaskForm({
  onCreate,
  inputRef,
  today,
}: {
  onCreate: (input: CreateTaskInput) => void;
  inputRef?: RefObject<HTMLInputElement>;
  today: string;
}) {
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
    // Keep focus in the field so several tasks can be added in a row.
    inputRef?.current?.focus();
  }

  // Single-click relative due dates. Toggle off if the same day is re-picked.
  const quickDates: Array<{ label: string; value: string }> = [
    { label: 'Today', value: today },
    { label: '+1d', value: addDaysISO(today, 1) },
    { label: '+7d', value: addDaysISO(today, 7) },
  ];
  const pickQuick = (value: string) => setDueDate((prev) => (prev === value ? '' : value));

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        ref={inputRef}
        className="add-form__title"
        type="text"
        placeholder="New task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Task title"
      />
      {/* Revealed only while the form has focus (CSS :focus-within). */}
      <div className="add-form__advanced">
        <div className="add-form__row">
          <span className="add-form__label">Due</span>
          <div className="add-form__quick">
            {quickDates.map((q) => (
              <button
                key={q.label}
                type="button"
                className={'add-form__chip' + (dueDate === q.value ? ' add-form__chip--active' : '')}
                onClick={() => pickQuick(q.value)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <input
            className="add-form__date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date"
          />
          <label className="add-form__recurring">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Recurring
          </label>
          <button type="submit" className="add-form__submit" disabled={title.trim() === ''}>
            Add
          </button>
        </div>
      </div>
    </form>
  );
}

function MasterTask({
  task,
  today,
  onUpdate,
  onDelete,
  onAddToday,
  subtaskHandlers,
}: {
  task: Task;
  today: string;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
  onAddToday: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
}) {
  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);

  if (editing) {
    return (
      <li className="task task--editing">
        <TaskEditForm
          task={task}
          recurringEditable
          onSave={(patch) => {
            onUpdate(task.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLLIElement>) {
    if (handleArrowNav(e)) return;
    if (!isCardTarget(e)) return;
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      onAddToday(task.id);
    } else if (e.key === 'e') {
      e.preventDefault();
      setEditing(true);
    } else if (e.key === 's') {
      e.preventDefault();
      setAddingSubtask(true);
    } else if (isDeleteKey(e.key)) {
      e.preventDefault();
      onDelete(task.id);
    }
  }

  return (
    <li
      className={`task${task.isRecurring ? ' task--recurring' : ''}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="task__main">
        <TaskTitle title={task.title} className="task__title" />
        {task.isRecurring && <span className="badge badge--recurring">recurring</span>}
        {task.dueDate && <DueDate dueDate={task.dueDate} today={today} />}
      </div>
      <div className="task__actions">
        <button
          type="button"
          className="icon-btn btn-primary"
          aria-label="Move to Today"
          title="Move to Today"
          onClick={() => onAddToday(task.id)}
        >
          <Icon name="arrow-right" />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Add subtask"
          title="Add subtask (s)"
          onClick={() => setAddingSubtask(true)}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Edit"
          title="Edit"
          onClick={() => setEditing(true)}
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
      <SubtaskList
        task={task}
        adding={addingSubtask}
        onAddingChange={setAddingSubtask}
        {...subtaskHandlers}
      />
    </li>
  );
}
