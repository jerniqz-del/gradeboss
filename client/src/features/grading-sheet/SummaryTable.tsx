import { computeClassYearResults, type TermGrade } from "../../domain/grading";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { sortDepEdRoster } from "../roster/sort";
import { gradeTone } from "./grade-tone";

function GradeCell({
  grade,
  display,
  descriptor,
  emphasize = false,
  showDescriptor = false,
}: {
  grade: TermGrade | null;
  display: string;
  descriptor: string;
  emphasize?: boolean;
  showDescriptor?: boolean;
}) {
  if (grade === null) return <span className="muted">—</span>;
  return (
    <span className={emphasize ? "summary-grade summary-grade--final" : "summary-grade"}>
      <span className="badge" style={{ background: gradeTone(grade) }}>
        {display || String(grade)}
      </span>
      {showDescriptor && descriptor ? <span className="summary-desc">{descriptor}</span> : null}
    </span>
  );
}

export function SummaryTable({ load }: { load: TeachingLoad }) {
  const descriptive = load.policy === "DO15_DESCRIPTIVE";
  const byId = new Map(computeClassYearResults(load).map((row) => [row.learnerId, row]));
  const rows = sortDepEdRoster(load.learners).map((learner) => ({
    learner,
    year: byId.get(learner.id),
  }));

  return (
    <div className="table-scroll sheet-scroll">
      <table className="summary-table">
        <thead>
          <tr>
            <th>Learner</th>
            <th>Term 1</th>
            <th>Term 2</th>
            <th>Term 3</th>
            <th>Final</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ learner, year }) => {
            if (!year) return null;
            return (
              <tr key={learner.id}>
                <td>
                  <span className="sheet-learner">
                    <LearnerAvatar presetId={learner.avatarPresetId} size="xs" />
                    <span>
                      {learnerDisplayName(learner)}
                      {learner.transferredOutTerm ? <span className="pill">T/O</span> : null}
                    </span>
                  </span>
                </td>
                {year.terms.map((term) => (
                  <td key={term.term}>
                    <GradeCell
                      grade={term.grade}
                      display={term.display}
                      descriptor={term.descriptor}
                      showDescriptor={descriptive && term.grade !== null && term.grade !== "T/O"}
                    />
                  </td>
                ))}
                <td>
                  <GradeCell
                    grade={year.annualGrade}
                    display={year.annualDisplay}
                    descriptor={year.annualDescriptor}
                    emphasize
                    showDescriptor={year.annualGrade !== null && year.annualGrade !== "T/O"}
                  />
                </td>
                <td>
                  {year.passed === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className={year.passed ? "status-badge pass" : "status-badge fail"}>
                      {year.passed ? "Passed" : "Failed"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="muted center">
                Add learners from the roster panel to see term finals.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
