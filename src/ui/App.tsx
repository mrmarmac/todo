import { useEffect, useState } from 'react';
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
} from '../core/state';
import { load, save } from '../core/storage';
import { MasterColumn } from './MasterColumn';
import { TodayColumn } from './TodayColumn';
import { DoneColumn } from './DoneColumn';
import { HistoryPanel } from './HistoryPanel';

export function App() {
  const [state, setState] = useState<AppState>(() => load());

  // Auto-save full app state on every change (D2).
  useEffect(() => {
    save(state);
  }, [state]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>To-Do</h1>
      </header>
      <main className="board">
        <MasterColumn
          tasks={state.tasks}
          onCreate={(input) => setState((s) => createTask(s, input))}
          onUpdate={(id, patch) => setState((s) => updateTask(s, id, patch))}
          onDelete={(id) => setState((s) => deleteTask(s, id))}
          onAddToday={(id) => setState((s) => moveToToday(s, id))}
        />
        <TodayColumn
          tasks={state.tasks}
          onReorder={(id, targetIndex) => setState((s) => reorderToday(s, id, targetIndex))}
          onRemove={(id) => setState((s) => removeFromToday(s, id))}
          onComplete={(id) => setState((s) => completeTask(s, id))}
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
