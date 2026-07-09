import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { syncStatusLabel } from './useGistSync';
import type { UseGistSyncResult } from './useGistSync';
import type { ConfirmOptions } from './ConfirmDialog';

interface Props {
  sync: UseGistSyncResult;
  /** In-app confirm prompt, passed down from App's single {@link useConfirm} instance. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  onClose: () => void;
}

const CREATE_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=todo-pwa%20sync';

/** Human-readable "time ago" for the last-synced timestamp; falls back to a locale string past a day. */
function formatLastSynced(iso: string | null): string {
  if (iso === null) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const diffMin = Math.round((Date.now() - then) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr === 1) return '1 hour ago';
  if (diffHr < 24) return `${diffHr} hours ago`;
  return new Date(iso).toLocaleString();
}

/** Modal dialog for connecting/disconnecting/inspecting Gist sync (imitates ShortcutHelp's structure). */
export function SyncSettings({ sync, confirm, onClose }: Props) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  // Close on Escape regardless of where focus sits.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (trimmed === '' || busy) return;
    setBusy(true);
    try {
      await sync.connect(trimmed);
      setToken('');
    } catch {
      // Error is surfaced via sync.errorMessage below.
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect sync on this device?',
      body: 'Local data stays as-is and the gist on GitHub is not deleted — you can reconnect later.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) sync.disconnect();
  };

  return (
    <div
      className="sync-settings__backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sync settings"
    >
      <div className="sync-settings" onClick={(e) => e.stopPropagation()}>
        <div className="sync-settings__head">
          <h2>Sync</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        {sync.connected ? (
          <div className="sync-settings__body">
            <div className="sync-settings__status">
              <span className={`sync-dot sync-dot--${sync.status}`} aria-hidden="true" />
              <span>
                {syncStatusLabel(sync.status)}
                {' · Last synced '}
                {formatLastSynced(sync.lastSyncedAt)}
              </span>
            </div>
            {sync.gistId !== null && (
              <a
                className="sync-settings__gist-link"
                href={`https://gist.github.com/${sync.gistId}`}
                target="_blank"
                rel="noreferrer"
              >
                View the sync gist on GitHub →
              </a>
            )}
            <div className="sync-settings__actions">
              <button type="button" onClick={() => void sync.syncNow()} disabled={sync.status === 'syncing'}>
                Sync now
              </button>
              <button type="button" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
            <p className="sync-settings__note">
              Disconnecting only stops syncing on this device — the gist and its data on GitHub are left untouched.
            </p>
            {sync.errorMessage && (
              <p className="sync-settings__error" role="alert">
                {sync.errorMessage}
              </p>
            )}
          </div>
        ) : (
          <div className="sync-settings__body">
            <p>
              Sync keeps this to-do list up to date across your devices using a private
              (“secret”) GitHub gist as the shared storage — no server or account beyond GitHub is
              involved.
            </p>
            <p>
              You’ll need a personal access token scoped to <strong>gist</strong> only. The token is
              stored solely in this browser’s local storage and is only ever sent to GitHub’s API.
            </p>
            <a
              className="sync-settings__token-link"
              href={CREATE_TOKEN_URL}
              target="_blank"
              rel="noreferrer"
            >
              Create a token on GitHub →
            </a>
            <form className="sync-settings__form" onSubmit={handleConnect}>
              <input
                type="password"
                autoComplete="off"
                placeholder="Paste your GitHub token"
                aria-label="GitHub personal access token"
                value={token}
                disabled={busy}
                onChange={(e) => setToken(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={busy || token.trim() === ''}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </form>
            {sync.errorMessage && (
              <p className="sync-settings__error" role="alert">
                {sync.errorMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
