import { useState } from 'react';
import type { Subtask, Task } from '../../core/types';
import { Icon } from '../Icon';
import { UrlPill } from '../TaskTitle';
import { parseUrl } from '../../core/urls';
import { SubtaskEditForm, type SubtaskHandlers } from '../SubtaskList';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';
import { useLongPress } from './useLongPress';

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
 * for the rarer per-subtask actions (Edit / Set active / Delete), and a
 * long-press on the row opens the same sheet (plan §4 — the ⋯ stays as the
 * discoverable path).
 */
export function MobileSubtasks({ task, interactive, readOnly = false, ...h }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (task.subtasks.length === 0) return null;

  return (
    <ul className="m-subtask-list">
      {task.subtasks.map((s) =>
        editingId === s.id ? (
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
        ) : (
          <SubtaskRow
            key={s.id}
            task={task}
            subtask={s}
            interactive={interactive}
            readOnly={readOnly}
            handlers={h}
            onEdit={() => setEditingId(s.id)}
          />
        ),
      )}
    </ul>
  );
}

interface RowProps {
  task: Task;
  subtask: Subtask;
  interactive: boolean;
  readOnly: boolean;
  handlers: SubtaskHandlers;
  onEdit: () => void;
}

function SubtaskRow({ task, subtask: s, interactive, readOnly, handlers: h, onEdit }: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const canTick = interactive && !readOnly;
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
    { label: 'Edit', onSelect: onEdit },
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

  // Long-press opens the same sheet as the ⋯ button. Disabled on read-only
  // (Done) rows, which have no sheet.
  const longPress = useLongPress({ onLongPress: () => setMenuOpen(true), disabled: readOnly });

  return (
    <li className={rowClass}>
      <div
        className="m-subtask__row"
        role={canTick ? 'button' : undefined}
        tabIndex={canTick ? 0 : undefined}
        aria-pressed={canTick ? s.isCompleted : undefined}
        // stopPropagation so a subtask long-press/tap never reaches the card's
        // swipe or reorder machinery (plan §4).
        onPointerDown={(e) => {
          e.stopPropagation();
          longPress.handlers.onPointerDown(e);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          longPress.handlers.onPointerMove(e);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          longPress.handlers.onPointerUp(e);
        }}
        onPointerCancel={(e) => {
          e.stopPropagation();
          longPress.handlers.onPointerCancel(e);
        }}
        onContextMenu={longPress.handlers.onContextMenu}
        onClickCapture={longPress.onClickCapture}
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
        {/* Master rows get no check affordance at all (D18: ticking is a Today
            activity) — showing even an empty/disabled circle would still read
            as tappable. Today shows a live toggle; Done shows a filled
            read-only check (every Done subtask is completed, by the
            completeTask guard). */}
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
          onClick={() => setMenuOpen(true)}
        >
          <Icon name="dots" />
        </button>
      )}
      {menuOpen && (
        <ActionSheet title={s.title} items={sheetItems} onClose={() => setMenuOpen(false)} />
      )}
    </li>
  );
}
