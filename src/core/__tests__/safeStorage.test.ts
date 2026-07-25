import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onStorageFailure, readLocal, removeLocal, writeLocal } from '../safeStorage';
import { STORAGE_KEY, load, save } from '../storage';
import { initialState } from '../state';

/** Minimal in-memory localStorage, with per-operation failure injection. */
function installStorage(fail: { get?: boolean; set?: boolean; remove?: boolean } = {}) {
  const data = new Map<string, string>();
  const stub = {
    getItem(key: string) {
      if (fail.get) throw new DOMException('blocked', 'SecurityError');
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (fail.set) throw new DOMException('full', 'QuotaExceededError');
      data.set(key, value);
    },
    removeItem(key: string) {
      if (fail.remove) throw new DOMException('blocked', 'SecurityError');
      data.delete(key);
    },
  };
  vi.stubGlobal('localStorage', stub);
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeStorage (D41)', () => {
  beforeEach(() => {
    installStorage();
  });

  it('round-trips a value', () => {
    expect(writeLocal('k', 'v')).toBe(true);
    expect(readLocal('k')).toBe('v');
    expect(removeLocal('k')).toBe(true);
    expect(readLocal('k')).toBeNull();
  });

  it('returns null for a missing key', () => {
    expect(readLocal('absent')).toBeNull();
  });

  it('swallows a read failure and reports it', () => {
    installStorage({ get: true });
    const seen: string[] = [];
    const off = onStorageFailure((f) => seen.push(`${f.op}:${f.key}`));

    expect(readLocal('k')).toBeNull();
    expect(seen).toEqual(['read:k']);
    off();
  });

  it('swallows a write failure and reports it', () => {
    installStorage({ set: true });
    const seen: string[] = [];
    const off = onStorageFailure((f) => seen.push(`${f.op}:${f.key}`));

    expect(writeLocal('k', 'v')).toBe(false);
    expect(seen).toEqual(['write:k']);
    off();
  });

  it('swallows a remove failure and reports it', () => {
    installStorage({ remove: true });
    const seen: string[] = [];
    const off = onStorageFailure((f) => seen.push(`${f.op}:${f.key}`));

    expect(removeLocal('k')).toBe(false);
    expect(seen).toEqual(['remove:k']);
    off();
  });

  it('stops reporting after unsubscribe', () => {
    installStorage({ set: true });
    const seen: string[] = [];
    onStorageFailure((f) => seen.push(f.op))();

    writeLocal('k', 'v');
    expect(seen).toEqual([]);
  });

  it('does not let a throwing subscriber escape', () => {
    installStorage({ set: true });
    const off = onStorageFailure(() => {
      throw new Error('subscriber blew up');
    });

    expect(() => writeLocal('k', 'v')).not.toThrow();
    expect(writeLocal('k', 'v')).toBe(false);
    off();
  });
});

describe('storage survives a hostile localStorage (D41)', () => {
  it('save reports failure instead of throwing on a full quota', () => {
    installStorage({ set: true });
    expect(() => save(initialState(new Date()))).not.toThrow();
    expect(save(initialState(new Date()))).toBe(false);
  });

  it('save returns true on success and persists', () => {
    const data = installStorage();
    expect(save(initialState(new Date('2026-07-25')))).toBe(true);
    expect(data.get(STORAGE_KEY)).toContain('2026-07-25');
  });

  it('load falls back to a fresh state when reads throw', () => {
    installStorage({ get: true });
    const state = load(new Date('2026-07-25'));
    expect(state).toEqual({ tasks: [], history: [], currentDay: '2026-07-25' });
  });
});
