import { FitSheet } from "./FitSheet";
import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { computeTermResult, formatInitialGrade } from "../../domain/grading";
import { descriptor } from "../../domain/grading/transmutation";
import { weightsForLoad, examinationComponentsForLoad } from "../../domain/grading/weights";
import { examinationHasData } from "../../domain/grading/components";
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
  const assessments = useMemo(
    () =>
      load.assessments.filter((item) => {
        if (item.term !== term) return false;
        if (mapePart) return item.mapePart === mapePart;
        return !item.mapePart;
      }),
    [load.assessments, mapePart, term],
  );

  const groups = useMemo(() => {
    const weights = weightsForLoad(load);
    return [
      { key: "ww" as const, label: "Written Works", items: assessments.filter((item) => item.component === "WW"), weight: weights[0] },
      { key: "pt" as const, label: "Performance Tasks", items: assessments.filter((item) => item.component === "PT"), weight: weights[1] },
      { key: "qa" as const, label: "Quarterly Assessment", items: assessments.filter((item) => ["ST1", "ST2", "TE"].includes(item.component)), weight: weights[2] },
    ];
  }, [assessments, load]);
  const columns = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const learners = useMemo(() => sortDepEdRoster(load.learners), [load.learners]);
  const tableRef = useRef<HTMLTableElement>(null);
  const [learnerColumnWidth, setLearnerColumnWidth] = useState(132);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const contents = Array.from(table.querySelectorAll<HTMLElement>(".sheet-learner"));
    const measure = () => {
      const width = contents.reduce((longest, content) => {
        const cell = content.closest("th")!;
        const style = getComputedStyle(cell);
        const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const borders = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        return Math.max(longest, content.offsetWidth + padding + borders);
      }, 132);
      setLearnerColumnWidth(Math.ceil(width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    contents.forEach((content) => observer.observe(content));
    return () => observer.disconnect();
  }, [learners]);

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


  const numericColumns = columns.length + groups.length * 3 + 2;

  return (
    <FitSheet minimumWidth={180 + learnerColumnWidth + numericColumns * 56}>
      <table ref={tableRef} className="sheet-table">
        <colgroup>
          <col style={{ width: 40 }} />
          <col style={{ width: learnerColumnWidth }} />
          <col style={{ width: 44 }} />
          <col span={numericColumns} />
          <col style={{ width: 96 }} />
        </colgroup>
        <thead>
          <tr>
            <th className="sheet-sticky sheet-number" rowSpan={2}>No.</th>
            <th className="sheet-sticky sheet-learner-column" rowSpan={2}>Learner</th>
            <th rowSpan={2}>Sex</th>
            {groups.map((group) => <th key={group.key} colSpan={group.items.length + 3} className={`sheet-group sheet-group--${group.key}`}>{group.label}</th>)}
            <th rowSpan={2} title="Initial Grade">IG</th>
            <th rowSpan={2} title="Transmuted Grade">TG</th>
            <th rowSpan={2}>Desc.</th>
          </tr>
          <tr>
            {groups.map((group) => <Fragment key={group.key}>
              {group.items.map((col, index) => <th key={col.id} title={col.title} aria-label={col.title} className={`sheet-col--${group.key}${activeCell?.col === columns.findIndex((item) => item.id === col.id) ? " sheet-active-column" : ""}`}>
                {group.key === "ww" ? `WW${index + 1}` : group.key === "pt" ? `PT${index + 1}` : col.component}
              </th>)}
              <th className={`sheet-col--${group.key}`} title="Total">T</th>
              <th className={`sheet-col--${group.key}`} title="Percentage">%</th>
              <th className={`sheet-col--${group.key}`} title="Weighted Score">WS</th>
            </Fragment>)}
          </tr>
        </thead>
        <tbody>
          <tr className={`sheet-hps${activeCell?.row === 0 ? " sheet-active-row" : ""}`}>
            <th className="sheet-sticky" colSpan={3}>Highest Possible Score</th>
            {groups.map((group) => <Fragment key={group.key}>
              {group.items.map((col) => {
                const colIndex = columns.findIndex((item) => item.id === col.id);
                return <td key={col.id} className={activeCell?.col === colIndex ? "sheet-active-column" : undefined}> 
                  <input className="score-input" inputMode="decimal"
                    data-score-cell={`0-${colIndex}`} aria-label={`${col.title} highest possible score`}
                    value={col.maxScore || ""}
                    onFocus={() => setActiveCell({ row: 0, col: colIndex })}
                    onBlur={() => setActiveCell(null)}
                    onChange={(event) => onHpsChange(col.id, Number(event.target.value) || 0)}
                    onKeyDown={(event) => onKeyDown(event, 0, colIndex)} />
                </td>;
              })}
              <td className="sheet-computed">{formatInitialGrade(group.items.reduce((sum, item) => sum + Math.max(0, item.maxScore || 0), 0))}</td>
              <td className="sheet-computed">100</td>
              <td className="sheet-computed">{group.weight}%</td>
            </Fragment>)}
            <td /><td /><td />
          </tr>
          {learners.map((learner, rowIndex) => {
            const result = computeTermResult(load, learner.id, term, mapePart);
            const row = rowIndex + 1;
            return <tr key={learner.id} className={activeCell?.row === row ? "sheet-active-row" : undefined}>
              <td className="sheet-sticky sheet-number">{row}</td>
              <th className="sheet-sticky sheet-learner-column sheet-name" scope="row">
                <span className="sheet-learner">
                  <LearnerAvatar presetId={learner.avatarPresetId} size="xs" />
                  <span className="sheet-name-lines">
                    <strong>{learnerNameCaps(learner.lastName.trim())}</strong>
                    <span>{learnerNameCaps([
                      learner.firstName.trim(), learner.extensionName?.trim(),
                      learner.middleName.trim() ? learner.middleName.trim().charAt(0) + "." : "",
                    ].filter(Boolean).join(" "))}</span>
                    {learner.transferredOutTerm ? <span className="pill">T/O</span> : null}
                  </span>
                </span>
              </th>
              <td>{learner.sex || "—"}</td>
              {groups.map((group) => {
                const stats = group.key === "ww" ? result.ww : group.key === "pt" ? result.pt : {
                  raw: result.st1.raw + result.st2.raw + result.te.raw,
                  ps: result.examPS,
                  hasData: examinationHasData(result.st1, result.st2, result.te, examinationComponentsForLoad(load)),
                };
                return <Fragment key={group.key}>
                  {group.items.map((col) => {
                    const colIndex = columns.findIndex((item) => item.id === col.id);
                    const value = load.scores[scoreKey(learner.id, col.id)];
                    return <td key={col.id} className={activeCell?.col === colIndex ? "sheet-active-column" : undefined}>
                      <input className="score-input" inputMode="decimal"
                        data-score-cell={`${row}-${colIndex}`} aria-label={`${learnerDisplayName(learner)} ${col.title}`}
                        value={value === undefined ? "" : value}
                        onFocus={() => setActiveCell({ row, col: colIndex })}
                        onBlur={() => setActiveCell(null)}
                        onChange={(event) => onScoreChange(learner.id, col.id, parseCell(event.target.value))}
                        onKeyDown={(event) => onKeyDown(event, row, colIndex)} />
                    </td>;
                  })}
                  <td className={`sheet-computed sheet-col--${group.key}`}>{stats.hasData ? formatInitialGrade(stats.raw) : ""}</td>
                  <td className={`sheet-computed sheet-col--${group.key}`}>{stats.hasData ? formatInitialGrade(stats.ps) : ""}</td>
                  <td className={`sheet-computed sheet-col--${group.key}`}>{stats.hasData ? formatInitialGrade(stats.ps * group.weight / 100) : ""}</td>
                </Fragment>;
              })}
              <td className="sheet-computed">{result.hasData ? formatInitialGrade(result.initialGrade) : ""}</td>
              <td>{result.termGrade === null || result.termGrade === undefined ? "" :
                <span className="badge" style={{ background: gradeTone(result.termGrade) }}>{String(result.termGrade)}</span>}
              </td>
              <td className="sheet-computed">{result.hasData ? descriptor(result.termGrade) : ""}</td>
            </tr>;
          })}
          {learners.length === 0 && <tr>
            <td colSpan={numericColumns + 4} className="muted center">Add learners from the roster panel to start entering scores.</td>
          </tr>}
        </tbody>
      </table>
    </FitSheet>
  );
}
