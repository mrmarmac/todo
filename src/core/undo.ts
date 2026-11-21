import type { AppState } from './types';

/** A pending undo: the message shown, the state to restore, and the state the action produced. */
export interface PendingUndo {
  message: string;
  snapshot: AppState;
  after: AppState;
}

/**
 * The undo, if it is still safe to offer. Undo restores a full snapshot, so it
 * is only faithful while state is still exactly what the action produced — any
 * later change (a tick, an edit, a sync pull) retires it rather than letting
 * Undo silently revert that change too.
 */
export function liveUndo(pending: PendingUndo | null, current: AppState): PendingUndo | null {
  return pending !== null && pending.after === current ? pending : null;
}
