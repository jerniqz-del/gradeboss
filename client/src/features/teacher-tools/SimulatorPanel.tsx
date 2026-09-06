import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
  activeLearners,
  applySimulation,
  createSimulationSession,
  draftLoad,
  revertSimulation,
  setSimulationScore,
  simulationChanges,
  scoreState,
} from "../../domain/tools";
import { computeTermResult, isMapehSubject } from "../../domain/grading";
import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { termAssessments } from "../exports/csv";

function gradeValue(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function numericGrade(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function SimulatorPanel({
  load,
  onLoadChange,
}: {
  load: TeachingLoad;
  onLoadChange: (next: TeachingLoad) => void;
}) {
  const mapeh = isMapehSubject(load.subject);
  const [term, setTerm] = useState<Term>("1");
  const [mapePart, setMapePart] = useState<MapePart>("music_arts");
  const [session, setSession] = useState(() => createSimulationSession(load, "1"));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);

  useEffect(() => {
    setSession(createSimulationSession(load, term));
    setConfirmApply(false);
    setError(null);
  }, [load, term]);

  const part = mapeh ? mapePart : undefined;
  const assessments = termAssessments(load, term, part);
  const learners = activeLearners(load);
  const draft = draftLoad(load, session);
  const changes = useMemo(() => simulationChanges(session, load), [session, load]);
  const changedKeys = new Set(changes.map((item) => item.key));
  const affected = new Set(changes.map((item) => item.key.split("|")[0])).size;

  const updateScore = (learnerId: string, assessmentId: string, value: string) => {
    try {
      setSession(setSimulationScore(session, load, learnerId, assessmentId, value));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that score.");
    }
  };

  const applyOfficial = async () => {
    try {
      const applied = applySimulation(session, load);
      const saved = await api.saveTeachingLoad(applied.load);
      onLoadChange(saved);
      setSession(createSimulationSession(saved, term));
      setConfirmApply(false);
      setNotice(`Applied ${applied.history.changes.length} simulated score${applied.history.changes.length === 1 ? "" : "s"}.`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply the simulation.");
    }
  };

  const revert = async (entryId: string) => {
    const entry = (load.simulationHistory || []).find((item) => item.id === entryId);
    if (!entry) return;
    try {
      const result = revertSimulation(entry, load);
      const saved = await api.saveTeachingLoad(result.load);
      onLoadChange(saved);
      setSession(createSimulationSession(saved, term));
      setNotice(result.kept.length ? "Simulation partially reverted." : "Simulation reverted.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revert that simulation.");
    }
  };

  return (
    <div className="tools-panel">
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}
      <div className="tools-controls">
        <div className="sheet-tabs" role="tablist" aria-label="Term">
          {(["1", "2", "3"] as const).map((id) => (
            <button key={id} type="button" className={term === id ? "sheet-tab active" : "sheet-tab"} onClick={() => setTerm(id)}>
              Term {id}
            </button>
          ))}
        </div>
        {mapeh && (
          <div className="sheet-tabs mapeh" role="tablist" aria-label="MAPEH part">
            <button type="button" className={mapePart === "music_arts" ? "sheet-tab active" : "sheet-tab"} onClick={() => setMapePart("music_arts")}>
              Music &amp; Arts
            </button>
            <button type="button" className={mapePart === "pe_health" ? "sheet-tab active" : "sheet-tab"} onClick={() => setMapePart("pe_health")}>
              PE &amp; Health
            </button>
          </div>
        )}
        <div className="tools-actions">
          <button
            type="button"
            className="ghost"
            disabled={!changes.length}
            onClick={() => {
              setSession(createSimulationSession(load, term));
              setConfirmApply(false);
            }}
          >
            Reset preview
          </button>
          <button type="button" className="primary" disabled={!changes.length} onClick={() => setConfirmApply(true)}>
            Apply to official record
          </button>
        </div>
      </div>
      <div className="simulator-summary">
        <div>
          <span className="muted">Changed scores</span>
          <strong>{changes.length}</strong>
        </div>
        <div>
          <span className="muted">Affected learners</span>
          <strong>{affected}</strong>
        </div>
        <div>
          <span className="muted">Selected term</span>
          <strong>Term {term}</strong>
        </div>
      </div>
      {confirmApply && (
        <div className="banner">
          Apply {changes.length} simulated score{changes.length === 1 ? "" : "s"} to the official record?
          <div className="tools-actions">
            <button type="button" className="primary" onClick={() => void applyOfficial()}>
              Apply
            </button>
            <button type="button" className="ghost" onClick={() => setConfirmApply(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {!assessments.length ? (
        <p className="muted">This class has no assessments in the selected term.</p>
      ) : (
        <div className="simulator-table-wrap">
          <table className="simulator-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>
                  <div className="simulator-score-grid simulator-score-grid--header">
                    {assessments.map((assessment) => (
                      <div key={assessment.id} className="simulator-score-slot">
                        <span className="simulator-assessment-title">{assessment.title}</span>
                        <span className="muted">HPS {Number(assessment.maxScore) > 0 ? assessment.maxScore : "—"}</span>
                      </div>
                    ))}
                  </div>
                </th>
                <th>Grade preview</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => {
                const officialResult = computeTermResult(load, learner.id, term, part);
                const simulatedResult = computeTermResult(draft, learner.id, term, part);
                const officialNumeric = numericGrade(officialResult.termGrade);
                const simulatedNumeric = numericGrade(simulatedResult.termGrade);
                const delta =
                  officialNumeric === null || simulatedNumeric === null ? null : simulatedNumeric - officialNumeric;
                return (
                  <tr key={learner.id}>
                    <td>
                      <span className="group-learner">
                        <LearnerAvatar presetId={learner.avatarPresetId} size="sm" />
                        {learnerDisplayName(learner)}
                      </span>
                    </td>
                    <td>
                      <div className="simulator-score-grid">
                        {assessments.map((assessment) => {
                          const key = scoreKey(learner.id, assessment.id);
                          const official = scoreState(load.scores, key);
                          const simulated = scoreState(session.draftScores, key);
                          const maxScore = Number(assessment.maxScore);
                          const hasHps = Number.isFinite(maxScore) && maxScore > 0;
                          return (
                            <label key={assessment.id} className={changedKeys.has(key) ? "simulator-score-slot is-changed" : "simulator-score-slot"}>
                              <input
                                className="simulator-score"
                                type="number"
                                min={0}
                                max={hasHps ? maxScore : undefined}
                                step="any"
                                value={simulated.present ? String(simulated.value) : ""}
                                disabled={!hasHps}
                                placeholder={hasHps ? "" : "Set HPS"}
                                aria-label={`${learnerDisplayName(learner)}, ${assessment.title}`}
                                onChange={(event) => updateScore(learner.id, assessment.id, event.target.value)}
                              />
                              {changedKeys.has(key) && (
                                <span className="muted">was {official.present ? official.value : "blank"}</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="simulator-grade-preview">
                        <span>
                          <small>Official</small>
                          <strong>{gradeValue(officialResult.termGrade)}</strong>
                        </span>
                        <span>
                          <small>Simulated</small>
                          <strong>{gradeValue(simulatedResult.termGrade)}</strong>
                        </span>
                        <span className={delta && delta > 0 ? "up" : delta && delta < 0 ? "down" : ""}>
                          <small>Difference</small>
                          <strong>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}</strong>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <section className="simulator-history">
        <h3>Applied simulation history</h3>
        {(load.simulationHistory || []).length === 0 ? (
          <p className="muted">No applied simulations yet.</p>
        ) : (
          <ul>
            {(load.simulationHistory || []).map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>Term {entry.term}</strong>
                  <span className="muted">
                    {" "}
                    · {entry.changes.length} change{entry.changes.length === 1 ? "" : "s"} · {entry.status}
                  </span>
                </div>
                {entry.status === "applied" && (
                  <button type="button" className="ghost" onClick={() => void revert(entry.id)}>
                    Revert
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
