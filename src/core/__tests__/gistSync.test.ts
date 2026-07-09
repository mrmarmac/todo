import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SYNC_CONFIG_KEY,
  GIST_FILENAME,
  GIST_DESCRIPTION,
  loadSyncConfig,
  saveSyncConfig,
  clearSyncConfig,
  findSyncGist,
  createSyncGist,
  pullEnvelope,
  pushEnvelope,
  decideReconcile,
  SyncError,
  type SyncConfig,
  type SyncEnvelope,
} from '../gistSync';
import type { AppState } from '../types';

// Minimal in-memory localStorage for the node test environment (mirrors storage.test.ts).
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

const sampleState: AppState = {
  currentDay: '2026-07-04',
  history: [],
  tasks: [
    {
      id: 't1',
      title: 'A task',
      dueDate: '2026-07-10',
      column: 'today',
      isRecurring: false,
      isActive: true,
      sourceTaskId: null,
      subtasks: [{ id: 's1', title: 'A sub', isCompleted: false, isActive: false }],
    },
  ],
};

function envelope(overrides: Partial<SyncEnvelope> = {}): SyncEnvelope {
  return { schemaVersion: 1, modifiedAt: '2026-07-04T12:00:00.000Z', state: sampleState, ...overrides };
}

/** Build a Response-like object good enough for the code under test. */
function jsonResponse(
  body: unknown,
  { ok = true, status = 200, headers = {} as Record<string, string> } = {},
): Response {
  return {
    ok,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function textResponse(text: string, { ok = true, status = 200 } = {}): Response {
  return {
    ok,
    status,
    headers: { get: () => null },
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sync config persistence', () => {
  const config: SyncConfig = { token: 'ghp_abc', gistId: 'gist123', lastSyncedAt: null };

  it('round-trips save / load', () => {
    saveSyncConfig(config);
    expect(loadSyncConfig()).toEqual(config);
  });

  it('round-trips a non-null lastSyncedAt', () => {
    const c = { ...config, lastSyncedAt: '2026-07-04T12:00:00.000Z' };
    saveSyncConfig(c);
    expect(loadSyncConfig()).toEqual(c);
  });

  it('returns null when nothing is stored', () => {
    expect(loadSyncConfig()).toBeNull();
  });

  it('returns null on corrupt (non-JSON) config', () => {
    localStorage.setItem(SYNC_CONFIG_KEY, '{not valid json');
    expect(loadSyncConfig()).toBeNull();
  });

  it('returns null on wrong-shaped config', () => {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify({ token: 'x' }));
    expect(loadSyncConfig()).toBeNull();
  });

  it('clears the stored config', () => {
    saveSyncConfig(config);
    clearSyncConfig();
    expect(loadSyncConfig()).toBeNull();
  });
});

describe('findSyncGist', () => {
  it('finds the gist on page 1', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        { id: 'other', files: { 'notes.txt': {} } },
        { id: 'mine', files: { [GIST_FILENAME]: {} } },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await findSyncGist('tok')).toBe('mine');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/gists?per_page=100&page=1');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('finds the gist on page 2 after a full first page', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: `g${i}`, files: { 'x.txt': {} } }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(fullPage))
      .mockResolvedValueOnce(jsonResponse([{ id: 'mine', files: { [GIST_FILENAME]: {} } }]));
    vi.stubGlobal('fetch', fetchMock);

    expect(await findSyncGist('tok')).toBe('mine');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
  });

  it('returns null when no gist has the sync file', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([{ id: 'g1', files: { 'x.txt': {} } }]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await findSyncGist('tok')).toBeNull();
  });

  it('maps 401 to SyncError kind "auth"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 401 })));
    const err = await findSyncGist('tok').catch((e) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err).toMatchObject({ name: 'SyncError', kind: 'auth' });
  });
});

describe('createSyncGist', () => {
  it('POSTs a secret gist with the right body and returns the id', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: 'newid' }));
    vi.stubGlobal('fetch', fetchMock);

    const id = await createSyncGist('tok', envelope());
    expect(id).toBe('newid');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/gists');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.public).toBe(false);
    expect(body.description).toBe(GIST_DESCRIPTION);
    expect(Object.keys(body.files)).toEqual([GIST_FILENAME]);
    expect(JSON.parse(body.files[GIST_FILENAME].content)).toEqual(envelope());
  });
});

