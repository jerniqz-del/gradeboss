import { learnerDisplayName } from "../../models/learner";
import type { PerformanceChecklist } from "../../models/checklist";
import type { TeachingLoad } from "../../models/teaching-load";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { sortDepEdRoster } from "../roster/sort";
import { checklistActivityDefinition, checklistEntry, isChecklistActivityPublished, visibleSessions } from "../../domain/checklist";

export function ChecklistGrid({
  load,
  checklist,
  query,
  onNudge,
  onSetPoints,
  onEditNote,
}: {
  load: TeachingLoad;
  checklist: PerformanceChecklist;
  query: string;
  onNudge: (sessionId: string, learnerId: string, criterionId: string, delta: number) => void;
  onSetPoints: (sessionId: string, learnerId: string, criterionId: string, value: number | "") => void;
  onEditNote: (sessionId: string, learnerId: string, criterionId: string, note: string) => void;
}) {
  const sessions = visibleSessions(checklist);
  const needle = query.trim().toLowerCase();
  const learners = sortDepEdRoster(load.learners).filter((learner) => {
    if (!needle) return true;
    return learnerDisplayName(learner).toLowerCase().includes(needle) || learner.lrn.includes(needle);
  });

  return (
    <div className="table-scroll sheet-scroll">
      <table className="sheet-table chk-table">
        <thead>
          <tr>
            <th className="sheet-sticky">Learner</th>
            {sessions.map((session) => {
              const activity = checklistActivityDefinition(checklist, session);
              const published = isChecklistActivityPublished(session);
              return (
                <th key={session.id}>
                  <div className="chk-col-head">
                    <strong>{activity?.title || session.title}</strong>
                    <span className="muted">
                      {session.date} · {activity?.destinationComponent || "TRACKING"} · HPS {activity?.maxPointsPerSession ?? "—"}
                    </span>
                    {published ? <span className="pill">Published</span> : null}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {learners.map((learner) => (
            <tr key={learner.id} className={learner.transferredOutTerm ? "transferred-out" : undefined}>
              <th className="sheet-sticky sheet-name">
                <span className="sheet-learner">
                  <LearnerAvatar presetId={learner.avatarPresetId} size="xs" />
                  <span>
                    {learnerDisplayName(learner)}
                    {learner.transferredOutTerm ? <span className="pill">T/O</span> : null}
                  </span>
                </span>
              </th>
              {sessions.map((session) => {
                const activity = checklistActivityDefinition(checklist, session);
                const criterionId = activity?.criterionId || "";
                const entry = checklistEntry(checklist, session.id, learner.id, criterionId);
                const published = isChecklistActivityPublished(session);
                const max = activity?.maxPointsPerSession ?? 0;
                return (
                  <td key={session.id}>
                    <div className="chk-cell">
                      <button
                        type="button"
                        className="chk-step"
                        aria-label={`Decrease ${learnerDisplayName(learner)} ${activity?.title || ""}`}
                        disabled={published || Boolean(learner.transferredOutTerm) || !entry || entry.points <= 0}
                        onClick={() => onNudge(session.id, learner.id, criterionId, -1)}
                      >
                        −
                      </button>
                      <input
                        className="score-input"
                        inputMode="decimal"
                        aria-label={`${learnerDisplayName(learner)} ${activity?.title || "activity"}`}
                        value={entry ? entry.points : ""}
                        disabled={published || Boolean(learner.transferredOutTerm)}
                        onChange={(event) => {
                          const raw = event.target.value.trim();
                          onSetPoints(session.id, learner.id, criterionId, raw === "" ? "" : Number(raw));
                        }}
                      />
                      <button
                        type="button"
                        className="chk-step"
                        aria-label={`Increase ${learnerDisplayName(learner)} ${activity?.title || ""}`}
                        disabled={published || Boolean(learner.transferredOutTerm) || (entry?.points ?? 0) >= max}
                        onClick={() => onNudge(session.id, learner.id, criterionId, 1)}
                      >
                        +
                      </button>
                    </div>
                    {activity?.allowNotes || entry?.note ? (
                      <input
                        className="chk-note"
                        placeholder="Note"
                        aria-label={`${learnerDisplayName(learner)} note`}
                        value={entry?.note || ""}
                        disabled={published}
                        onChange={(event) => onEditNote(session.id, learner.id, criterionId, event.target.value)}
                      />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
          {learners.length === 0 && (
            <tr>
              <td colSpan={sessions.length + 1} className="muted center">
                No learners match this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
