import { useState } from 'react';
import type { HistoryEntry } from '../core/types';
import type { UpdateHistoryEntryPatch } from '../core/state';
import { Icon } from './Icon';
import { isDeleteKey } from './cardKeys';
import { useLongPress } from './useLongPress';

interface Props {
  history: HistoryEntry[];
  onUpdateEntry: (id: string, patch: UpdateHistoryEntryPatch) => void;
  onDeleteEntry: (id: string) => void;
}

/** Group entries by their `day`, newest day first, preserving insertion order within a day. */
function groupByDay(history: HistoryEntry[]): [string, HistoryEntry[]][] {
  const byDay = new Map<string, HistoryEntry[]>();
  for (const entry of history) {
    const bucket = byDay.get(entry.day);
    if (bucket) bucket.push(entry);
    else byDay.set(entry.day, [entry]);
  }
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
}

export function HistoryPanel({ history, onUpdateEntry, onDeleteEntry }: Props) {
  const [open, setOpen] = useState(false);
  // Id of the entry being edited; only ever one, so opening a second row closes
  // the first without an explicit cancel.
  const [editingId, setEditingId] = useState<string | null>(null);
  const days = groupByDay(history);

  return (
    <section className="history">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'Show'} History ({history.length})
      </button>
      {open && (
        <div className="history__body">
          {days.length === 0 && <p className="column__placeholder">No completed tasks yet.</p>}
          {days.map(([day, entries]) => (
            <div key={day} className="history__day">
              <h3 className="history__date">{day}</h3>
              <ul className="history__list">
                {entries.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    editing={entry.id === editingId}
                    onEdit={() => setEditingId(entry.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={(patch) => {
                      onUpdateEntry(entry.id, patch);
                      setEditingId(null);
                    }}
                    onDelete={() => {
                      setEditingId(null);
                      onDeleteEntry(entry.id);
                    }}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One logged occurrence. Reading is the common case and editing the rare one,
 * so the row stays plain text until it is deliberately opened: click it with a
 * mouse, long-press it on touch, or press Enter with it focused (D50). Delete /
 * Backspace deletes it outright, matching the task cards.
 */
function HistoryRow({
  entry,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  entry: HistoryEntry;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: UpdateHistoryEntryPatch) => void;
  onDelete: () => void;
}) {
  const { handlers, pressing } = useLongPress(onEdit);
  const isSubtask = entry.occurrenceType === 'subtask';
  const className =
    'history__entry' + (isSubtask ? ' history__entry--subtask' : '');

  if (editing) {
    return (
      <li className={className + ' history__entry--editing'}>
        <HistoryEntryEditForm
          entry={entry}
          onSave={onSave}
          onCancel={onCancelEdit}
          onDelete={onDelete}
        />
      </li>
    );
  }

  return (
    <li className={className}>
      <button
        type="button"
        className={'history__entry-btn' + (pressing ? ' history__entry-btn--pressing' : '')}
        title="Edit — click, or press and hold on touch"
        aria-label={`Edit history entry: ${entry.title}`}
        onKeyDown={(e) => {
          if (isDeleteKey(e.key)) {
            e.preventDefault();
            onDelete();
          }
        }}
        {...handlers}
      >
        {entry.title}
      </button>
    </li>
  );
}

/**
 * Title-only edit form. A History entry's day and timestamp are the record of
 * when the occurrence happened, not something to retype (D50), so the title is
 * the only field offered — plus Delete, which is the other half of the gesture
 * the row exists to expose.
 */
function HistoryEntryEditForm({
  entry,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: HistoryEntry;
  onSave: (patch: UpdateHistoryEntryPatch) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(entry.title);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim() === '') return;
    onSave({ title });
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        aria-label="Edit history entry title"
        autoFocus
      />
      <div className="task__actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Delete history entry"
          title="Delete from History"
          onClick={onDelete}
        >
          <Icon name="trash" />
        </button>
      </div>
    </form>
  );
}
