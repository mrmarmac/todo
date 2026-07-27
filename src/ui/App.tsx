import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../core/types';
import type { CreateTaskInput } from '../core/state';
import {
  createTask,
  updateTask,
  deleteTask,
  moveToToday,
  removeFromToday,
  reorderToday,
  completeTask,
  uncompleteTask,
  clearDone,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  completeSubtask,
  uncompleteSubtask,
  setActive,
  setActiveSubtask,
  startNewDay,
  updateHistoryEntry,
  deleteHistoryEntry,
  historyDeletionScope,
  toISODate,
} from '../core/state';
import { dayProgress } from '../core/progress';
import { exportState, importState } from '../core/exportImport';
import type { SubtaskHandlers } from './SubtaskList';
import { load, save } from '../core/storage';
import { Column, type ColumnKey } from './Column';
import { MasterColumn } from './MasterColumn';
import { TodayColumn } from './TodayColumn';
import { DoneColumn } from './DoneColumn';
import { HistoryPanel } from './HistoryPanel';
import { ShortcutHelp } from './ShortcutHelp';
import { SyncSettings } from './SyncSettings';
import { useGistSync, syncStatusLabel } from './useGistSync';
import { useConfirm } from './ConfirmDialog';
import { useTheme, themeLabel } from './useTheme';
import { onStorageFailure } from '../core/safeStorage';
import { Icon } from './Icon';
import { Toast } from './Toast';

/** True when focus is in a text field, so global letter-shortcuts should not fire. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/** How long a newly created task stays highlighted, in ms. */
const FLASH_MS = 1600;

/** How long the undo toast stays on screen after a destructive action, in ms. */
const TOAST_MS = 5000;

/** A pending undo: the message shown and the full state to restore on undo. */
interface ToastState {
  message: string;
  snapshot: AppState;
}

/**
 * Wall-clock ISO date (YYYY-MM-DD), kept current while the app stays open so
 * due-date labels ("today", "tomorrow", …) roll over at real midnight instead
 * of anchoring to the manually-advanced currentDay. Re-checks on an interval
 * and whenever the tab regains visibility/focus, since background tabs throttle
 * timers and can miss the midnight tick.
 */
