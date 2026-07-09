import type { AppState } from './types';
import { isAppState, sanitizeActiveFlags } from './storage';

/**
 * GitHub Gist sync (SPEC: cross-device sync).
 *
 * The whole {@link AppState} is stored as a single JSON envelope inside one
 * private ("secret") gist file. Sync is last-write-wins with conflict
 * detection: {@link decideReconcile} compares the remote envelope's timestamp
 * against the last one this device synced and reports when both sides changed
 * so the caller can prompt the user.
 *
 * This module is deliberately free of React and of side effects other than the
 * localStorage config helpers ({@link saveSyncConfig} / {@link clearSyncConfig}).
 * All network functions talk to the GitHub REST API via plain `fetch` and map
 * every failure onto a {@link SyncError} with a UI-presentable message.
 */

/** localStorage key holding the {@link SyncConfig} (token + gist id + cursor). */
export const SYNC_CONFIG_KEY = 'todo-pwa/sync/v1';
/** Name of the single file inside the sync gist. */
export const GIST_FILENAME = 'todo-pwa-sync.json';
/** Human-readable description set on the gist so the user can recognise it. */
export const GIST_DESCRIPTION = 'todo-pwa sync data (managed by the app)';

/** Bumped only when the sync envelope shape changes incompatibly. */
const SYNC_SCHEMA_VERSION = 1;

const GITHUB_API = 'https://api.github.com';
const GITHUB_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

/**
 * Persisted sync state for this device. The token is a fine-grained/classic PAT
 * with only the `gist` scope; it never leaves localStorage except as an
 * `Authorization` header to api.github.com.
 */
export interface SyncConfig {
  token: string;
  gistId: string;
  /** modifiedAt of the last envelope we successfully pushed or applied; null before first sync */
  lastSyncedAt: string | null;
}

/** Envelope stored in the gist file. */
export interface SyncEnvelope {
  schemaVersion: 1;
  /** ISO timestamp of when this envelope's state was produced (authoritative for LWW). */
  modifiedAt: string;
  state: AppState;
}

export type SyncErrorKind = 'auth' | 'not-found' | 'network' | 'invalid-data' | 'rate-limit';

/**
 * Error thrown by every network/parse operation in this module. `kind`
 * classifies the failure so the UI can react (re-prompt for a token, offer
 * retry, show a conflict, ...); `message` is safe to show to the user.
 */
export class SyncError extends Error {
  readonly kind: SyncErrorKind;
  /** The lower-level error that triggered this one, when any (for debugging). */
  readonly cause?: unknown;

  constructor(kind: SyncErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
    this.cause = cause;
    // Restore prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, SyncError.prototype);
  }
}

// --- Config persistence -----------------------------------------------------

/** True when the value has the exact shape of a {@link SyncConfig}. */
function isSyncConfig(value: unknown): value is SyncConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.token === 'string' &&
    typeof v.gistId === 'string' &&
    (typeof v.lastSyncedAt === 'string' || v.lastSyncedAt === null)
  );
}

