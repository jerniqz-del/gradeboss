import { useMemo, useState } from "react";
import type { AdvisoryClass, AdvisoryGrade, AdvisoryLearner, AdvisorySubject } from "../../models/advisory";
import { advisoryLearnerAsLearner } from "../../models/advisory";
import {
  ADVISORY_TERMS,
  calculateGeneralAverage,
  calculateMapehFinal,
  calculateMapehTermAverage,
  calculateSubjectFinal,
  formatGeneralAverage,
  mapehComponents,
} from "../../domain/advisory";
import { officialFullName } from "../../domain/advisory/match";
import { subjectCompactName } from "../../domain/advisory/subjects";
import { sortDepEdRoster } from "../roster/sort";
import { LearnerAvatar } from "../roster/LearnerAvatar";

function termGrade(grades: AdvisoryGrade[], learnerId: string, subjectId: string, term: "1" | "2" | "3"): number | null {
  const row = grades.find(
    (item) => item.advisoryLearnerId === learnerId && item.advisorySubjectId === subjectId && item.term === term,
  );
  return row ? row.finalGrade : null;
}

function GradeCell({ value }: { value: number | null }) {
  return <td className={value === null ? "is-missing" : "has-grade"}>{value === null ? "—" : value}</td>;
}

export function GradeMatrix({
  advisoryClass,
  learners,
  subjects,
  grades,
}: {
  advisoryClass: AdvisoryClass;
  learners: AdvisoryLearner[];
  subjects: AdvisorySubject[];
  grades: AdvisoryGrade[];
}) {
  const [showTerms, setShowTerms] = useState(false);
  const roster = useMemo(
    () => sortDepEdRoster(learners.filter((item) => item.enrollmentStatus !== "inactive").map(advisoryLearnerAsLearner)),
    [learners],
  );
  const activeSubjects = subjects.filter((item) => !item.isArchived).sort((a, b) => a.displayOrder - b.displayOrder);
  const components = mapehComponents(activeSubjects);

  if (activeSubjects.length === 0) {
    return <p className="muted">No subjects configured for Grade {advisoryClass.gradeLevel}.</p>;
  }

  return (
    <div className="card advisory-matrix-card">
      <div className="advisory-matrix-toolbar">
        <p className="muted">
          Subject finals appear after Terms 1–3. MAPEH counts once. General Average waits for every included subject.
        </p>
        <button type="button" className="ghost" onClick={() => setShowTerms((value) => !value)}>
          {showTerms ? "Hide Terms 1–3" : "Show Terms 1–3"}
        </button>
      </div>
      <div className="table-scroll advisory-matrix-scroll">
        <table className="advisory-matrix">
          <thead>
            <tr>
              <th className="advisory-sticky">LRN / Official name</th>
              {activeSubjects.map((subject) => (
                <th key={subject.id} colSpan={showTerms ? 4 : 1} title={subject.subjectName}>
                  <span className="advisory-subject-full">{subject.subjectName}</span>
                  <span className="advisory-subject-compact">{subjectCompactName(subject.subjectName)}</span>
                </th>
              ))}
              {components && <th>MAPEH</th>}
              <th>GEN AVG</th>
            </tr>
            {showTerms && (
              <tr>
                <th className="advisory-sticky" />
                {activeSubjects.flatMap((subject) => [
                  <th key={`${subject.id}-t1`}>T1</th>,
                  <th key={`${subject.id}-t2`}>T2</th>,
                  <th key={`${subject.id}-t3`}>T3</th>,
                  <th key={`${subject.id}-final`}>Final</th>,
                ])}
                {components && <th>Final</th>}
                <th>Final</th>
              </tr>
            )}
          </thead>
          <tbody>
            {roster.map((learner) => {
              const ga = calculateGeneralAverage(grades, learner.id, activeSubjects);
              const mapehFinal = components ? calculateMapehFinal(grades, learner.id, activeSubjects) : null;
              return (
                <tr key={learner.id}>
                  <td className="advisory-sticky">
                    <div className="advisory-learner-cell">
                      <LearnerAvatar presetId={learner.avatarPresetId} size="sm" />
                      <div>
                        <strong>{officialFullName(learner)}</strong>
                        <small>{learner.lrn || "No LRN"}</small>
                      </div>
                    </div>
                  </td>
                  {activeSubjects.flatMap((subject) =>
                    showTerms
                      ? [
                          ...ADVISORY_TERMS.map((term) => (
                            <GradeCell
                              key={`${learner.id}-${subject.id}-${term}`}
                              value={termGrade(grades, learner.id, subject.id, term)}
                            />
                          )),
                          <GradeCell
                            key={`${learner.id}-${subject.id}-final`}
                            value={calculateSubjectFinal(grades, learner.id, subject.id)}
                          />,
                        ]
                      : [
                          <GradeCell
                            key={`${learner.id}-${subject.id}`}
                            value={calculateSubjectFinal(grades, learner.id, subject.id)}
                          />,
                        ],
                  )}
                  {components && <td className={mapehFinal === null ? "is-missing" : "has-grade"}>{mapehFinal ?? "—"}</td>}
                  <td className={ga === null ? "is-missing" : "has-grade"}>{formatGeneralAverage(ga)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {components && showTerms && (
        <p className="muted">
          MAPEH term averages:{" "}
          {roster.length
            ? ADVISORY_TERMS.map((term) => {
                const value = calculateMapehTermAverage(grades, roster[0].id, activeSubjects, term);
                return `T${term} ${value ?? "—"}`;
              }).join(" · ")
            : "—"}
        </p>
      )}
    </div>
  );
}
