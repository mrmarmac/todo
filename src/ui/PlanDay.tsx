import { useEffect, useRef, useState } from 'react';
import type { DaySuggestion, SuggestionReason } from '../core/planDay';
import { formatRelativeDueDate } from '../core/dates';
import { Icon } from './Icon';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  /** The day being planned (YYYY-MM-DD). */
  day: string;
  suggestions: DaySuggestion[];
  /** Start the day with these ids in Today order, deleting the let-go ones (D65). */
  onStart: (pickedIds: string[], letGoIds: string[]) => void;
  onClose: () => void;
}

const GROUPS: { reason: SuggestionReason; title: string }[] = [
  { reason: 'carried', title: 'Unfinished' },
  { reason: 'overdue', title: 'Overdue' },
  { reason: 'due', title: 'Due today' },
  { reason: 'scheduled', title: 'Scheduled' },
];

function dayParts(iso: string): { weekday: string; date: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'long' }),
    date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
  };
}

/**
 * Plan my day (D61): replaces New Day's instant rollover with one screen that
 * suggests what belongs in the new day. Everything suggested starts ticked;
 * the user unticks what they don't want. Starting applies New Day plus the
 * picks in one step, covered by the usual undo toast.
 */
export function PlanDay({ day, suggestions, onStart, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);
  const [picked, setPicked] = useState(() => new Set(suggestions.map((s) => s.task.id)));
  const [letGo, setLetGo] = useState(() => new Set<string>());
  const { weekday, date } = dayParts(day);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleLetGo = (id: string) =>
    setLetGo((g) => {
      const next = new Set(g);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickedIds = suggestions
    .map((s) => s.task.id)
    .filter((id) => picked.has(id) && !letGo.has(id));
  const letGoIds = [...letGo];

  return (
    <div
      className="plan-day__backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-day-title"
    >
      <div className="plan-day" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="plan-day__head">
          <h2 id="plan-day-title">
            <span className="plan-day__label">Plan</span>
            <span className="plan-day__weekday">{weekday}</span>
            <span className="plan-day__date">{date}</span>
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        {suggestions.length === 0 ? (
          <p className="plan-day__empty">
            Nothing is unfinished, due or scheduled. The day starts with an empty Today; add
            from Master whenever you are ready.
          </p>
        ) : (
          GROUPS.map(({ reason, title }) => {
            const rows = suggestions.filter((s) => s.reason === reason);
            if (rows.length === 0) return null;
            return (
              <section key={reason} className="plan-day__group">
                <h3>{title}</h3>
                <ul>
                  {rows.map(({ task }) => {
                    // Only a normal carried task can be let go: a carried
                    // day-copy is offered as its recurring master, which must
                    // stay (unticking it is how you skip a repeat).
                    const canLetGo = reason === 'carried' && !task.isRecurring;
                    const gone = letGo.has(task.id);
                    // This rollover will be its (carriedDays + 1)th carry-over.
                    const putOff = (task.carriedDays ?? 0) + 1;
                    return (
                      <li key={task.id} className={gone ? 'plan-day__item--gone' : undefined}>
                        <div className="plan-day__row">
                          <label className="plan-day__pick">
                            <span className="task__check">
                              <input
                                type="checkbox"
                                checked={picked.has(task.id) && !gone}
                                disabled={gone}
                                onChange={() => toggle(task.id)}
                              />
                            </span>
                            <span className="plan-day__text">
                              <span className="plan-day__title">{task.title}</span>
                              {canLetGo && putOff > 1 && (
                                <span
                                  className={
                                    'plan-day__stuck' + (putOff >= 3 ? ' plan-day__stuck--hot' : '')
                                  }
                                >
                                  {gone ? 'Will be deleted' : `Put off ${putOff} times`}
                                </span>
                              )}
                              {canLetGo && putOff === 1 && gone && (
                                <span className="plan-day__stuck">Will be deleted</span>
                              )}
                            </span>
                            {reason === 'overdue' && task.dueDate && (
                              <span className="plan-day__due">
                                {formatRelativeDueDate(task.dueDate, day)}
                              </span>
                            )}
                          </label>
                          {canLetGo && (
                            <button
                              type="button"
                              className="plan-day__letgo"
                              aria-pressed={gone}
                              aria-label={gone ? `Keep ${task.title}` : `Let go of ${task.title}`}
                              onClick={() => toggleLetGo(task.id)}
                            >
                              {gone ? 'Keep' : 'Let go'}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        <div className="plan-day__actions">
          <button type="button" onClick={onClose}>
            Not yet
          </button>
          <button
            type="button"
            className="btn-primary"
            autoFocus
            onClick={() => onStart(pickedIds, letGoIds)}
          >
            {pickedIds.length > 0 ? `Start day with ${pickedIds.length}` : 'Start day'}
          </button>
        </div>
      </div>
    </div>
  );
}
