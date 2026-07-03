export type Column = 'master' | 'today' | 'done';

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  isActive: boolean;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string | null; // ISO date (YYYY-MM-DD) or null
  column: Column;
  isRecurring: boolean;
  isActive: boolean;
  sourceTaskId: string | null; // master id for a recurring day-copy; else null
  subtasks: Subtask[];
}

export type OccurrenceType = 'task' | 'subtask';

export interface HistoryEntry {
  id: string;
  occurrenceType: OccurrenceType;
  taskId: string;
  parentTaskId: string | null; // set when occurrenceType === 'subtask'
  title: string;
  completedAt: string; // ISO timestamp
  day: string; // currentDay value at completion
}

export interface AppState {
  tasks: Task[]; // array order is the manual Today order
  history: HistoryEntry[];
  currentDay: string; // ISO date (YYYY-MM-DD)
}
