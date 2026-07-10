/**
 * Undo toast (plan §4). A single fixed bar above the QuickAdd FAB carrying a
 * short message and an optional action (almost always "Undo"). The host
 * ({@link ./MobileBoard}) owns the state, the 5s auto-dismiss, and the
 * replace-old-with-new behaviour; this component is purely presentational.
 * `role="status"` announces the message without stealing focus.
 */
export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function Toast({ message, actionLabel, onAction }: Props) {
  return (
    <div className="m-toast" role="status">
      <span className="m-toast__msg">{message}</span>
      {actionLabel && onAction && (
        <button type="button" className="m-toast__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
