import { useState } from 'react';
import type { RefObject } from 'react';
import type { Task } from '../core/types';
import type { CreateTaskInput, UpdateTaskPatch } from '../core/state';
import { sortMaster } from '../core/sort';
import { parseTaskInput } from '../core/taskInput';
import { formatRelativeDueDate } from '../core/dates';
import { SubtaskList, type SubtaskHandlers } from './SubtaskList';
import { TaskEditPanel } from './TaskEditPanel';
import { DueDate } from './DueDate';
import { TaskTitle } from './TaskTitle';
import { handleArrowNav, isCardTarget, isDeleteKey, isEditTarget } from './cardKeys';

interface Props {
  tasks: Task[];
  today: string;
  addInputRef?: RefObject<HTMLInputElement>;
  /** Id of the most recently created task, briefly highlighted so it can be found. */
  flashId?: string | null;
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
  flashId,
  onCreate,
  onUpdate,
  onDelete,
  onAddToday,
  subtaskHandlers,
}: Props) {
  const masterTasks = sortMaster(tasks.filter((t) => t.column === 'master'));
  // Ids of the recurring masters already represented in Today by a day-copy, so
  // their rows can disable "Move to Today" rather than offering a click that
  // core no-ops (D43). Built once per render instead of scanning per row.
  const copiedMasterIds = new Set(
    tasks.flatMap((t) =>
      t.column === 'today' && t.sourceTaskId !== null ? [t.sourceTaskId] : [],
    ),
  );

  return (
    <>
      <AddTaskForm onCreate={onCreate} inputRef={addInputRef} today={today} />
      {masterTasks.length === 0 && (
        <p className="col__placeholder">No tasks yet — add one above to get started.</p>
      )}
      <ul className="task-list">
        {masterTasks.map((task) => (
          <MasterTask
            key={task.id}
            task={task}
            today={today}
            alreadyInToday={copiedMasterIds.has(task.id)}
            flash={task.id === flashId}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onAddToday={onAddToday}
            subtaskHandlers={subtaskHandlers}
          />
        ))}
      </ul>
    </>
  );
}

/**
 * One-line add form. The due date is typed as a trailing token in the title
 * ("Renew passport fri", "Draft report +3d") and echoed live in the hint, so a
 * task can be filed with a date without ever leaving the keyboard.
 *
 * Nothing here is progressively disclosed: the row's height is constant, so
 * focusing or blurring the field can never reflow the task list underneath and
 * swallow the next click.
 */
function AddTaskForm({
  onCreate,
  inputRef,
  today,
}: {
  onCreate: (input: CreateTaskInput) => void;
  inputRef?: RefObject<HTMLInputElement>;
  today: string;
}) {
  const [raw, setRaw] = useState('');
  const [pickedDate, setPickedDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const parsed = parseTaskInput(raw, today);
  // A typed token wins over the picker, so the last thing you expressed is the
  // one that counts; the picker stays for setting a date without typing.
  const dueDate = parsed.dueDate ?? (pickedDate || null);
  const canSubmit = parsed.title.trim() !== '';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate({ title: parsed.title, dueDate, isRecurring });
    setRaw('');
    setPickedDate('');
    setIsRecurring(false);
    // Keep focus in the field so several tasks can be added in a row.
    inputRef?.current?.focus();
  }

  return (
    <form className="add" onSubmit={submit}>
      <input
        ref={inputRef}
        className="add__input"
        type="text"
        placeholder="New task… “fri”, “+3d”"
        title="Type a trailing date to set a due date: today, tomorrow, mon–sun, +3d, +2w, or 2026-08-01"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        aria-label="New task"
        aria-describedby="add-hint"
      />
      <span className="add__hint" id="add-hint" aria-live="polite">
        {parsed.dueDate && (
          <span className="add__hint-due" title={`“${parsed.token}” → ${parsed.dueDate}`}>
            {formatRelativeDueDate(parsed.dueDate, today)}
          </span>
        )}
      </span>
      <input
        className="add__date"
        type="date"
        value={dueDate ?? ''}
        // A typed token owns the date while it is present (see `dueDate`).
        disabled={parsed.dueDate !== null}
        title={
          parsed.dueDate !== null
            ? 'Date comes from the text — clear the token to pick one here'
            : 'Pick a due date'
        }
        onChange={(e) => setPickedDate(e.target.value)}
        aria-label="Due date"
      />
      <button
        type="button"
        className={'add__recur' + (isRecurring ? ' add__recur--on' : '')}
        aria-pressed={isRecurring}
        title="Recurring task — stays in Master and is copied into Today"
        onClick={() => setIsRecurring((v) => !v)}
      >
        Repeat
      </button>
      <button type="submit" className="add__submit" disabled={!canSubmit}>
        Add
      </button>
    </form>
  );
}

function MasterTask({
  task,
  today,
  alreadyInToday,
  flash,
  onUpdate,
  onDelete,
  onAddToday,
  subtaskHandlers,
}: {
  task: Task;
  today: string;
  /** Recurring master whose day-copy is already in Today (D43). */
  alreadyInToday: boolean;
  flash: boolean;
  onUpdate: (id: string, patch: UpdateTaskPatch) => void;
  onDelete: (id: string) => void;
  onAddToday: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="task task--editing">
        <TaskEditPanel
          task={task}
          recurringEditable
          onUpdate={(patch) => onUpdate(task.id, patch)}
          onDelete={() => onDelete(task.id)}
          onClose={() => setEditing(false)}
          subtaskHandlers={subtaskHandlers}
          move={{
            label: alreadyInToday ? 'Already in Today' : 'Move to Today',
            icon: 'arrow-right',
            disabled: alreadyInToday,
            onMove: () => {
              onAddToday(task.id);
              setEditing(false);
            },
          }}
        />
      </li>
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLLIElement>) {
    if (handleArrowNav(e)) return;
    if (!isCardTarget(e)) return;
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (!alreadyInToday) onAddToday(task.id);
    } else if (e.key === 'e') {
      e.preventDefault();
      setEditing(true);
    } else if (isDeleteKey(e.key)) {
      e.preventDefault();
      onDelete(task.id);
    }
  }

  return (
    <li
      className={
        'task' +
        (task.isRecurring ? ' task--recurring' : '') +
        (flash ? ' task--flash' : '')
      }
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (isEditTarget(e)) setEditing(true);
      }}
    >
      <span
        className={'task__mark' + (task.isRecurring ? ' task__mark--recurring' : '')}
        aria-hidden="true"
      />
      <div className="task__main">
        <TaskTitle title={task.title} className="task__title" />
        {task.isRecurring && <span className="task__tag">repeat</span>}
      </div>
      {task.dueDate ? (
        <DueDate dueDate={task.dueDate} today={today} />
      ) : (
        <span className="task__due task__due--none" aria-hidden="true">
          —
        </span>
      )}
      <SubtaskList task={task} {...subtaskHandlers} />
    </li>
  );
}