describe('pullEnvelope', () => {
  const cfg = { token: 'tok', gistId: 'gid' };

  it('returns the parsed envelope on the happy path', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ files: { [GIST_FILENAME]: { content: JSON.stringify(envelope()) } } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullEnvelope(cfg);
    expect(result).toEqual(envelope());
    expect(fetchMock.mock.calls[0][0]).toContain('/gists/gid');
  });

  it('fetches raw_url when the file is truncated', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          files: {
            [GIST_FILENAME]: { truncated: true, raw_url: 'https://raw/gist', content: '{"partial":true}' },
          },
        }),
      )
      .mockResolvedValueOnce(textResponse(JSON.stringify(envelope())));
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullEnvelope(cfg);
    expect(result).toEqual(envelope());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://raw/gist');
  });

  it('sanitises active flags in the pulled state', async () => {
    const bad: AppState = {
      ...sampleState,
      tasks: [
        { ...sampleState.tasks[0], id: 'a', column: 'today', isActive: true },
        { ...sampleState.tasks[0], id: 'b', column: 'today', isActive: true },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        files: { [GIST_FILENAME]: { content: JSON.stringify(envelope({ state: bad })) } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullEnvelope(cfg);
    expect(result.state.tasks.every((t) => !t.isActive)).toBe(true);
  });

  it('throws invalid-data when the sync file is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ files: { 'other.txt': {} } })));
    await expect(pullEnvelope(cfg)).rejects.toMatchObject({ kind: 'invalid-data' });
  });

  it('throws invalid-data on malformed JSON content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ files: { [GIST_FILENAME]: { content: '{not json' } } }),
      ),
    );
    await expect(pullEnvelope(cfg)).rejects.toMatchObject({ kind: 'invalid-data' });
  });

  it('throws invalid-data when the state fails isAppState', async () => {
    const badEnvelope = { schemaVersion: 1, modifiedAt: '2026-07-04T12:00:00.000Z', state: { tasks: 'nope' } };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ files: { [GIST_FILENAME]: { content: JSON.stringify(badEnvelope) } } }),
      ),
    );
    await expect(pullEnvelope(cfg)).rejects.toMatchObject({ kind: 'invalid-data' });
  });

  it('maps 404 to not-found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 })));
    await expect(pullEnvelope(cfg)).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('maps a fetch rejection to network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    await expect(pullEnvelope(cfg)).rejects.toMatchObject({ kind: 'network' });
  });

  it('maps 403 with exhausted rate limit to rate-limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({}, { ok: false, status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
      ),
    );
    await expect(pullEnvelope(cfg)).rejects.toMatchObject({ kind: 'rate-limit' });
  });
});

describe('pushEnvelope', () => {
  it('PATCHes the gist file with the envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: 'gid' }));
    vi.stubGlobal('fetch', fetchMock);

    await pushEnvelope({ token: 'tok', gistId: 'gid' }, envelope());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/gists/gid');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body);
    expect(Object.keys(body.files)).toEqual([GIST_FILENAME]);
    expect(JSON.parse(body.files[GIST_FILENAME].content)).toEqual(envelope());
  });
});

describe('decideReconcile', () => {
  const synced = '2026-07-04T12:00:00.000Z';
  const newer = '2026-07-05T09:00:00.000Z';

  it('pushes when remote unchanged and local changed', () => {
    expect(decideReconcile(synced, synced, true)).toBe('push');
  });

  it('applies remote when remote newer and local unchanged', () => {
    expect(decideReconcile(newer, synced, false)).toBe('apply-remote');
  });

  it('reports a conflict when remote newer and local changed', () => {
    expect(decideReconcile(newer, synced, true)).toBe('conflict');
  });

  it('is a noop when neither side changed', () => {
    expect(decideReconcile(synced, synced, false)).toBe('noop');
  });

  it('treats lastSyncedAt === null as remote-newer (first pull, local unchanged)', () => {
    expect(decideReconcile(newer, null, false)).toBe('apply-remote');
  });

  it('treats lastSyncedAt === null with local changes as a conflict', () => {
    expect(decideReconcile(newer, null, true)).toBe('conflict');
  });
});
