import { useState } from 'react';
import type { Task } from '../../core/types';
import { Icon } from '../Icon';
import { UrlPill } from '../TaskTitle';
import { parseUrl } from '../../core/urls';
import { SubtaskEditForm, type SubtaskHandlers } from '../SubtaskList';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';

interface Props extends SubtaskHandlers {
  task: Task;
  /** Today-only: rows are tappable to toggle completion and get a ⋯ menu.
   *  Ticking is a Today activity (D18) — Master rows render inert, with no
   *  check affordance, since core no-ops the tick everywhere else anyway. */
  interactive: boolean;
  /** Done column: read-only, struck-through, no ⋯. */
  readOnly?: boolean;
}

/**
 * Big tap-to-toggle subtask rows for the expanded mobile card (plan §Files).
 * Each row is ≥44px; a small trailing ⋯ opens the shared {@link ActionSheet}
 * for the rarer per-subtask actions (Edit / Set active / Delete) instead of
 * the old always-visible pencil+× pair.
 */
export function MobileSubtasks({ task, interactive, readOnly = false, ...h }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  if (task.subtasks.length === 0) return null;

  const canTick = interactive && !readOnly;

  return (
    <ul className="m-subtask-list">
      {task.subtasks.map((s) => {
        if (editingId === s.id) {
          return (
            <li key={s.id} className="m-subtask m-subtask--editing">
              <SubtaskEditForm
                subtask={s}
                onSave={(patch) => {
                  h.onUpdateSubtask(task.id, s.id, patch);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          );
        }

        const url = parseUrl(s.title);
        const rowClass =
          'm-subtask' +
          (s.isCompleted ? ' m-subtask--done' : '') +
          (s.isActive ? ' m-subtask--active' : '');

        function toggle() {
          if (s.isCompleted) h.onUncompleteSubtask(task.id, s.id);
          else h.onCompleteSubtask(task.id, s.id);
        }

        const sheetItems: ActionSheetItem[] = [
          { label: 'Edit', onSelect: () => setEditingId(s.id) },
          ...(interactive && !s.isCompleted
            ? [
                {
                  label: s.isActive ? 'Clear active' : 'Set as active',
                  onSelect: () => h.onSetActiveSubtask(task.id, s.id),
                },
              ]
            : []),
          { label: 'Delete', danger: true, onSelect: () => h.onDeleteSubtask(task.id, s.id) },
        ];

        return (
          <li key={s.id} className={rowClass}>
            <div
              className="m-subtask__row"
              role={canTick ? 'button' : undefined}
              tabIndex={canTick ? 0 : undefined}
              aria-pressed={canTick ? s.isCompleted : undefined}
              onClick={() => {
                if (canTick) toggle();
              }}
              onKeyDown={(e) => {
                if (!canTick) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle();
                }
              }}
            >
              {/* Master rows get no check affordance at all (D18: ticking is a
                  Today activity) — showing even an empty/disabled circle
                  would still read as tappable. Today shows a live toggle;
                  Done shows a filled read-only check (every Done subtask is
                  completed, by the completeTask guard). */}
              {(interactive || readOnly) && (
                <span className="m-subtask__check" aria-hidden="true">
                  {s.isCompleted && <Icon name="check" />}
                </span>
              )}
              {url ? (
                <UrlPill title={s.title} active={s.isActive} />
              ) : (
                <span className="m-subtask__title">{s.title}</span>
              )}
            </div>
            {!readOnly && (
              <button
                type="button"
                className="m-subtask__more"
                aria-label={`More actions for ${s.title}`}
                onClick={() => setMenuFor(s.id)}
              >
                <Icon name="dots" />
              </button>
            )}
            {menuFor === s.id && (
              <ActionSheet title={s.title} items={sheetItems} onClose={() => setMenuFor(null)} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
