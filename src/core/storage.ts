import type { AppState } from './types';
import { initialState } from './state';

export const STORAGE_KEY = 'todo-pwa/state/v1';

export function save(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** True when the parsed value has the minimum shape of an AppState. */
export function isAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.tasks) &&
    Array.isArray(v.history) &&
    typeof v.currentDay === 'string'
  );
}

/**
 * Load app state from localStorage. Returns a fresh initial state when nothing
 * is stored, or when the stored data is missing/corrupt/wrong-shaped, so a bad
 * blob can never crash startup.
 */
export function load(now: Date = new Date()): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return initialState(now);
  try {
    const parsed = JSON.parse(raw);
    if (!isAppState(parsed)) return initialState(now);
    return parsed;
  } catch {
    return initialState(now);
  }
}
