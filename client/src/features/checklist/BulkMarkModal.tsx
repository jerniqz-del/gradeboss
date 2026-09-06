import { useMemo, useState } from "react";
import type { PerformanceChecklist } from "../../models/checklist";
import type { TeachingLoad } from "../../models/teaching-load";
import { sortDepEdRoster } from "../roster/sort";
import { checklistActivityDefinition, visibleSessions } from "../../domain/checklist";

export function BulkMarkModal({
  load,
  checklist,
  onClose,
  onApply,
}: {
  load: TeachingLoad;
  checklist: PerformanceChecklist;
  onClose: () => void;
  onApply: (sessionId: string, criterionId: string, points: number, scope: "missing" | "all") => void;
}) {
  const sessions = visibleSessions(checklist);
  const [sessionId, setSessionId] = useState(sessions[0]?.id || "");
  const session = sessions.find((item) => item.id === sessionId) || sessions[0];
  const activity = session ? checklistActivityDefinition(checklist, session) : null;
  const [points, setPoints] = useState(String(activity?.maxPointsPerSession ?? 1));
  const [scope, setScope] = useState<"missing" | "all">("missing");
  const eligible = useMemo(() => sortDepEdRoster(load.learners).filter((learner) => !learner.transferredOutTerm).length, [load.learners]);

  return (
    <div className="att-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="card att-modal" role="dialog" aria-labelledby="chk-bulk-title" onClick={(event) => event.stopPropagation()}>
        <div className="att-modal-head">
          <h3 id="chk-bulk-title">Bulk mark</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <label>
          Activity
          <select value={session?.id || ""} onChange={(event) => setSessionId(event.target.value)}>
            {sessions.map((item) => {
              const definition = checklistActivityDefinition(checklist, item);
              return (
                <option key={item.id} value={item.id}>
                  {definition?.title || item.title}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Points (HPS {activity?.maxPointsPerSession ?? 0})
          <input
            inputMode="decimal"
            data-testid="chk-bulk-points"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
        </label>
        <label>
          Scope
          <select value={scope} onChange={(event) => setScope(event.target.value as "missing" | "all")}>
            <option value="missing">Fill missing only</option>
            <option value="all">Overwrite visible learners</option>
          </select>
        </label>
        <p className="muted">
          {eligible} eligible learner{eligible === 1 ? "" : "s"} in this class.
        </p>
        <div className="att-modal-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={!session || !activity}
            onClick={() => {
              if (!session || !activity) return;
              const value = Number(points);
              if (!Number.isFinite(value) || value < 0 || value > (activity.maxPointsPerSession || 0)) {
                return;
              }
              onApply(session.id, activity.criterionId, value, scope);
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
