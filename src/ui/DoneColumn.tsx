import type { Task } from '../core/types';

interface Props {
  tasks: Task[];
  onUncomplete: (id: string) => void;
  onClear: () => void;
}

export function DoneColumn({ tasks, onUncomplete, onClear }: Props) {
  const doneTasks = tasks.filter((t) => t.column === 'done');

  return (
    <section className="column column--done">
      <div className="column__head">
        <h2>Done</h2>
        <button type="button" disabled={doneTasks.length === 0} onClick={onClear}>
          Clear
        </button>
      </div>
      {doneTasks.length === 0 && (
        <p className="column__placeholder">Completed tasks land here until you Clear them.</p>
      )}
      <ul className="task-list">
        {doneTasks.map((task) => (
          <li key={task.id} className="task task--done">
            <div className="task__main">
              <span className="task__title task__title--done">{task.title}</span>
              {task.sourceTaskId && <span className="badge badge--copy">recurring</span>}
            </div>
            <div className="task__actions">
              <button type="button" onClick={() => onUncomplete(task.id)}>
                Undo
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
