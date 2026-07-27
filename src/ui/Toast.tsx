interface Props {
  message: string;
  onUndo: () => void;
}

/**
 * The bottom-centre undo bar shown briefly after a destructive action (delete,
 * Clear, Start New Day). Those reducers have no inverse, so undo restores a
 * full pre-action snapshot the caller captured; this component is just the
 * surface. App auto-dismisses it after a few seconds.
 */
export function Toast({ message, onUndo }: Props) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__message">{message}</span>
      <button type="button" className="toast__undo" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
