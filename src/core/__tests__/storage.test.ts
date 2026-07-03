import { describe, it, expect, beforeEach, vi } from 'vitest';
import { save, load, STORAGE_KEY } from '../storage';
import { initialState, createTask } from '../state';

// Minimal in-memory localStorage for the node test environment.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

describe('save / load', () => {
  it('round-trips app state', () => {
    const s = createTask(initialState(new Date('2026-07-03T00:00:00Z')), { title: 'Persist me' });
    save(s);
    expect(load()).toEqual(s);
  });

  it('returns a fresh initial state when nothing is stored', () => {
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
    expect(s.history).toEqual([]);
    expect(s.currentDay).toBe('2026-07-03');
  });

  it('returns a fresh initial state when stored data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
    expect(s.currentDay).toBe('2026-07-03');
  });

  it('returns a fresh initial state when stored JSON is the wrong shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    const s = load(new Date('2026-07-03T00:00:00Z'));
    expect(s.tasks).toEqual([]);
  });
});
