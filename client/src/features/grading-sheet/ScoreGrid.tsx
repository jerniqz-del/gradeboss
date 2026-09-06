import { useMemo } from "react";
import { computeTermResult, formatInitialGrade } from "../../domain/grading";
import { descriptor } from "../../domain/grading/transmutation";
import type { Assessment } from "../../models/assessment";
import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { learnerNameCaps } from "../shell/labels";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { sortDepEdRoster } from "../roster/sort";
import { gradeTone } from "./grade-tone";

export function ScoreGrid({
  load,
  term,
  mapePart,
  onScoreChange,
  onHpsChange,
}: {
  load: TeachingLoad;
  term: Term;
  mapePart?: MapePart;
  onScoreChange: (learnerId: string, assessmentId: string, value: number | "") => void;
  onHpsChange: (assessmentId: string, maxScore: number) => void;
}) {
  const columns = useMemo(
    () =>
      load.assessments.filter((item) => {
        if (item.term !== term) return false;
        if (mapePart) return item.mapePart === mapePart;
        return !item.mapePart;
      }),
    [load.assessments, mapePart, term],
  );

  const groups = useMemo(() => {
    const ww = columns.filter((c) => c.component === "WW");
    const pt = columns.filter((c) => c.component === "PT");
    const exam = columns.filter((c) => ["ST1", "ST2", "TE"].includes(c.component));
    return { ww, pt, exam };
  }, [columns]);

  const learners = useMemo(() => sortDepEdRoster(load.learners), [load.learners]);
  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-score-cell="${row}-${col}"]`);
    el?.focus();
    el?.select();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const maxRow = learners.length;
    const maxCol = columns.length - 1;
    if (event.key === "ArrowRight" && col < maxCol) {
      event.preventDefault();
      focusCell(row, col + 1);
    } else if (event.key === "ArrowLeft" && col > 0) {
      event.preventDefault();
      focusCell(row, col - 1);
    } else if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      if (row < maxRow) focusCell(row + 1, col);
    } else if (event.key === "ArrowUp" && row > 0) {
      event.preventDefault();
      focusCell(row - 1, col);
    }
  };

  const parseCell = (raw: string): number | "" => {
    const trimmed = raw.trim();
    if (trimmed === "") return "";
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : "";
  };

  const renderGroup = (items: Assessment[], label: string) =>
    items.length === 0 ? null : (
      <th colSpan={items.length} className="sheet-group">
        {label}
      </th>
    );

  return (
    <div className="table-scroll sheet-scroll">
      <table className="sheet-table">
        <thead>
          <tr>
            <th className="sheet-sticky" rowSpan={2}>
              No.
            </th>
            <th className="sheet-sticky" rowSpan={2}>
              Learner
            </th>
            <th rowSpan={2}>Sex</th>
            {renderGroup(groups.ww, "Written Works")}
            {renderGroup(groups.pt, "Performance Tasks")}
            {renderGroup(groups.exam, "Quarterly Assessment")}
            <th colSpan={3} className="sheet-group">
              PS
            </th>
            <th className="sheet-group" rowSpan={2}>
              IG
            </th>
            <th className="sheet-group" rowSpan={2}>
              TG
            </th>
            <th className="sheet-group" rowSpan={2}>
              Desc.
            </th>
          </tr>
          <tr>
            {columns.map((col) => (
              <th key={col.id}>{col.title}</th>
            ))}
            <th>WW</th>
            <th>PT</th>
            <th>Exam</th>
          </tr>
        </thead>
        <tbody>
          <tr className="sheet-hps">
            <th className="sheet-sticky" colSpan={2}>
              HPS
            </th>
            <td />
            {columns.map((col, colIndex) => (
              <td key={col.id}>
                <input
                  className="score-input"
                  inputMode="decimal"
                  data-score-cell={`0-${colIndex}`}
                  aria-label={`${col.title} highest possible score`}
                  value={col.maxScore || ""}
                  onChange={(e) => onHpsChange(col.id, Number(e.target.value) || 0)}
                  onKeyDown={(e) => onKeyDown(e, 0, colIndex)}
                />
              </td>
            ))}
            <td colSpan={6} className="muted">
              Highest possible score
            </td>
          </tr>
          {learners.map((learner, rowIndex) => {
            const result = computeTermResult(load, learner.id, term, mapePart);
            const row = rowIndex + 1;
            return (
              <tr key={learner.id}>
                <td className="sheet-sticky">{rowIndex + 1}</td>
                <th className="sheet-sticky sheet-name">
                  <span className="sheet-learner">
                    <LearnerAvatar presetId={learner.avatarPresetId} size="xs" />
                    <span>
                      {learnerNameCaps(learnerDisplayName(learner))}
                      {learner.transferredOutTerm ? <span className="pill">T/O</span> : null}
                    </span>
                  </span>
                </th>
                <td>{learner.sex || "—"}</td>
                {columns.map((col, colIndex) => {
                  const key = scoreKey(learner.id, col.id);
                  const value = load.scores[key];
                  return (
                    <td key={col.id}>
                      <input
                        className="score-input"
                        inputMode="decimal"
                        data-score-cell={`${row}-${colIndex}`}
                        aria-label={`${learnerDisplayName(learner)} ${col.title}`}
                        value={value === undefined ? "" : value}
                        onChange={(e) => onScoreChange(learner.id, col.id, parseCell(e.target.value))}
                        onKeyDown={(e) => onKeyDown(e, row, colIndex)}
                      />
                    </td>
                  );
                })}
                <td className="sheet-computed">{result.hasData ? formatInitialGrade(result.ww.ps) : ""}</td>
                <td className="sheet-computed">{result.hasData ? formatInitialGrade(result.pt.ps) : ""}</td>
                <td className="sheet-computed">{result.hasData ? formatInitialGrade(result.examPS) : ""}</td>
                <td className="sheet-computed">
                  {result.hasData ? formatInitialGrade(result.initialGrade) : ""}
                </td>
                <td>
                  {result.termGrade === null || result.termGrade === undefined ? (
                    ""
                  ) : (
                    <span className="badge" style={{ background: gradeTone(result.termGrade) }}>
                      {String(result.termGrade)}
                    </span>
                  )}
                </td>
                <td className="sheet-computed">{result.hasData ? descriptor(result.termGrade) : ""}</td>
              </tr>
            );
          })}
          {learners.length === 0 && (
            <tr>
              <td colSpan={columns.length + 9} className="muted center">
                Add learners from the roster panel to start entering scores.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
