import type { AttentionItem } from "../../domain/workplace";
import type { CalendarEvent } from "../../models/calendar";
import type { WorkplaceTask } from "../../models/workplace";

export type WorkplaceNavigate = {
  onOpenSheet: (loadId: string) => void;
  onOpenAdvisory?: () => void;
  onOpenCalendar?: (date?: string) => void;
  onOpenClasses?: () => void;
  onOpenLoads?: (loadId?: string) => void;
};

export function WorkplacePanel({
  attention,
  upcoming,
  tasks,
  onNavigate,
  onAddTask,
  onToggleTask,
  onRemoveTask,
}: {
  attention: AttentionItem[];
  upcoming: CalendarEvent[];
  tasks: WorkplaceTask[];
  onNavigate: WorkplaceNavigate;
  onAddTask: (title: string, dueDate: string) => Promise<void>;
  onToggleTask: (id: string) => Promise<void>;
  onRemoveTask: (id: string) => Promise<void>;
}) {
  const openAttention = (item: AttentionItem) => {
    if (item.action === "advisory") onNavigate.onOpenAdvisory?.();
    else if (item.action === "classes") onNavigate.onOpenClasses?.();
    else if (item.action === "calendar") onNavigate.onOpenCalendar?.();
    else if (item.action === "learner") onNavigate.onOpenLoads?.(item.assignmentId);
    else if (item.assignmentId) onNavigate.onOpenSheet(item.assignmentId);
  };

  return (
    <div className="workplace-grid">
      <div className="card workplace-panel">
        <h3>Workplace</h3>
        <p className="muted small">Pending imports, missing grades, and advisory conflicts.</p>
        {attention.length === 0 ? (
          <p className="muted">No outstanding workplace tasks.</p>
        ) : (
          <ul className="dash-tasks">
            {attention.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`dash-task dash-task--${item.severity === "danger" ? "warn" : item.severity === "warning" ? "warn" : "info"}`}
                  onClick={() => openAttention(item)}
                >
                  <span className="dash-task-title">{item.title}</span>
                  <span className="muted">{item.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card workplace-panel">
        <h3>Coming up</h3>
        {upcoming.length === 0 ? (
          <p className="muted">No upcoming calendar items.</p>
        ) : (
          <ul className="calendar-agenda">
            {upcoming.map((event) => (
              <li key={event.id}>
                <button type="button" className="dash-link" onClick={() => onNavigate.onOpenCalendar?.(event.startDate || event.date)}>
                  <span className="calendar-agenda-date">{event.startDate || event.date}</span>
                  <span>{event.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PersonalTasks tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onRemoveTask={onRemoveTask} />
    </div>
  );
}

function PersonalTasks({
  tasks,
  onAddTask,
  onToggleTask,
  onRemoveTask,
}: {
  tasks: WorkplaceTask[];
  onAddTask: (title: string, dueDate: string) => Promise<void>;
  onToggleTask: (id: string) => Promise<void>;
  onRemoveTask: (id: string) => Promise<void>;
}) {
  return (
    <div className="card workplace-panel">
      <h3>My tasks</h3>
      <form
        className="workplace-task-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const title = String(new FormData(form).get("title") || "");
          const dueDate = String(new FormData(form).get("dueDate") || "");
          if (!title.trim()) return;
          void onAddTask(title, dueDate).then(() => form.reset());
        }}
      >
        <input name="title" placeholder="Add a task" required />
        <input name="dueDate" type="date" />
        <button type="submit" className="primary">
          Add
        </button>
      </form>
      {tasks.length === 0 ? <p className="muted">No personal tasks yet.</p> : null}
      <ul className="workplace-task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.completed ? "is-done" : undefined}>
            <label className="checkbox-row">
              <input type="checkbox" checked={task.completed} onChange={() => void onToggleTask(task.id)} />
              <span>
                {task.title}
                {task.dueDate ? <span className="muted small"> · {task.dueDate}</span> : null}
              </span>
            </label>
            <button type="button" className="ghost small" onClick={() => void onRemoveTask(task.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
