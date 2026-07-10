import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** One row in an {@link ActionSheet}. */
export interface ActionSheetItem {
  label: string;
  onSelect: () => void;
  /** Style as a destructive action (Delete). */
  danger?: boolean;
  /** Disabled with an explanatory `hint` shown alongside the label. */
  disabled?: boolean;
  hint?: string;
}

interface Props {
  /** Optional heading (e.g. the subtask title) for screen readers. */
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

/** Ignore clicks this soon after the sheet mounts: a sheet opened by a
 *  long-press is still under the user's finger, and the synthetic click that
 *  follows the release would otherwise activate whatever item it lands on. */
const MOUNT_GUARD_MS = 300;

/**
 * Reusable bottom sheet used for the card's ⋯ menu and the subtask row's ⋯
 * menu (plan §Files). Backdrop tap and Escape both close it. Focus moves to
 * the first enabled item on open and is restored to the opener on close,
 * mirroring {@link ../ConfirmDialog}'s pattern. Selecting an (enabled) item
 * runs its action and closes the sheet in one tap.
 *
 * Rendered through a portal to <body>: the sheet is `position: fixed`, and a
 * card mid-gesture carries a `transform`, which would otherwise make the card
 * the sheet's containing block (and its `overflow: hidden` would clip it).
 */
export function ActionSheet({ title, items, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(performance.now());

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = sheetRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
    first?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const guarded = (fn: () => void) => () => {
    if (performance.now() - mountedAt.current < MOUNT_GUARD_MS) return;
    fn();
  };

  return createPortal(
    <div className="m-sheet__backdrop" onClick={guarded(onClose)} role="presentation">
      <div
        className="m-sheet"
        ref={sheetRef}
        role="menu"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={'m-sheet__item' + (item.danger ? ' m-sheet__item--danger' : '')}
            disabled={item.disabled}
            onClick={guarded(() => {
              item.onSelect();
              onClose();
            })}
          >
            <span>{item.label}</span>
            {item.hint && <span className="m-sheet__hint">{item.hint}</span>}
          </button>
        ))}
        <button type="button" className="m-sheet__item m-sheet__cancel" onClick={guarded(onClose)}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
