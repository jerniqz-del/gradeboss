import { useMemo, useState } from "react";
import type { ChecklistComponent } from "../../models/checklist";
import type { PerformanceChecklist } from "../../models/checklist";

export function AddActivityForm({
  checklist,
  onAdd,
}: {
  checklist: PerformanceChecklist;
  onAdd: (input: { criterionId: string; title: string; date: string; destinationComponent: ChecklistComponent; maxPoints: number; allowNotes: boolean }) => void;
}) {
  const active = useMemo(() => checklist.criteria.filter((item) => item.active), [checklist.criteria]);
  const [criterionId, setCriterionId] = useState(active[0]?.id || "");
  const criterion = active.find((item) => item.id === criterionId) || active[0];
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [component, setComponent] = useState<ChecklistComponent>(criterion?.destinationComponent || "WW");
  const [maxPoints, setMaxPoints] = useState(String(criterion?.maxPointsPerSession || 10));
  const [allowNotes, setAllowNotes] = useState(true);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="primary" onClick={() => setOpen(true)}>
        + Create Checklist
      </button>
    );
  }

  return (
    <form
      className="chk-add-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!criterion) return;
        onAdd({
          criterionId: criterion.id,
          title: title.trim() || `${criterion.label} ${(checklist.sessions.filter((session) => session.activity?.criterionId === criterion.id).length + 1)}`,
          date,
          destinationComponent: component,
          maxPoints: Number(maxPoints) || criterion.maxPointsPerSession,
          allowNotes,
        });
        setTitle("");
        setOpen(false);
      }}
    >
      <label>
        Type
        <select
          value={criterion?.id || ""}
          onChange={(event) => {
            const next = active.find((item) => item.id === event.target.value);
            setCriterionId(event.target.value);
            if (next) {
              setComponent(next.destinationComponent);
              setMaxPoints(String(next.maxPointsPerSession));
            }
          }}
        >
          {active.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={criterion ? `${criterion.label} next` : "Activity"} />
      </label>
      <label>
        Date
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label>
        Destination
        <select value={component} onChange={(event) => setComponent(event.target.value as ChecklistComponent)}>
          <option value="WW">Written Work</option>
          <option value="PT">Performance Task</option>
          <option value="TRACKING">Tracking only</option>
        </select>
      </label>
      <label>
        HPS
        <input inputMode="decimal" value={maxPoints} onChange={(event) => setMaxPoints(event.target.value)} />
      </label>
      <label className="chk-check">
        <input type="checkbox" checked={allowNotes} onChange={(event) => setAllowNotes(event.target.checked)} />
        Allow notes
      </label>
      <button type="submit" className="primary">
        Save activity
      </button>
      <button type="button" className="ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
