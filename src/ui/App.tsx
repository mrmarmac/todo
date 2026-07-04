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

export function App() {
  const [state, setState] = useState<AppState>(() => load());
  const importInputRef = useRef<HTMLInputElement>(null);

  // Auto-save full app state on every change (D2).
  useEffect(() => {
    save(state);
  }, [state]);

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
            Start New Day
          </button>
          <button type="button" onClick={handleExport}>
            Export
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportFile}
          />
        </div>
      </header>
      <main className="board">
        <MasterColumn
          tasks={state.tasks}
          onCreate={(input) => setState((s) => createTask(s, input))}
          onUpdate={(id, patch) => setState((s) => updateTask(s, id, patch))}
          onDelete={(id) => setState((s) => deleteTask(s, id))}
          onAddToday={(id) => setState((s) => moveToToday(s, id))}
          subtaskHandlers={subtaskHandlers}
        />
        <TodayColumn
          tasks={state.tasks}
          onReorder={(id, targetIndex) => setState((s) => reorderToday(s, id, targetIndex))}
          onRemove={(id) => setState((s) => removeFromToday(s, id))}
          onComplete={(id) => setState((s) => completeTask(s, id))}
          onSetActive={(id) => setState((s) => setActive(s, id))}
          subtaskHandlers={subtaskHandlers}
        />
        <DoneColumn
          tasks={state.tasks}
          onUncomplete={(id) => setState((s) => uncompleteTask(s, id))}
          onClear={() => setState((s) => clearDone(s, new Date()))}
        />
      </main>
      <HistoryPanel history={state.history} />
    </div>
  );
}
