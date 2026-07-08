import type { Task } from '../core/types';
import { SubtaskList } from './SubtaskList';
import { DueDate } from './DueDate';
import { Icon } from './Icon';
import { handleArrowNav, isCardTarget } from './cardKeys';

const noopSubtaskHandlers = {
  onAddSubtask: () => {},
  onUpdateSubtask: () => {},
  onDeleteSubtask: () => {},
  onCompleteSubtask: () => {},
  onUncompleteSubtask: () => {},
  onSetActiveSubtask: () => {},
};

interface Props {
  tasks: Task[];
  today: string;
  onUncomplete: (id: string) => void;
  onClear: () => void;
}

export function DoneColumn({ tasks, today, onUncomplete, onClear }: Props) {
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
          <li
            key={task.id}
            className="task task--done"
            tabIndex={0}
            onKeyDown={(e) => {
              if (handleArrowNav(e)) return;
              if (!isCardTarget(e)) return;
              if (e.key === 'u') {
                e.preventDefault();
                onUncomplete(task.id);
              }
            }}
          >
            <div className="task__main">
              <span className="task__title task__title--done">{task.title}</span>
              {task.sourceTaskId && <span className="badge badge--copy">recurring</span>}
              {task.dueDate && <DueDate dueDate={task.dueDate} today={today} />}
            </div>
            <div className="task__actions">
              <button
                type="button"
                className="icon-btn"
                aria-label="Undo (back to Today)"
                title="Undo (back to Today)"
                onClick={() => onUncomplete(task.id)}
              >
                <Icon name="rotate-ccw" />
              </button>
            </div>
            <SubtaskList task={task} readOnly {...noopSubtaskHandlers} />
          </li>
        ))}
      </ul>
    </section>
  );
}
