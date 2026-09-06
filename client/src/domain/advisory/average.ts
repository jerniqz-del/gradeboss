import type { AdvisoryGrade, AdvisorySubject } from "../../models/advisory";
import type { Term } from "../../models/types";
import { isMusicArtsKey, isPeHealthKey, normalizeSubjectKey } from "./subjects";

export const MAPEH_AVERAGE_ID = "__mapeh_average__";
export const GENERAL_AVERAGE_ID = "__general_average__";
export const ADVISORY_TERMS: Term[] = ["1", "2", "3"];

function includedSubjects(subjects: AdvisorySubject[]): AdvisorySubject[] {
  return subjects.filter((subject) => !subject.isArchived && subject.includeInGeneralAverage !== false);
}

export function mapehComponents(subjects: AdvisorySubject[]): {
  musicArts: AdvisorySubject;
  peHealth: AdvisorySubject;
} | null {
  const musicArts = subjects.find((subject) => isMusicArtsKey(normalizeSubjectKey(subject.subjectName)));
  const peHealth = subjects.find((subject) => isPeHealthKey(normalizeSubjectKey(subject.subjectName)));
  return musicArts && peHealth ? { musicArts, peHealth } : null;
}

function gradeValue(grades: AdvisoryGrade[], learnerId: string, subjectId: string, term: Term): number | null {
  const record = grades.find(
    (item) => item.advisoryLearnerId === learnerId && item.advisorySubjectId === subjectId && item.term === term,
  );
  return record && Number.isFinite(record.finalGrade) ? record.finalGrade : null;
}

function meanOrNull(values: Array<number | null>): number | null {
  if (!values.length || values.some((value) => value === null)) return null;
  const numbers = values as number[];
  return Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2));
}

export function calculateSubjectFinalExact(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjectId: string,
): number | null {
  return meanOrNull(ADVISORY_TERMS.map((term) => gradeValue(grades, learnerId, subjectId, term)));
}

export function calculateSubjectFinal(grades: AdvisoryGrade[], learnerId: string, subjectId: string): number | null {
  const exact = calculateSubjectFinalExact(grades, learnerId, subjectId);
  return exact === null ? null : Math.round(exact);
}

export function calculateMapehTermAverageExact(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjects: AdvisorySubject[],
  term: Term,
): number | null {
  const components = mapehComponents(subjects);
  if (!components) return null;
  return meanOrNull([
    gradeValue(grades, learnerId, components.musicArts.id, term),
    gradeValue(grades, learnerId, components.peHealth.id, term),
  ]);
}

export function calculateMapehTermAverage(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjects: AdvisorySubject[],
  term: Term,
): number | null {
  const exact = calculateMapehTermAverageExact(grades, learnerId, subjects, term);
  return exact === null ? null : Math.round(exact);
}

export function calculateMapehFinalExact(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjects: AdvisorySubject[],
): number | null {
  return meanOrNull(ADVISORY_TERMS.map((term) => calculateMapehTermAverageExact(grades, learnerId, subjects, term)));
}

export function calculateMapehFinal(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjects: AdvisorySubject[],
): number | null {
  const exact = calculateMapehFinalExact(grades, learnerId, subjects);
  return exact === null ? null : Math.round(exact);
}

export function calculateGeneralTermAverage(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjects: AdvisorySubject[],
  term: Term,
): number | null {
  const included = includedSubjects(subjects);
  if (!included.length) return null;
  const components = mapehComponents(included);
  const regular = components
    ? included.filter((subject) => subject.id !== components.musicArts.id && subject.id !== components.peHealth.id)
    : included;
  const values: Array<number | null> = regular.map((subject) =>
    gradeValue(grades, learnerId, subject.id, term),
  );
  if (components) values.push(calculateMapehTermAverage(grades, learnerId, included, term));
  return meanOrNull(values);
}

/** General Average uses rounded subject finals; MAPEH counts once as the combined final. */
export function calculateGeneralAverage(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjects: AdvisorySubject[],
): number | null {
  const included = includedSubjects(subjects);
  if (!included.length) return null;
  const components = mapehComponents(included);
  const regular = components
    ? included.filter((subject) => subject.id !== components.musicArts.id && subject.id !== components.peHealth.id)
    : included;
  const finals: Array<number | null> = regular.map((subject) => calculateSubjectFinal(grades, learnerId, subject.id));
  if (components) finals.push(calculateMapehFinal(grades, learnerId, included));
  return meanOrNull(finals);
}

export function formatGeneralAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export interface GradeRecordSubject extends AdvisorySubject {
  derived?: boolean;
}

/** Insert a derived MAPEH Average column before Music & Arts / PE & Health. */
export function subjectGroupsForGradeRecord(subjects: AdvisorySubject[]): GradeRecordSubject[] {
  const ordered: GradeRecordSubject[] = subjects
    .filter((subject) => !subject.isArchived)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((subject) => ({ ...subject, derived: false }));
  const components = mapehComponents(ordered);
  if (!components) return ordered;
  const first = ordered.findIndex(
    (subject) => subject.id === components.musicArts.id || subject.id === components.peHealth.id,
  );
  ordered.splice(Math.max(first, 0), 0, {
    ...components.musicArts,
    id: MAPEH_AVERAGE_ID,
    subjectName: "MAPEH Average",
    derived: true,
  });
  return ordered;
}
