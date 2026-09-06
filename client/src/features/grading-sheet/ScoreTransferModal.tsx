import { useMemo, useState } from "react";
import { learnerDisplayName } from "../../models/learner";
import type { Assessment } from "../../models/assessment";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { applyScoreTransfer, buildScoreTransferPreview } from "../../domain/scores";
import { isMapehSubject } from "../../domain/grading";

function termAssessments(load: TeachingLoad, term: Term, mapePart?: MapePart): Assessment[] {
  return load.assessments.filter((item) => {
    if (item.term !== term) return false;
    if (mapePart) return item.mapePart === mapePart;
    return !item.mapePart;
  });
}

export function ScoreTransferModal({
  loads,
  current,
  term,
  mapePart,
  onClose,
  onApply,
}: {
  loads: TeachingLoad[];
  current: TeachingLoad;
  term: Term;
  mapePart?: MapePart;
  onClose: () => void;
  onApply: (source: TeachingLoad, target: TeachingLoad) => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(current.id);
  const [targetId, setTargetId] = useState(current.id);
  const source = loads.find((item) => item.id === sourceId) || current;
  const target = loads.find((item) => item.id === targetId) || current;
  const [sourceTerm, setSourceTerm] = useState<Term>(term);
  const [targetTerm, setTargetTerm] = useState<Term>(term);
  const sourcePart = isMapehSubject(source.subject) ? mapePart : undefined;
  const targetPart = isMapehSubject(target.subject) ? mapePart : undefined;
  const sourceItems = termAssessments(source, sourceTerm, sourcePart);
  const targetItems = termAssessments(target, targetTerm, targetPart);
  const [sourceAssessmentId, setSourceAssessmentId] = useState(sourceItems[0]?.id || "");
  const [targetAssessmentId, setTargetAssessmentId] = useState(targetItems[0]?.id || "");
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [conflictMode, setConflictMode] = useState<"skip" | "overwrite">("skip");
  const [copyHps, setCopyHps] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sourceAssessment = sourceItems.find((item) => item.id === sourceAssessmentId) || sourceItems[0];
  const targetAssessment = targetItems.find((item) => item.id === targetAssessmentId) || targetItems[0];

  const preview = useMemo(() => {
    if (!sourceAssessment || !targetAssessment) {
      return null;
    }
    return buildScoreTransferPreview({
      source,
      target,
      sourceAssessment,
      targetAssessment,
      mode,
      conflictMode,
      copyHps,
    });
  }, [conflictMode, copyHps, mode, source, sourceAssessment, target, targetAssessment]);

  return (
    <div className="att-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="card att-modal xfer-modal" role="dialog" aria-labelledby="xfer-title" onClick={(event) => event.stopPropagation()}>
        <div className="att-modal-head">
          <h3 id="xfer-title">Transfer scores</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <div className="banner error">{error}</div>}
        <div className="xfer-grid">
          <label>
            Source class
            <select value={source.id} onChange={(event) => setSourceId(event.target.value)}>
              {loads.map((item) => (
                <option key={item.id} value={item.id}>
                  G{item.gradeLevel} {item.section} — {item.subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target class
            <select value={target.id} onChange={(event) => setTargetId(event.target.value)}>
              {loads.map((item) => (
                <option key={item.id} value={item.id}>
                  G{item.gradeLevel} {item.section} — {item.subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source term
            <select value={sourceTerm} onChange={(event) => setSourceTerm(event.target.value as Term)}>
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </label>
          <label>
            Target term
            <select value={targetTerm} onChange={(event) => setTargetTerm(event.target.value as Term)}>
              <option value="1">Term 1</option>
              <option value="2">Term 2</option>
              <option value="3">Term 3</option>
            </select>
          </label>
          <label>
            Source assessment
            <select value={sourceAssessment?.id || ""} onChange={(event) => setSourceAssessmentId(event.target.value)}>
              {sourceItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.component} {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target assessment
            <select value={targetAssessment?.id || ""} onChange={(event) => setTargetAssessmentId(event.target.value)}>
              {targetItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.component} {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as "copy" | "move")}>
              <option value="copy">Copy (keep source)</option>
              <option value="move">Move (clear source)</option>
            </select>
          </label>
          <label>
            If target has a score
            <select value={conflictMode} onChange={(event) => setConflictMode(event.target.value as "skip" | "overwrite")}>
              <option value="skip">Skip</option>
              <option value="overwrite">Overwrite</option>
            </select>
          </label>
        </div>
        <label className="chk-check">
          <input type="checkbox" checked={copyHps} onChange={(event) => setCopyHps(event.target.checked)} />
          Copy HPS when the target HPS is blank
        </label>
        {preview && (
          <>
            {!preview.valid && <div className="banner warn">{preview.error}</div>}
            {preview.valid && (
              <p className="muted">
                {preview.transferable.length} ready, {preview.conflicts.length} conflict{preview.conflicts.length === 1 ? "" : "s"}, {preview.unmatched.length} unmatched, {preview.blankSource} blank.
                {preview.hpsWarning ? ` ${preview.hpsWarning}` : ""}
              </p>
            )}
            <div className="table-scroll">
              <table className="chk-preview">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Target</th>
                    <th>Match</th>
                    <th>From</th>
                    <th>Now</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 40).map((row) => (
                    <tr key={`${row.sourceLearner.id}-${row.targetLearner?.id || "none"}`}>
                      <td>{learnerDisplayName(row.sourceLearner)}</td>
                      <td>{row.targetLearner ? learnerDisplayName(row.targetLearner) : "—"}</td>
                      <td>{row.matchType || "—"}</td>
                      <td>{row.sourceValue === "" ? "—" : row.sourceValue}</td>
                      <td>{row.targetValue === "" ? "—" : row.targetValue}</td>
                      <td>{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="att-modal-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={!preview?.valid || !preview.transferable.length || busy}
            onClick={() => {
              if (!preview || !sourceAssessment || !targetAssessment) return;
              setBusy(true);
              setError(null);
              try {
                const result = applyScoreTransfer(
                  { source, target, sourceAssessment, targetAssessment, mode, conflictMode, copyHps },
                  preview,
                );
                void onApply(result.source, result.target)
                  .then(onClose)
                  .catch((err) => setError(err instanceof Error ? err.message : "Could not transfer scores."))
                  .finally(() => setBusy(false));
              } catch (err) {
                setBusy(false);
                setError(err instanceof Error ? err.message : "Could not transfer scores.");
              }
            }}
          >
            {busy ? "Applying…" : `Apply ${preview?.transferable.length || 0} score(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
