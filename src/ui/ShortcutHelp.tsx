import { useEffect } from 'react';
import { Icon } from './Icon';

interface Props {
  onClose: () => void;
}

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Global',
    rows: [
      ['n', 'Focus the “New task” field'],
      ['m', 'Collapse / expand the Master column'],
      ['?', 'Toggle this cheatsheet'],
      ['Esc', 'Close / cancel'],
    ],
  },
  {
    title: 'On a focused card (Tab or ↑ ↓ to move between cards)',
    rows: [
      ['↑ / ↓', 'Move focus to previous / next card'],
      ['s', 'Add a subtask'],
      ['e', 'Edit'],
      ['Del', 'Delete'],
    ],
  },
  {
    title: 'Master card',
    rows: [['Enter / →', 'Move to Today']],
  },
  {
    title: 'Today card',
    rows: [
      ['Space', 'Toggle active'],
      ['c', 'Complete'],
      ['r', 'Remove from Today'],
    ],
  },
  {
    title: 'Done card',
    rows: [['u', 'Undo (back to Today)']],
  },
];

/** Modal cheatsheet listing every keyboard shortcut (plan §2). */
export function ShortcutHelp({ onClose }: Props) {
  // Close on Escape regardless of where focus sits.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="shortcut-help__backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="shortcut-help" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-help__head">
          <h2>Keyboard shortcuts</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title} className="shortcut-help__group">
            <h3>{group.title}</h3>
            {group.rows.map(([keys, label]) => (
              <div key={label} className="shortcut-help__row">
                <span>{label}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
