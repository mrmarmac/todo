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
  addSubtask,
  updateSubtask,
  deleteSubtask,
  completeSubtask,
  uncompleteSubtask,
} from '../core/state';
import type { SubtaskHandlers } from './SubtaskList';
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

  const subtaskHandlers: SubtaskHandlers = {
    onAddSubtask: (taskId, title) => setState((s) => addSubtask(s, taskId, title)),
    onUpdateSubtask: (taskId, subtaskId, patch) =>
      setState((s) => updateSubtask(s, taskId, subtaskId, patch)),
    onDeleteSubtask: (taskId, subtaskId) => setState((s) => deleteSubtask(s, taskId, subtaskId)),
    onCompleteSubtask: (taskId, subtaskId) =>
      setState((s) => completeSubtask(s, taskId, subtaskId)),
    onUncompleteSubtask: (taskId, subtaskId) =>
      setState((s) => uncompleteSubtask(s, taskId, subtaskId)),
  };

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
          subtaskHandlers={subtaskHandlers}
        />
        <TodayColumn
          tasks={state.tasks}
          onReorder={(id, targetIndex) => setState((s) => reorderToday(s, id, targetIndex))}
          onRemove={(id) => setState((s) => removeFromToday(s, id))}
          onComplete={(id) => setState((s) => completeTask(s, id))}
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
