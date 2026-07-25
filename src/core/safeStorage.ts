/**
 * localStorage access that can never crash the app (D41).
 *
 * `localStorage` throws in more situations than it looks: `QuotaExceededError`
 * when the origin's budget is full, and a plain `SecurityError` on every access
 * when the browser is configured to block site data. An unguarded write runs
 * inside a React effect, so a throw there propagates through the commit phase
 * and — with no error boundary above it — unmounts the whole tree. Every access
 * in the app goes through these helpers instead, which swallow the failure,
 * report it once to a subscriber, and let the caller degrade.
 *
 * Failures are reported rather than silently ignored so the UI can tell the
 * user their changes are not being saved — a todo list that quietly forgets is
 * worse than one that says so.
 */

/** Which localStorage operation failed. */
export type StorageOp = 'read' | 'write' | 'remove';

/** A single failed localStorage access. */
export interface StorageFailure {
  op: StorageOp;
  key: string;
  error: unknown;
}

let listener: ((failure: StorageFailure) => void) | null = null;

/**
 * Subscribe to storage failures. Only one subscriber is supported (the app has
 * a single root); returns an unsubscribe function.
 */
export function onStorageFailure(fn: (failure: StorageFailure) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

function report(op: StorageOp, key: string, error: unknown): void {
  if (listener === null) return;
  // A throwing subscriber must not turn a handled failure back into a crash.
  try {
    listener({ op, key, error });
  } catch {
    /* ignore */
  }
}

/** Read a key, or null when absent *or* unreadable. */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    report('read', key, error);
    return null;
  }
}

/** Write a key. Returns false when the write failed. */
export function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    report('write', key, error);
    return false;
  }
}

/** Remove a key. Returns false when the removal failed. */
export function removeLocal(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    report('remove', key, error);
    return false;
  }
}
