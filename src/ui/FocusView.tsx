import { useEffect, useRef } from 'react';
import type { Task } from '../core/types';
import type { SubtaskHandlers } from './SubtaskList';
import { Icon } from './Icon';
import { useFocusTrap } from './useFocusTrap';

interface Props {
  tasks: Task[];
  onComplete: (id: string) => void;
  /** Toggles a Today task as the Now item (setActive): on for another task, off for this one. */
  onSetActive: (id: string) => void;
  subtaskHandlers: SubtaskHandlers;
  onClose: () => void;
}

/**
 * Focus (D66): the Now task alone, at poster scale, with one big Done. When
 * nothing is Now — none set, or the Now task was just finished — it asks
 * "What now?" and offers Today's open tasks rather than silently advancing,
 * so each next task is a choice, not a conveyor belt.
 */
export function FocusView({ tasks, onComplete, onSetActive, subtaskHandlers, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = tasks.filter((t) => t.column === 'today');
  // The Now item may be a subtask (SPEC §6.8); its parent is what we show.
  const now = today.find((t) => t.isActive || t.subtasks.some((s) => s.isActive));
  const queue = today.filter((t) => t !== now);
  const openSteps = now ? now.subtasks.filter((s) => !s.isCompleted).length : 0;

  return (
    <div className="focus" role="dialog" aria-modal="true" aria-labelledby="focus-title" ref={panelRef}>
      <div className="focus__inner">
        <div className="focus__bar">
          <span className="focus__label">{now ? 'Now' : 'Focus'}</span>
          <button type="button" className="icon-btn" aria-label="Close focus" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        {now ? (
          <>
            <h2 id="focus-title" className="focus__title">
              {now.title}
            </h2>

            {now.subtasks.length > 0 && (
              <ul className="focus__steps">
                {now.subtasks.map((s) => (
                  <li key={s.id}>
                    <label className="focus__step">
                      <span className="subtask__check">
                        <input
                          type="checkbox"
                          checked={s.isCompleted}
                          onChange={() =>
                            s.isCompleted
                              ? subtaskHandlers.onUncompleteSubtask(now.id, s.id)
                              : subtaskHandlers.onCompleteSubtask(now.id, s.id)
                          }
                        />
                      </span>
                      <span className={s.isCompleted ? 'focus__step-done' : undefined}>
                        {s.title}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="focus__actions">
              <button
                type="button"
                className="focus__done"
                disabled={openSteps > 0}
                onClick={() => onComplete(now.id)}
              >
                Done
              </button>
              <button type="button" className="focus__later" onClick={() => onSetActive(now.id)}>
                Not now
              </button>
            </div>
            {openSteps > 0 && (
              <p className="focus__hint">
                Tick the {openSteps === 1 ? 'last step' : `${openSteps} open steps`} to finish.
              </p>
            )}
          </>
        ) : (
          <h2 id="focus-title" className="focus__title">
            What now?
          </h2>
        )}

        <section className="focus__next" aria-label={now ? 'Up next' : 'Today'}>
          {queue.length > 0 && <h3>{now ? 'Up next' : 'Pick one from Today'}</h3>}
          {queue.length > 0 ? (
            <ul>
              {queue.map((t) => (
                <li key={t.id}>
                  <button type="button" className="focus__pick" onClick={() => onSetActive(t.id)}>
                    <span>{t.title}</span>
                    <span className="focus__pick-cta">Make this now</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !now && (
              <p className="focus__empty">
                Today is clear. Add a task to Today, or bring one over from Master.
              </p>
            )
          )}
        </section>
      </div>
    </div>
  );
}
