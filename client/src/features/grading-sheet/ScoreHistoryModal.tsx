import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";

export function ScoreHistoryModal({
  load,
  term,
  onClose,
}: {
  load: TeachingLoad;
  term: Term;
  onClose: () => void;
}) {
  const rows = (load.scoreHistory || [])
    .filter((entry) => entry.term === term)
    .slice()
    .sort((left, right) => String(right.changedAt || "").localeCompare(String(left.changedAt || "")))
    .slice(0, 80);

  return (
    <div className="att-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="card att-modal" role="dialog" aria-labelledby="hist-title" onClick={(event) => event.stopPropagation()}>
        <div className="att-modal-head">
          <h3 id="hist-title">Score history · Term {term}</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="muted">No score changes recorded for this term yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="chk-preview">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Learner</th>
                  <th>Assessment</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const learner = load.learners.find((item) => item.id === entry.learnerId);
                  const assessment = load.assessments.find((item) => item.id === entry.assessmentId);
                  return (
                    <tr key={entry.id}>
                      <td>{entry.changedAt.replace("T", " ").slice(0, 19)}</td>
                      <td>{learner ? learnerDisplayName(learner) : entry.learnerId}</td>
                      <td>{assessment?.title || entry.assessmentId}</td>
                      <td>{entry.previousValue ?? "—"}</td>
                      <td>{entry.newValue ?? "—"}</td>
                      <td>{entry.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
