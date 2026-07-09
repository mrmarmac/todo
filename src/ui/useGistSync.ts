import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../core/types';
import {
  loadSyncConfig,
  saveSyncConfig,
  clearSyncConfig,
  findSyncGist,
  createSyncGist,
  pullEnvelope,
  pushEnvelope,
  decideReconcile,
  SyncError,
} from '../core/gistSync';
import type { SyncConfig, SyncEnvelope, ReconcileDecision } from '../core/gistSync';
import type { ConfirmOptions } from './ConfirmDialog';

/**
 * React hook owning all Gist-sync orchestration (SPEC: cross-device sync).
 *
 * Wraps the pure {@link ../core/gistSync} module with:
 *  - reconcile-on-load / reconcile-on-connect / reconcile-on-focus,
 *  - a debounced "push on local change" path that re-checks the remote before
 *    overwriting it (so an offline device can't clobber newer remote data),
 *  - a localStorage-persisted dirty flag so conflict detection survives a
 *    page close mid-debounce,
 *  - the connect/disconnect/syncNow actions used by {@link ./SyncSettings}.
 */

/** Sync status surfaced to the UI. */
export type SyncStatus = 'disconnected' | 'syncing' | 'synced' | 'offline' | 'error';

/** localStorage flag: `'1'` present means local state changed since the last successful sync/apply. */
const DIRTY_KEY = 'todo-pwa/sync/dirty/v1';
/** Debounce window after the last local edit before attempting a push. */
const PUSH_DEBOUNCE_MS = 2500;
/** Minimum time between focus/visibility-triggered reconciles. */
const FOCUS_THROTTLE_MS = 30_000;

function isDirty(): boolean {
  return localStorage.getItem(DIRTY_KEY) === '1';
}
function markDirty(): void {
  localStorage.setItem(DIRTY_KEY, '1');
}
function clearDirty(): void {
  localStorage.removeItem(DIRTY_KEY);
}

function buildEnvelope(state: AppState, modifiedAt: string): SyncEnvelope {
  return { schemaVersion: 1, modifiedAt, state };
}

const CONFLICT_MESSAGE =
  'This to-do list changed on both this device and another device since the last sync.\n\n' +
  'Using the other device’s data discards this device’s recent changes. ' +
  'Keeping this device’s data overwrites the other device’s recent changes.';

const CONNECT_EXISTING_DATA_MESSAGE =
  'This GitHub account already has synced to-do data, and this device also has local data.\n\n' +
  'Using the synced data discards this device’s local data. ' +
  'Keeping this device’s data overwrites the synced data on GitHub.';

const GIST_NOT_FOUND_MESSAGE =
  'The sync gist could not be found on GitHub (it may have been deleted). Please reconnect to sync again.';

/** Human-readable label for a {@link SyncStatus}, shared by the header dot and the settings dialog. */
export function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'disconnected':
      return 'Disconnected';
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return 'Synced';
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Error';
  }
}

export interface UseGistSyncResult {
  status: SyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  connected: boolean;
  /** The connected gist's id, or null when disconnected (for building a gist.github.com link). */
  gistId: string | null;
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
}

