import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../core/types';
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
  toISODate,
} from '../core/state';
import { exportState, importState } from '../core/exportImport';
import type { SubtaskHandlers } from './SubtaskList';
import { load, save } from '../core/storage';
import { MasterColumn } from './MasterColumn';
import { TodayColumn } from './TodayColumn';
import { DoneColumn } from './DoneColumn';
import { HistoryPanel } from './HistoryPanel';
import { ShortcutHelp } from './ShortcutHelp';

/** True when focus is in a text field, so global letter-shortcuts should not fire. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
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

export function App() {
  const [state, setState] = useState<AppState>(() => load());
  // Due-date labels anchor on the actual wall-clock day, not state.currentDay,
  // so they stay correct if the app sits open past midnight (see useWallClockDay).
  const today = useWallClockDay();
  const importInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Ephemeral focus preference (plan R2 §1) — not persisted, resets each load.
  const [masterCollapsed, setMasterCollapsed] = useState(false);

  // Auto-save full app state on every change (D2).
  useEffect(() => {
    save(state);
  }, [state]);

  // Global keyboard shortcuts (plan §2). Card-scoped shortcuts live on each
  // card's own onKeyDown; these are the app-level ones.
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
      } else if (e.key === 'm') {
        e.preventDefault();
        setMasterCollapsed((v) => !v);
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
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file later
    if (!file) return;
    try {
      const restored = importState(await file.text());
      const ok = window.confirm(
        'Import this file?\n\nThis replaces ALL current data with the file’s contents and cannot be undone.',
      );
      if (ok) setState(restored);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Import failed.');
    }
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

  const handleStartNewDay = () => {
    const ok = window.confirm(
      'Start a new day?\n\n' +
        'This collapses Done into History, returns unfinished tasks to Master, ' +
        'and discards unfinished recurring day-copies. This cannot be undone.',
    );
    if (ok) setState((s) => startNewDay(s, new Date()));
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>To-Do</h1>
        <div className="app__day">
          <span className="app__day-label">Day: {state.currentDay}</span>
          <button type="button" className="app__new-day" onClick={handleStartNewDay}>
            New Day
          </button>
          <div className="app__menu" ref={menuRef}>
            <button
              type="button"
              className="app__menu-btn"
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
          <button
            type="button"
            className="app__help"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            onClick={() => setShowHelp(true)}
          >
            ?
          </button>
        </div>
      </header>
      <main className={'board' + (masterCollapsed ? ' board--master-collapsed' : '')}>
        <MasterColumn
          tasks={state.tasks}
          today={today}
          addInputRef={addInputRef}
          collapsed={masterCollapsed}
          onToggleCollapse={() => setMasterCollapsed((v) => !v)}
          onCreate={(input) => setState((s) => createTask(s, input))}
          onUpdate={(id, patch) => setState((s) => updateTask(s, id, patch))}
          onDelete={(id) => setState((s) => deleteTask(s, id))}
          onAddToday={(id) => setState((s) => moveToToday(s, id))}
          subtaskHandlers={subtaskHandlers}
        />
        <TodayColumn
          tasks={state.tasks}
          today={today}
          onReorder={(id, targetIndex) => setState((s) => reorderToday(s, id, targetIndex))}
          onRemove={(id) => setState((s) => removeFromToday(s, id))}
          onComplete={(id) => setState((s) => completeTask(s, id))}
          onSetActive={(id) => setState((s) => setActive(s, id))}
          onUpdate={(id, patch) => setState((s) => updateTask(s, id, patch))}
          onDelete={(id) => setState((s) => deleteTask(s, id))}
          subtaskHandlers={subtaskHandlers}
        />
        <DoneColumn
          tasks={state.tasks}
          today={today}
          onUncomplete={(id) => setState((s) => uncompleteTask(s, id))}
          onClear={() => setState((s) => clearDone(s, new Date()))}
        />
      </main>
      <HistoryPanel history={state.history} />
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
