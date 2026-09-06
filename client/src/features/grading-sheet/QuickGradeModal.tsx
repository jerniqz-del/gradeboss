import { useEffect, useMemo, useState } from "react";
import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { Assessment } from "../../models/assessment";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { sortDepEdRoster } from "../roster/sort";

export function QuickGradeModal({
  load,
  term,
  mapePart,
  initialAssessmentId,
  initialLearnerId,
  onClose,
  onScoreChange,
}: {
  load: TeachingLoad;
  term: Term;
  mapePart?: MapePart;
  initialAssessmentId?: string;
  initialLearnerId?: string;
  onClose: () => void;
  onScoreChange: (learnerId: string, assessmentId: string, value: number | "") => void;
}) {
  const assessments = useMemo(
    () =>
      load.assessments.filter((item) => {
        if (item.term !== term) return false;
        if (mapePart) return item.mapePart === mapePart;
        return !item.mapePart;
      }),
    [load.assessments, mapePart, term],
  );
  const learners = useMemo(() => sortDepEdRoster(load.learners).filter((item) => !item.transferredOutTerm), [load.learners]);
  const [assessmentId, setAssessmentId] = useState(initialAssessmentId && assessments.some((item) => item.id === initialAssessmentId) ? initialAssessmentId : assessments[0]?.id || "");
  const [index, setIndex] = useState(() => {
    const found = learners.findIndex((item) => item.id === initialLearnerId);
    return found >= 0 ? found : 0;
  });
  const [query, setQuery] = useState("");
  const assessment = assessments.find((item) => item.id === assessmentId) || assessments[0];
  const learner = learners[index];
  const key = learner && assessment ? scoreKey(learner.id, assessment.id) : "";
  const current = key ? load.scores[key] : "";
  const [draft, setDraft] = useState(current === undefined || current === "" ? "" : String(current));

  useEffect(() => {
    setDraft(current === undefined || current === "" ? "" : String(current));
  }, [current, key]);

  const commit = (raw: string) => {
    if (!learner || !assessment) return;
    const trimmed = raw.trim();
    if (trimmed === "") {
      onScoreChange(learner.id, assessment.id, "");
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) return;
    if (assessment.maxScore > 0 && value > assessment.maxScore) return;
    onScoreChange(learner.id, assessment.id, value);
  };

  const go = (nextIndex: number) => {
    commit(draft);
    if (!learners.length) return;
    const wrapped = (nextIndex + learners.length) % learners.length;
    setIndex(wrapped);
  };

  const filtered = learners.filter((item) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return learnerDisplayName(item).toLowerCase().includes(needle) || item.lrn.includes(needle);
  });

  return (
    <div className="att-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="card att-modal qg-modal" role="dialog" aria-labelledby="qg-title" onClick={(event) => event.stopPropagation()}>
        <div className="att-modal-head">
          <h3 id="qg-title">Quick grade</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <label>
          Assessment
          <select
            value={assessment?.id || ""}
            onChange={(event) => {
              commit(draft);
              setAssessmentId(event.target.value);
            }}
          >
            {assessments.map((item) => (
              <option key={item.id} value={item.id}>
                {assessmentLabel(item)} (HPS {item.maxScore || "not set"})
              </option>
            ))}
          </select>
        </label>
        {learner && assessment && (
          <div className="qg-card">
            <LearnerAvatar presetId={learner.avatarPresetId} size="lg" />
            <div>
              <strong>{learnerDisplayName(learner)}</strong>
              <p className="muted">
                {index + 1} of {learners.length} · {assessment.title} / {assessment.maxScore || "—"}
              </p>
            </div>
            <input
              className="qg-score"
              inputMode="decimal"
              aria-label={`Score for ${learnerDisplayName(learner)}`}
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => commit(draft)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "ArrowDown") {
                  event.preventDefault();
                  go(index + 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  go(index - 1);
                } else if (event.key === "Escape") {
                  onClose();
                }
              }}
            />
          </div>
        )}
        <label>
          Jump to learner
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or LRN" />
        </label>
        <ul className="qg-roster">
          {filtered.map((item) => {
            const score = assessment ? load.scores[scoreKey(item.id, assessment.id)] : "";
            const active = item.id === learner?.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={active ? "qg-roster-btn active" : "qg-roster-btn"}
                  onClick={() => {
                    commit(draft);
                    setIndex(learners.findIndex((row) => row.id === item.id));
                    setQuery("");
                  }}
                >
                  <span>{learnerDisplayName(item)}</span>
                  <span>{score === undefined || score === "" ? "—" : score}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="att-modal-foot">
          <button type="button" className="ghost" onClick={() => go(index - 1)} disabled={!learners.length}>
            Previous
          </button>
          <button type="button" className="primary" onClick={() => go(index + 1)} disabled={!learners.length}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function assessmentLabel(item: Assessment): string {
  const names: Record<string, string> = {
    WW: "Written Work",
    PT: "Performance Task",
    ST1: "Summative Test 1",
    ST2: "Summative Test 2",
    TE: "Term Examination",
  };
  const component = names[item.component] || item.component;
  const title = (item.title || "").trim();
  if (!title || title.toUpperCase() === item.component) return component;
  return `${component} ${title}`;
}
