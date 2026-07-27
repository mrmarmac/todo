import type { Task } from '../core/types';
import { SubtaskList } from './SubtaskList';
import { DueDate } from './DueDate';
import { TaskTitle } from './TaskTitle';
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
}

export function DoneColumn({ tasks, today, onUncomplete }: Props) {
  const doneTasks = tasks.filter((t) => t.column === 'done');

  return (
    <>
      {doneTasks.length === 0 && (
        <p className="col__placeholder">Completed tasks land here until you Clear them.</p>
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
            <span className="task__mark" aria-hidden="true" />
            <div className="task__main">
              <TaskTitle title={task.title} className="task__title task__title--done" />
              {task.sourceTaskId && <span className="task__tag">copy</span>}
            </div>
            {task.dueDate ? (
              <DueDate dueDate={task.dueDate} today={today} done />
            ) : (
              <span className="task__due task__due--none" aria-hidden="true">
                —
              </span>
            )}
            <span className="task__check">
              <input
                type="checkbox"
                checked
                aria-label="Mark not done (back to Today)"
                title="Uncheck — back to Today (u)"
                onChange={() => onUncomplete(task.id)}
              />
            </span>
            <SubtaskList task={task} readOnly {...noopSubtaskHandlers} />
          </li>
        ))}
      </ul>
    </>
  );
}