function useWallClockDay(): string {
  const [today, setToday] = useState(() => toISODate(new Date()));
  useEffect(() => {
    const sync = () => setToday((prev) => {
      const now = toISODate(new Date());
      return now === prev ? prev : now;
    });
    const id = window.setInterval(sync, 60_000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  return today;
}

type CollapsedState = Record<ColumnKey, boolean>;

export function App() {
  const [state, setState] = useState<AppState>(() => load());
  // Due-date labels anchor on the actual wall-clock day, not state.currentDay,
  // so they stay correct if the app sits open past midnight (see useWallClockDay).
  const today = useWallClockDay();
  const importInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Ephemeral view preference — not persisted, resets each load.
  const [collapsed, setCollapsed] = useState<CollapsedState>({
    master: false,
    today: false,
    done: false,
  });
  // Id of the task created most recently, highlighted briefly so it can be
  // spotted without scanning the list (it sorts into place, not to the bottom).
  const [flashId, setFlashId] = useState<string | null>(null);
  // A destructive action (delete / Clear / New Day) captures the prior state
  // here so the undo toast can restore it — those reducers have no inverse.
  const [toast, setToast] = useState<ToastState | null>(null);
  const { confirm, dialog } = useConfirm();
  const sync = useGistSync(state, setState, confirm);
  const { theme, cycleTheme } = useTheme();
  // Set once localStorage starts refusing writes (quota full, site data
  // blocked). Persistence is the whole product here, so a silent failure would
  // be the worst outcome — the banner says so instead (D41).
  const [storageBroken, setStorageBroken] = useState(false);

  const toggleColumn = (key: ColumnKey) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // Surface storage failures rather than letting them pass unnoticed (D41).
  // Declared before the save effect so the subscription is live by the time the
  // first write runs. Going through the subscription — rather than branching on
  // save()'s return value — keeps the setState in a callback from an external
  // system, which is what an effect is for, and catches failed sync-config and
  // dirty-flag writes too.
  useEffect(() => onStorageFailure(() => setStorageBroken(true)), []);

  // Auto-save full app state on every change (D2). `save` reports failure
  // rather than throwing, so a full quota can never unmount the app mid-commit.
  useEffect(() => {
    save(state);
  }, [state]);

  // Drop the new-task highlight once it has served its purpose.
  useEffect(() => {
    if (flashId === null) return;
    const id = window.setTimeout(() => setFlashId(null), FLASH_MS);
    return () => window.clearTimeout(id);
  }, [flashId]);

  // Auto-dismiss the undo toast after a few seconds (mirrors the flash timeout).
  useEffect(() => {
    if (toast === null) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Apply a destructive change while stashing the prior state for one-tap undo.
  // deleteTask/clearDone/startNewDay drop or collapse data with no inverse
  // reducer, so a full snapshot is the only faithful undo.
  const runWithUndo = (message: string, next: AppState) => {
    setToast({ message, snapshot: state });
    setState(next);
  };

  const handleUndo = () => {
    if (!toast) return;
    setState(toast.snapshot);
    setToast(null);
  };

  // Global keyboard shortcuts. Card-scoped shortcuts live on each card's own
  // onKeyDown; these are the app-level ones.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack keys while the user is typing in a field.
      if (isTypingTarget(e.target)) return;
      // '?' is Shift+/ — some layouts/engines report the key as '/' + shift.
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowHelp((v) => !v);
      } else if (e.key === 'n') {
        e.preventDefault();
        addInputRef.current?.focus();
      } else if (e.key === '1' || e.key === 'm') {
        e.preventDefault();
        toggleColumn('master');
      } else if (e.key === '2') {
        e.preventDefault();
        toggleColumn('today');
      } else if (e.key === '3') {
        e.preventDefault();
        toggleColumn('done');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close the overflow menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleExport = () => {
    const json = exportState(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todo-export-${toISODate(new Date())}.json`;
    a.click();
    // Revoke on the next tick, not inline: Safari — which is the browser this
    // installed PWA actually runs in — can cancel a download whose blob URL is
    // revoked in the same task as the click.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file later
    if (!file) return;
    let restored: AppState;
    try {
      restored = importState(await file.text());
    } catch (err) {
      await confirm({
        title: 'Import failed',
        body: err instanceof Error ? err.message : 'Import failed.',
        confirmLabel: 'OK',
      });
      return;
    }
    const ok = await confirm({
      title: 'Import this file?',
      body: 'This replaces ALL current data with the file’s contents and cannot be undone.',
      confirmLabel: 'Replace everything',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) setState(restored);
  };

  // Computed eagerly (rather than inside a setState updater) so the new task's
  // id is available to flash it — createTask appends, so it is the last task.
  const handleCreateTask = (input: CreateTaskInput) => {
    const next = createTask(state, input);
    setState(next);
    setFlashId(next.tasks[next.tasks.length - 1].id);
    // A task added while Master is collapsed would otherwise vanish silently.
    setCollapsed((c) => (c.master ? { ...c, master: false } : c));
  };

  const subtaskHandlers: SubtaskHandlers = {
    onAddSubtask: (taskId, title) => setState((s) => addSubtask(s, taskId, title)),
    onUpdateSubtask: (taskId, subtaskId, patch) =>
      setState((s) => updateSubtask(s, taskId, subtaskId, patch)),
    onDeleteSubtask: (taskId, subtaskId) => setState((s) => deleteSubtask(s, taskId, subtaskId)),
    onCompleteSubtask: (taskId, subtaskId) =>
      setState((s) => completeSubtask(s, taskId, subtaskId)),
    onUncompleteSubtask: (taskId, subtaskId) =>
      setState((s) => uncompleteSubtask(s, taskId, subtaskId)),
    onSetActiveSubtask: (taskId, subtaskId) =>
      setState((s) => setActiveSubtask(s, taskId, subtaskId)),
  };

  // No confirm: the undo toast is the safety net now (a New Day is fully
  // restorable from the snapshot, including history it pruned).
  const handleStartNewDay = () => {
    runWithUndo('New day started', startNewDay(state, new Date()));
  };

  // Deleting from History is unrecoverable — the entry is the only record left
  // of that occurrence — so it confirms, and the prompt names the completed
  // subtasks that go with a parent (D50) rather than removing them silently.
  const handleDeleteHistoryEntry = async (id: string) => {
    const doomed = historyDeletionScope(state, id);
    if (doomed.length === 0) return;
    const [entry] = doomed;
    const subtaskCount = doomed.length - 1;
    const ok = await confirm({
      title: 'Delete this History entry?',
      body:
        `“${entry.title}” will be removed from History.` +
        (subtaskCount > 0
          ? ` Its ${subtaskCount} completed subtask${subtaskCount === 1 ? '' : 's'} ` +
            'will be removed with it.'
          : '') +
        '\n\nThis cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) setState((s) => deleteHistoryEntry(s, id));
  };

  const masterCount = state.tasks.filter((t) => t.column === 'master').length;
  const todayCount = state.tasks.filter((t) => t.column === 'today').length;
  const doneCount = state.tasks.filter((t) => t.column === 'done').length;
  const progress = dayProgress(state);
  const progressPct =
    progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__marks" aria-hidden="true">
            <i /><i /><i />
          </span>
          <h1>To-Do</h1>
        </div>

        <div className="app__day">
          <span className="app__day-label">Day</span>
          <time className="app__day-value" dateTime={state.currentDay}>
            {state.currentDay}
          </time>
        </div>

        {progress.total > 0 && (
          <div
            className="app__progress"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress today"
            title={`${progress.done} of ${progress.total} done today`}
          >
            <span className="app__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}

        <div className="app__actions">
          <button type="button" className="btn" onClick={handleStartNewDay}>
            New Day
          </button>
          {(sync.connected || sync.status === 'error') && (
            <button
              type="button"
              className="app__sync-indicator"
              aria-label={`Sync status: ${syncStatusLabel(sync.status)}`}
              title={`Sync: ${syncStatusLabel(sync.status)}`}
              onClick={() => setShowSync(true)}
            >
              <span className={`sync-dot sync-dot--${sync.status}`} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="btn btn--quiet"
            title={`${themeLabel(theme)} — click to change`}
            aria-label={`${themeLabel(theme)}. Click to change theme.`}
            onClick={cycleTheme}
          >
            <Icon name={theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'contrast'} />
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            onClick={() => setShowHelp(true)}
          >
            ?
          </button>
          <div className="app__menu" ref={menuRef}>
            <button
              type="button"
              className="btn btn--quiet"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              title="More actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="app__menu-list" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    handleExport();
                  }}
                >
                  Export
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    importInputRef.current?.click();
                  }}
                >
                  Import
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowSync(true);
                  }}
                >
                  Sync…
                </button>
              </div>
            )}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportFile}
          />
        </div>
      </header>

      {storageBroken && (
        <p className="app__storage-warning" role="alert">
          Changes can’t be saved on this device — storage is full or blocked. Export your
          data before closing this tab.
        </p>
      )}

      <main className="board">
        <Column
          columnKey="master"
          name="Master"
          count={masterCount}
          collapsed={collapsed.master}
          onToggleCollapse={() => toggleColumn('master')}
        >
          <MasterColumn
            tasks={state.tasks}
            today={today}
            addInputRef={addInputRef}
            flashId={flashId}
            onCreate={handleCreateTask}
            onUpdate={(id, patch) => setState((s) => updateTask(s, id, patch))}
            onDelete={(id) => runWithUndo('Task deleted', deleteTask(state, id))}
            onAddToday={(id) => setState((s) => moveToToday(s, id))}
            subtaskHandlers={subtaskHandlers}
          />
        </Column>

        <Column
          columnKey="today"
          name="Today"
          count={todayCount}
          collapsed={collapsed.today}
          onToggleCollapse={() => toggleColumn('today')}
        >
          <TodayColumn
            tasks={state.tasks}
            today={today}
            onReorder={(id, targetIndex) => setState((s) => reorderToday(s, id, targetIndex))}
            onRemove={(id) => setState((s) => removeFromToday(s, id))}
            onComplete={(id) => setState((s) => completeTask(s, id))}
            onSetActive={(id) => setState((s) => setActive(s, id))}
            onUpdate={(id, patch) => setState((s) => updateTask(s, id, patch))}
            onDelete={(id) => runWithUndo('Task deleted', deleteTask(state, id))}
            subtaskHandlers={subtaskHandlers}
          />
        </Column>

        <Column
          columnKey="done"
          name="Done"
          count={doneCount}
          collapsed={collapsed.done}
          onToggleCollapse={() => toggleColumn('done')}
          actions={
            <button
              type="button"
              className="btn btn--small"
              disabled={doneCount === 0}
              title="Move completed tasks into History"
              onClick={() => runWithUndo('Done cleared', clearDone(state, new Date()))}
            >
              Clear
            </button>
          }
        >
          <DoneColumn
            tasks={state.tasks}
            today={today}
            onUncomplete={(id) => setState((s) => uncompleteTask(s, id))}
          />
        </Column>
      </main>

      <HistoryPanel
        history={state.history}
        onUpdateEntry={(id, patch) => setState((s) => updateHistoryEntry(s, id, patch))}
        onDeleteEntry={handleDeleteHistoryEntry}
      />
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
      {showSync && (
        <SyncSettings sync={sync} confirm={confirm} onClose={() => setShowSync(false)} />
      )}
      {toast && <Toast message={toast.message} onUndo={handleUndo} />}
      {dialog}
    </div>
  );
}