export function useGistSync(
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  /**
   * Opens an in-app confirm dialog and resolves the user's choice — supplied by
   * {@link ../ui/App} from {@link ./ConfirmDialog.useConfirm} so sync prompts
   * never fall back to a native browser confirm.
   */
  confirmDialog: (opts: ConfirmOptions) => Promise<boolean>,
): UseGistSyncResult {
  const [config, setConfig] = useState<SyncConfig | null>(() => loadSyncConfig());
  const [status, setStatus] = useState<SyncStatus>(() => (loadSyncConfig() ? 'syncing' : 'disconnected'));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs mirror the latest config/state for use inside stable callbacks and
  // timer callbacks without forcing those callbacks to be re-created.
  const configRef = useRef(config);
  configRef.current = config;
  const stateRef = useRef(state);
  stateRef.current = state;

  const inFlightRef = useRef(false);
  const lastFocusReconcileRef = useRef(0);
  const isFirstStateEffect = useRef(true);
  // Set right before a reconcile applies remote state via setState(), so the
  // push-on-change effect that fires from that same state update doesn't
  // mistake "we just applied remote" for "the user edited something".
  const suppressNextDirtyRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);

  /** Map a caught error onto status + errorMessage; clears config on a deleted gist. */
  const handleSyncError = useCallback((err: unknown) => {
    if (err instanceof SyncError) {
      if (err.kind === 'not-found') {
        clearSyncConfig();
        clearDirty();
        setConfig(null);
        setStatus('error');
        setErrorMessage(GIST_NOT_FOUND_MESSAGE);
        return;
      }
      setErrorMessage(err.message);
      setStatus(err.kind === 'network' ? 'offline' : 'error');
      return;
    }
    setErrorMessage(err instanceof Error ? err.message : 'Sync failed.');
    setStatus('error');
  }, []);

  /** Replace local state with the remote envelope; advances lastSyncedAt and clears dirty. */
  const applyRemote = useCallback(
    (cfg: SyncConfig, remote: SyncEnvelope) => {
      suppressNextDirtyRef.current = true;
      setState(remote.state);
      const nextCfg: SyncConfig = { ...cfg, lastSyncedAt: remote.modifiedAt };
      saveSyncConfig(nextCfg);
      setConfig(nextCfg);
      clearDirty();
    },
    [setState],
  );

  /** Push the current local state as a fresh envelope; advances lastSyncedAt and clears dirty. */
  const pushLocal = useCallback(async (cfg: SyncConfig) => {
    const modifiedAt = new Date().toISOString();
    await pushEnvelope(cfg, buildEnvelope(stateRef.current, modifiedAt));
    const nextCfg: SyncConfig = { ...cfg, lastSyncedAt: modifiedAt };
    saveSyncConfig(nextCfg);
    setConfig(nextCfg);
    clearDirty();
  }, []);

  /** Act on a {@link ReconcileDecision} already computed from a fetched remote envelope. */
  const actOnDecision = useCallback(
    async (cfg: SyncConfig, remote: SyncEnvelope, decision: ReconcileDecision) => {
      if (decision === 'apply-remote') {
        applyRemote(cfg, remote);
      } else if (decision === 'push') {
        await pushLocal(cfg);
      } else if (decision === 'conflict') {
        const useRemote = await confirmDialog({
          title: 'Sync conflict',
          body: CONFLICT_MESSAGE,
          confirmLabel: 'Use other device’s data',
          cancelLabel: 'Keep this device’s data',
        });
        if (useRemote) applyRemote(cfg, remote);
        else await pushLocal(cfg);
      }
      // 'noop': nothing to do.
    },
    [applyRemote, pushLocal, confirmDialog],
  );

  /**
   * Pull the remote envelope and act on {@link decideReconcile}'s verdict.
   * Throws on network/auth/etc failures — callers own the in-flight guard and
   * error mapping.
   */
  const reconcileCore = useCallback(
    async (cfg: SyncConfig) => {
      const remote = await pullEnvelope(cfg);
      const decision = decideReconcile(remote.modifiedAt, cfg.lastSyncedAt, isDirty());
      await actOnDecision(cfg, remote, decision);
      setStatus('synced');
      setErrorMessage(null);
    },
    [actOnDecision],
  );

  /** Guarded wrapper around {@link reconcileCore} for external triggers (mount, focus, syncNow). */
  const runReconcile = useCallback(
    async (cfg: SyncConfig) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setStatus('syncing');
      try {
        await reconcileCore(cfg);
      } catch (err) {
        handleSyncError(err);
      } finally {
        inFlightRef.current = false;
      }
    },
    [reconcileCore, handleSyncError],
  );

  /**
   * Debounced push path (SPEC: push on change): GET the remote envelope
   * first. If it moved since our last sync, defer to the same
   * reconcile/conflict handling instead of blindly overwriting newer remote
   * data; otherwise push.
   */
  const runCheckThenPush = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('syncing');
    try {
      const remote = await pullEnvelope(cfg);
      if (remote.modifiedAt !== cfg.lastSyncedAt) {
        const decision = decideReconcile(remote.modifiedAt, cfg.lastSyncedAt, isDirty());
        await actOnDecision(cfg, remote, decision);
      } else {
        await pushLocal(cfg);
      }
      setStatus('synced');
      setErrorMessage(null);
    } catch (err) {
      handleSyncError(err);
    } finally {
      inFlightRef.current = false;
    }
  }, [actOnDecision, pushLocal, handleSyncError]);

  // Reconcile once on load, if a config was already saved from a previous session.
  useEffect(() => {
    const cfg = configRef.current;
    if (cfg) void runReconcile(cfg);
    // Mount-only: intentionally ignores later config changes (connect() reconciles itself).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push on change: mark dirty synchronously (survives a close mid-debounce),
  // then debounce the actual network push so a burst of edits collapses into
  // one round trip. Skips the very first render (nothing changed yet) and any
  // state update caused by applying a remote envelope (not a local edit).
  useEffect(() => {
    if (isFirstStateEffect.current) {
      isFirstStateEffect.current = false;
      return;
    }
    if (suppressNextDirtyRef.current) {
      suppressNextDirtyRef.current = false;
      return;
    }
    const cfg = configRef.current;
    if (!cfg) return;
    markDirty();
    if (debounceTimerRef.current !== null) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void runCheckThenPush();
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [state, runCheckThenPush]);

  // Reconcile on focus/visibility, throttled to at most once per 30s.
  useEffect(() => {
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'hidden') return;
      const cfg = configRef.current;
      if (!cfg) return;
      const now = Date.now();
      if (now - lastFocusReconcileRef.current < FOCUS_THROTTLE_MS) return;
      lastFocusReconcileRef.current = now;
      void runReconcile(cfg);
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [runReconcile]);

  const connect = useCallback(
    async (token: string): Promise<void> => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setStatus('syncing');
      setErrorMessage(null);
      try {
        const gistId = await findSyncGist(token);
        if (gistId !== null) {
          const cfgStub: Pick<SyncConfig, 'token' | 'gistId'> = { token, gistId };
          const remote = await pullEnvelope(cfgStub);
          const localEmpty = stateRef.current.tasks.length === 0 && stateRef.current.history.length === 0;
          const useRemote =
            localEmpty ||
            (await confirmDialog({
              title: 'Existing synced data',
              body: CONNECT_EXISTING_DATA_MESSAGE,
              confirmLabel: 'Use synced data',
              cancelLabel: 'Keep this device’s data',
            }));
          if (useRemote) {
            suppressNextDirtyRef.current = true;
            setState(remote.state);
            const nextCfg: SyncConfig = { token, gistId, lastSyncedAt: remote.modifiedAt };
            saveSyncConfig(nextCfg);
            setConfig(nextCfg);
            clearDirty();
          } else {
            const modifiedAt = new Date().toISOString();
            await pushEnvelope(cfgStub, buildEnvelope(stateRef.current, modifiedAt));
            const nextCfg: SyncConfig = { token, gistId, lastSyncedAt: modifiedAt };
            saveSyncConfig(nextCfg);
            setConfig(nextCfg);
            clearDirty();
          }
        } else {
          const modifiedAt = new Date().toISOString();
          const newGistId = await createSyncGist(token, buildEnvelope(stateRef.current, modifiedAt));
          const nextCfg: SyncConfig = { token, gistId: newGistId, lastSyncedAt: modifiedAt };
          saveSyncConfig(nextCfg);
          setConfig(nextCfg);
          clearDirty();
        }
        setStatus('synced');
      } catch (err) {
        handleSyncError(err);
        throw err;
      } finally {
        inFlightRef.current = false;
      }
    },
    [setState, handleSyncError, confirmDialog],
  );

  const disconnect = useCallback(() => {
    clearSyncConfig();
    clearDirty();
    setConfig(null);
    setStatus('disconnected');
    setErrorMessage(null);
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const syncNow = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg) return;
    await runReconcile(cfg);
  }, [runReconcile]);

  return {
    status,
    lastSyncedAt: config?.lastSyncedAt ?? null,
    errorMessage,
    connected: config !== null,
    gistId: config?.gistId ?? null,
    connect,
    disconnect,
    syncNow,
  };
}
