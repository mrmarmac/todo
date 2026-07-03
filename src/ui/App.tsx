import { useEffect, useState } from 'react';
import type { AppState } from '../core/types';
import { createTask, updateTask, deleteTask } from '../core/state';
import { load, save } from '../core/storage';
import { MasterColumn } from './MasterColumn';

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
        />
        <section className="column column--today">
          <h2>Today</h2>
          <p className="column__placeholder">Coming in Slice 2.</p>
        </section>
        <section className="column column--done">
          <h2>Done</h2>
          <p className="column__placeholder">Coming in Slice 3.</p>
        </section>
      </main>
    </div>
  );
}
