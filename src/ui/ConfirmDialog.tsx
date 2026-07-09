import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

/** Options describing one confirm/alert prompt (see {@link useConfirm}). */
export interface ConfirmOptions {
  /** Heading shown at the top of the dialog. */
  title: string;
  /** Explanatory text; blank lines (`\n\n`) become separate paragraphs. */
  body: string;
  /** Label for the affirmative button. */
  confirmLabel: string;
  /** Label for the dismissive button; omit for an alert-style, single-button dialog. */
  cancelLabel?: string;
  /** Style the confirm button as destructive and focus Cancel by default. */
  danger?: boolean;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app replacement for the browser's native confirm / alert, styled like
 * {@link ./ShortcutHelp} so native system dialogs never appear inside the
 * standalone PWA. Escape and a backdrop click both cancel. Focus moves to the
 * confirm button on open (or Cancel when `danger`, the safer default for a
 * destructive action) and is restored to the previously focused element on
 * close. Prefer the {@link useConfirm} hook over rendering this directly.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safest button on open; restore prior focus on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const initial = danger && cancelRef.current ? cancelRef.current : confirmRef.current;
    initial?.focus();
    return () => previouslyFocused?.focus?.();
  }, [danger]);

  // Close on Escape regardless of where focus sits.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const paragraphs = body.split('\n\n');

  return (
    <div
      className="confirm-dialog__backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-dialog__title">{title}</h2>
        <div className="confirm-dialog__body">
          {paragraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <div className="confirm-dialog__actions">
          {cancelLabel !== undefined && (
            <button type="button" ref={cancelRef} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            ref={confirmRef}
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** Return value of {@link useConfirm}. */
export interface UseConfirmResult {
  /** Open a dialog and resolve `true`/`false` when the user chooses. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** The dialog element to render (or `null` when nothing is open). */
  dialog: ReactElement | null;
}

/**
 * Promise-based replacement for the native confirm. `confirm(opts)` opens the dialog
 * and resolves `true` on confirm or `false` on cancel/escape/backdrop. Only one
 * dialog shows at a time; a `confirm` call made while another is open resolves
 * `false` immediately rather than queueing. Render `dialog` once, high in the
 * tree, and pass `confirm` to whoever needs to prompt.
 */
export function useConfirm(): UseConfirmResult {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Mirrors "a dialog is open" synchronously so `confirm` can stay stable and
  // reject overlapping calls without depending on render state.
  const openRef = useRef(false);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    if (openRef.current) return Promise.resolve(false);
    openRef.current = true;
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    if (!pending) return;
    openRef.current = false;
    const { resolve } = pending;
    setPending(null);
    resolve(value);
  };

  const dialog = pending ? (
    <ConfirmDialog
      title={pending.title}
      body={pending.body}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      danger={pending.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, dialog };
}
