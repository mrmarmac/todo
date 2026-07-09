import { useEffect, useRef, useState } from 'react';
import type { CreateTaskInput } from '../core/state';
import { Icon } from './Icon';

interface Props {
  /** Same create path as MasterColumn's "New task…" field — task always lands in Master. */
  onCreate: (input: CreateTaskInput) => void;
}

/**
 * Mobile-only quick-add: a floating "+" button (`.quick-add-fab`, shown only
 * at `max-width: 900px` via CSS) that opens a small fixed panel with a title
 * field. On the stacked mobile layout Master (and its "New task…" field) sits
 * at the bottom of the scroll, below Today and Done, so this gives a
 * one-tap way to add a task without scrolling the whole page.
 *
 * Submits through the exact same `onCreate` contract as MasterColumn's own
 * `AddTaskForm`, so the task lands in Master exactly as it would from there.
 * The panel stays open after submit (input cleared, refocused) for rapid
 * entry of several tasks in a row; Escape or the backdrop/✕ closes it.
 */
export function QuickAdd({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the field whenever the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes the panel regardless of where focus sits inside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onCreate({ title, dueDate: null, isRecurring: false });
    setTitle('');
    // Keep the panel open and refocus so several tasks can be added in a row.
    inputRef.current?.focus();
  }

  return (
    <>
      {open && (
        <div
          className="quick-add__backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      {open && (
        <form className="quick-add" onSubmit={submit} role="dialog" aria-label="Quick add task">
          <input
            ref={inputRef}
            className="quick-add__input"
            type="text"
            placeholder="New task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Task title"
          />
          <button type="submit" className="btn-primary" disabled={title.trim() === ''}>
            Add
          </button>
          <button
            type="button"
            className="icon-btn quick-add__close"
            aria-label="Close"
            title="Close"
            onClick={() => setOpen(false)}
          >
            <Icon name="x" />
          </button>
        </form>
      )}
      <button
        type="button"
        className="quick-add-fab"
        aria-label="Add task"
        title="Add task"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="plus" />
      </button>
    </>
  );
}