/** Load the saved sync config, or null when absent / corrupt / wrong-shaped. */
export function loadSyncConfig(): SyncConfig | null {
  const raw = localStorage.getItem(SYNC_CONFIG_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return isSyncConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist the sync config to localStorage. */
export function saveSyncConfig(config: SyncConfig): void {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

/** Remove any saved sync config (e.g. on disconnect). */
export function clearSyncConfig(): void {
  localStorage.removeItem(SYNC_CONFIG_KEY);
}

// --- HTTP helpers -----------------------------------------------------------

/** Minimal shape of a gist file entry as returned by the GitHub API. */
interface GistFile {
  truncated?: boolean;
  content?: string;
  raw_url?: string;
}

/** Minimal shape of a gist as returned by the GitHub API. */
interface Gist {
  id: string;
  files?: Record<string, GistFile | null>;
}

/**
 * Map a non-ok GitHub response onto a {@link SyncError}. 401 and 403 with valid
 * rate limit are auth failures; 403/429 with the rate limit exhausted are
 * 'rate-limit'; 404 is 'not-found'; anything else is treated as a transient
 * network-class error.
 */
function errorFromResponse(res: Response): SyncError {
  const rateLimited =
    res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');
  if (rateLimited) {
    return new SyncError(
      'rate-limit',
      'GitHub rate limit reached. Please wait a little while and try again.',
    );
  }
  if (res.status === 401 || res.status === 403) {
    return new SyncError(
      'auth',
      'GitHub rejected the token. Check that the token is valid and has the "gist" scope.',
    );
  }
  if (res.status === 404) {
    return new SyncError('not-found', 'The sync gist could not be found on GitHub.');
  }
  return new SyncError(
    'network',
    `GitHub returned an unexpected error (HTTP ${res.status}). Please try again.`,
  );
}

/**
 * Perform an authenticated GitHub API request. Rejected fetches (offline, DNS,
 * CORS, ...) become SyncError('network'); non-ok responses are mapped by
 * {@link errorFromResponse}. Returns the raw Response on success.
 */
async function githubFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${GITHUB_API}${path}`, {
      ...init,
      headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch (cause) {
    throw new SyncError('network', 'Could not reach GitHub. Check your connection and try again.', cause);
  }
  if (!res.ok) throw errorFromResponse(res);
  return res;
}

/** Parse a Response body as JSON, mapping failures onto the given SyncError kind. */
async function readJson<T>(res: Response, kind: SyncErrorKind, message: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch (cause) {
    throw new SyncError(kind, message, cause);
  }
}

// --- Envelope validation ----------------------------------------------------

/**
 * Parse and validate a gist file's text into a {@link SyncEnvelope}. The
 * contained state is validated with {@link isAppState} and passed through
 * {@link sanitizeActiveFlags}; everything else is left untouched. Throws
 * SyncError('invalid-data') on any malformed input.
 */
function parseEnvelope(text: string): SyncEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new SyncError('invalid-data', 'The synced data is not valid JSON.', cause);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new SyncError('invalid-data', 'The synced data is not in the expected format.');
  }

  const env = parsed as Record<string, unknown>;
  if (env.schemaVersion !== SYNC_SCHEMA_VERSION) {
    throw new SyncError('invalid-data', 'The synced data uses an unsupported version.');
  }
  if (typeof env.modifiedAt !== 'string') {
    throw new SyncError('invalid-data', 'The synced data is missing its timestamp.');
  }
  if (!isAppState(env.state)) {
    throw new SyncError('invalid-data', 'The synced data does not contain valid app state.');
  }

  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    modifiedAt: env.modifiedAt,
    state: sanitizeActiveFlags(env.state),
  };
}

// --- Network operations -----------------------------------------------------

/**
 * List the token's gists and return the id of the first one containing
 * {@link GIST_FILENAME}, else null. Paginates up to a few pages of 100.
 */
export async function findSyncGist(token: string): Promise<string | null> {
  const MAX_PAGES = 5;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await githubFetch(token, `/gists?per_page=100&page=${page}`);
    const gists = await readJson<Gist[]>(res, 'invalid-data', 'GitHub returned an unexpected gist list.');
    if (!Array.isArray(gists) || gists.length === 0) return null;
    for (const gist of gists) {
      if (gist.files && Object.prototype.hasOwnProperty.call(gist.files, GIST_FILENAME)) {
        return gist.id;
      }
    }
    if (gists.length < 100) return null; // last (partial) page reached
  }
  return null;
}

/** Create a new secret gist containing the envelope; returns the new gist id. */
export async function createSyncGist(token: string, envelope: SyncEnvelope): Promise<string> {
  const body = {
    description: GIST_DESCRIPTION,
    public: false,
    files: { [GIST_FILENAME]: { content: JSON.stringify(envelope) } },
  };
  const res = await githubFetch(token, '/gists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const gist = await readJson<Gist>(res, 'invalid-data', 'GitHub returned an unexpected response creating the gist.');
  if (typeof gist.id !== 'string') {
    throw new SyncError('invalid-data', 'GitHub did not return an id for the new gist.');
  }
  return gist.id;
}

/**
 * GET the gist and parse/validate its {@link SyncEnvelope}. Handles GitHub's
 * truncated-file case by fetching `raw_url`. Throws SyncError('invalid-data')
 * when the file is missing or malformed.
 */
export async function pullEnvelope(
  config: Pick<SyncConfig, 'token' | 'gistId'>,
): Promise<SyncEnvelope> {
  const res = await githubFetch(config.token, `/gists/${config.gistId}`);
  const gist = await readJson<Gist>(res, 'invalid-data', 'GitHub returned an unexpected gist response.');

  const file = gist.files?.[GIST_FILENAME];
  if (!file) {
    throw new SyncError('invalid-data', 'The sync gist does not contain the expected file.');
  }

  let text: string;
  if (file.truncated && typeof file.raw_url === 'string') {
    let rawRes: Response;
    try {
      rawRes = await fetch(file.raw_url);
    } catch (cause) {
      throw new SyncError('network', 'Could not download the full synced data from GitHub.', cause);
    }
    if (!rawRes.ok) throw errorFromResponse(rawRes);
    try {
      text = await rawRes.text();
    } catch (cause) {
      throw new SyncError('invalid-data', 'The synced data could not be read.', cause);
    }
  } else if (typeof file.content === 'string') {
    text = file.content;
  } else {
    throw new SyncError('invalid-data', 'The sync gist file has no readable content.');
  }

  return parseEnvelope(text);
}

/** PATCH the gist file with a new envelope, overwriting its content. */
export async function pushEnvelope(
  config: Pick<SyncConfig, 'token' | 'gistId'>,
  envelope: SyncEnvelope,
): Promise<void> {
  const body = { files: { [GIST_FILENAME]: { content: JSON.stringify(envelope) } } };
  await githubFetch(config.token, `/gists/${config.gistId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Pure reconcile decision ------------------------------------------------

export type ReconcileDecision = 'push' | 'apply-remote' | 'conflict' | 'noop';

/**
 * Decide what to do given the remote envelope's `modifiedAt`, this device's
 * `lastSyncedAt`, and whether local state changed since the last sync. Pure —
 * performs no I/O.
 *
 * "remote unchanged" means `remoteModifiedAt === lastSyncedAt`. A null
 * `lastSyncedAt` means this device has never synced, so the remote is treated
 * as newer (first pull on a device):
 *
 *   remote unchanged + local changed   -> 'push'
 *   remote newer     + local unchanged -> 'apply-remote'
 *   remote newer     + local changed   -> 'conflict'
 *   neither changed                    -> 'noop'
 */
export function decideReconcile(
  remoteModifiedAt: string,
  lastSyncedAt: string | null,
  localChangedSinceSync: boolean,
): ReconcileDecision {
  const remoteChanged = lastSyncedAt === null || remoteModifiedAt !== lastSyncedAt;

  if (remoteChanged && localChangedSinceSync) return 'conflict';
  if (remoteChanged) return 'apply-remote';
  if (localChangedSinceSync) return 'push';
  return 'noop';
}
