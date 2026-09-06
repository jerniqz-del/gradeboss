import { useState } from "react";
import { learnerDisplayName } from "../../models/learner";
import type { PerformanceChecklist } from "../../models/checklist";
import type { TeachingLoad } from "../../models/teaching-load";
import {
  checklistActivityTargetSuggestions,
  hasToolsPin,
  planChecklistActivityPublication,
  type ActivityPublicationPlan,
} from "../../domain/checklist";

export function PublishModal({
  load,
  checklist,
  activityId,
  onClose,
  onPublish,
}: {
  load: TeachingLoad;
  checklist: PerformanceChecklist;
  activityId: string;
  onClose: () => void;
  onPublish: (plan: ActivityPublicationPlan, pin: string) => Promise<void>;
}) {
  const suggestions = checklistActivityTargetSuggestions(checklist, load, activityId);
  const recommended = suggestions.find((item) => item.recommended) || suggestions.find((item) => item.compatible);
  const [assessmentId, setAssessmentId] = useState(recommended?.assessmentId || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pinRequired = hasToolsPin();
  let plan: ActivityPublicationPlan | null = null;
  let planError = "";
  try {
    if (assessmentId) plan = planChecklistActivityPublication(checklist, load, activityId, assessmentId);
  } catch (err) {
    planError = err instanceof Error ? err.message : "Could not plan publication.";
  }

  return (
    <div className="att-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="card att-modal chk-publish" role="dialog" aria-labelledby="chk-pub-title" onClick={(event) => event.stopPropagation()}>
        <div className="att-modal-head">
          <h3 id="chk-pub-title">Publish to WW / PT</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <div className="banner error">{error}</div>}
        <label>
          Official assessment
          <select value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)}>
            <option value="">Choose a column</option>
            {suggestions.map((item) => (
              <option key={item.assessmentId} value={item.assessmentId} disabled={!item.compatible && !item.current}>
                {item.title} · HPS {item.effectiveMax}
                {item.recommended ? " · recommended" : ""}
                {item.linkedElsewhere ? " · linked elsewhere" : ""}
              </option>
            ))}
          </select>
        </label>
        {planError && <div className="banner warn">{planError}</div>}
        {plan && (
          <div className="table-scroll">
            <table className="chk-preview">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Before</th>
                  <th>Checklist</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {plan.changes.map((change) => {
                  const learner = load.learners.find((item) => item.id === change.learnerId);
                  return (
                    <tr key={change.key}>
                      <td>{learner ? learnerDisplayName(learner) : change.learnerId}</td>
                      <td>{change.before.present ? change.before.value : "—"}</td>
                      <td>{change.total}</td>
                      <td>{change.after.present ? change.after.value : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {plan.blocked.length > 0 && (
              <p className="banner warn">
                {plan.blocked.length} learner score{plan.blocked.length === 1 ? "" : "s"} blocked (HPS or newer official scores).
              </p>
            )}
            <p className="muted">
              Publishing writes these points into the grading sheet and locks this activity. HPS cap is {plan.maxScore}.
            </p>
          </div>
        )}
        {pinRequired && (
          <label>
            Confirm with PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
        )}
        <div className="att-modal-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            data-testid="chk-publish-confirm"
            disabled={!plan?.canApply || busy}
            onClick={() => {
              if (!plan) return;
              setBusy(true);
              setError(null);
              void onPublish(plan, pin)
                .catch((err) => setError(err instanceof Error ? err.message : "Could not publish."))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Publishing…" : "Publish to sheet"}
          </button>
        </div>
      </div>
    </div>
  );
}
