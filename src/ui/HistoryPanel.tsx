import { useState } from 'react';
import type { HistoryEntry } from '../core/types';

interface Props {
  history: HistoryEntry[];
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

export function HistoryPanel({ history }: Props) {
  const [open, setOpen] = useState(false);
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
                  <li
                    key={entry.id}
                    className={
                      'history__entry' +
                      (entry.occurrenceType === 'subtask' ? ' history__entry--subtask' : '')
                    }
                  >
                    {entry.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
