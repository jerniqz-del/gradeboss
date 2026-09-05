import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import { computeClassYearResults, TERMS, type LearnerYearResult } from "./summary";
import type { TermGrade } from "./types";

export interface TermCompletion {
  term: Term;
  expected: number;
  filled: number;
  missing: number;
  percent: number;
  hasAssessments: boolean;
}

export type PendingTaskKind = "missing-hps" | "incomplete-term" | "empty-roster" | "no-assessments";

export interface PendingTask {
  id: string;
  loadId: string;
  loadLabel: string;
  severity: "warn" | "info";
  kind: PendingTaskKind;
  title: string;
  detail: string;
}

export interface StandingRow {
  key: string;
  learnerId: string;
  loadId: string;
  name: string;
  lrn: string;
  gradeLevel: string;
  section: string;
  subject: string;
  avatarPresetId?: string;
  annualGrade: TermGrade | null;
  display: string;
  descriptor: string;
  passed: boolean | null;
  rankValue: number;
  termsWithData: number;
}

export interface TermAverage {
  term: Term;
  average: number | null;
  display: string;
  filled: number;
}

export interface LoadInsights {
  loadId: string;
  label: string;
  gradeLevel: string;
  section: string;
  subject: string;
  schoolYear: string;
  policy: TeachingLoad["policy"];
  learnerCount: number;
  expectedScores: number;
  filledScores: number;
  missingScores: number;
  completionPercent: number;
  classAverage: number | null;
  classAverageDisplay: string;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  termAverages: TermAverage[];
  termCompletions: TermCompletion[];
  pending: PendingTask[];
  standings: StandingRow[];
  yearResults: LearnerYearResult[];
}

export interface DashboardInsights {
  loadCount: number;
  learnerCount: number;
  enrollmentCount: number;
  filledScores: number;
  missingScores: number;
  overallCompletion: number;
  overallAverage: number | null;
  passedCount: number;
  failedCount: number;
  loads: LoadInsights[];
  standings: StandingRow[];
  pending: PendingTask[];
}

export function loadLabel(load: TeachingLoad): string {
  return `G${load.gradeLevel} ${load.section} — ${load.subject}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function percent(filled: number, expected: number): number {
  if (expected <= 0) return 0;
  return round1((filled / expected) * 100);
}

function isActiveForTerm(learner: Learner, term: Term): boolean {
  if (learner.transferredOutTerm && parseInt(term, 10) > parseInt(learner.transferredOutTerm, 10)) {
    return false;
  }
  return true;
}

function hasTransferredIn(learner: Learner, term: Term): boolean {
  return learner.transferredInGrades?.[term] !== undefined;
}

function rankValue(grade: TermGrade | null): number {
  if (grade === null) return Number.NEGATIVE_INFINITY;
  if (grade === "T/O") return -1;
  if (typeof grade === "number") return grade;
  const letters: Record<string, number> = { A: 95, B: 84.5, C: 77, D: 69.5, E: 32 };
  return letters[String(grade).toUpperCase()] ?? Number.NEGATIVE_INFINITY;
}

function numericMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function countCells(load: TeachingLoad, term?: Term): { expected: number; filled: number } {
  let expected = 0;
  let filled = 0;
  for (const assessment of load.assessments) {
    if (term && assessment.term !== term) continue;
    if (!(assessment.maxScore > 0)) continue;
    for (const learner of load.learners) {
      if (!isActiveForTerm(learner, assessment.term)) continue;
      if (hasTransferredIn(learner, assessment.term)) continue;
      expected += 1;
      const value = load.scores[scoreKey(learner.id, assessment.id)];
      if (typeof value === "number") filled += 1;
    }
  }
  return { expected, filled };
}

function standingFrom(load: TeachingLoad, year: LearnerYearResult): StandingRow | null {
  const learner = load.learners.find((item) => item.id === year.learnerId);
  if (!learner) return null;
  return {
    key: `${load.id}:${learner.id}`,
    learnerId: learner.id,
    loadId: load.id,
    name: learnerDisplayName(learner),
    lrn: learner.lrn,
    gradeLevel: load.gradeLevel,
    section: load.section,
    subject: load.subject,
    avatarPresetId: learner.avatarPresetId,
    annualGrade: year.annualGrade,
    display: year.annualDisplay,
    descriptor: year.annualDescriptor,
    passed: year.passed,
    rankValue: rankValue(year.annualGrade),
    termsWithData: year.termsWithData,
  };
}

function compareStandings(a: StandingRow, b: StandingRow): number {
  if (b.rankValue !== a.rankValue) return b.rankValue - a.rankValue;
  return a.name.localeCompare(b.name, "fil");
}

export function computeLoadInsights(load: TeachingLoad): LoadInsights {
  const label = loadLabel(load);
  const yearResults = computeClassYearResults(load);
  const totals = countCells(load);
  const termCompletions: TermCompletion[] = TERMS.map((term) => {
    const cells = countCells(load, term);
    const hasAssessments = load.assessments.some((item) => item.term === term);
    return {
      term,
      expected: cells.expected,
      filled: cells.filled,
      missing: cells.expected - cells.filled,
      percent: percent(cells.filled, cells.expected),
      hasAssessments,
    };
  });

  const pending: PendingTask[] = [];
  if (load.learners.length === 0) {
    pending.push({
      id: `${load.id}:empty-roster`,
      loadId: load.id,
      loadLabel: label,
      severity: "warn",
      kind: "empty-roster",
      title: "Empty roster",
      detail: `${label} has no learners yet.`,
    });
  }

  const missingHps = load.assessments.filter((item) => !(item.maxScore > 0));
  if (missingHps.length > 0) {
    pending.push({
      id: `${load.id}:missing-hps`,
      loadId: load.id,
      loadLabel: label,
      severity: "warn",
      kind: "missing-hps",
      title: "Missing HPS",
      detail: `${missingHps.length} assessment${missingHps.length === 1 ? "" : "s"} in ${label} have no highest possible score.`,
    });
  }

  if (load.assessments.length === 0 && load.learners.length > 0) {
    pending.push({
      id: `${load.id}:no-assessments`,
      loadId: load.id,
      loadLabel: label,
      severity: "warn",
      kind: "no-assessments",
      title: "No assessments",
      detail: `${label} has a roster but no assessment columns.`,
    });
  }

  for (const term of termCompletions) {
    if (!term.hasAssessments) {
      pending.push({
        id: `${load.id}:no-term-${term.term}`,
        loadId: load.id,
        loadLabel: label,
        severity: "info",
        kind: "incomplete-term",
        title: `Term ${term.term} has no columns`,
        detail: `Add assessments for Term ${term.term} in ${label}.`,
      });
      continue;
    }
    if (term.missing > 0) {
      pending.push({
        id: `${load.id}:incomplete-${term.term}`,
        loadId: load.id,
        loadLabel: label,
        severity: "info",
        kind: "incomplete-term",
        title: `Term ${term.term} incomplete`,
        detail: `${term.missing} missing score${term.missing === 1 ? "" : "s"} in ${label} Term ${term.term}.`,
      });
    }
  }

  const numericAnnuals = yearResults
    .map((row) => (typeof row.annualGrade === "number" ? row.annualGrade : null))
    .filter((n): n is number => n !== null);
  const classAverage = numericMean(numericAnnuals);
  const passedCount = yearResults.filter((row) => row.passed === true).length;
  const failedCount = yearResults.filter((row) => row.passed === false).length;
  const incompleteCount = yearResults.filter((row) => row.passed === null).length;

  let classAverageDisplay = "—";
  if (classAverage !== null) {
    classAverageDisplay = String(classAverage);
  } else if (passedCount + failedCount > 0) {
    classAverageDisplay = `${passedCount}/${passedCount + failedCount} passed`;
  }

  const termAverages: TermAverage[] = TERMS.map((term, index) => {
    const values = yearResults
      .map((row) => row.termGrades[index])
      .filter((grade): grade is number => typeof grade === "number");
    const average = numericMean(values);
    return {
      term,
      average,
      display: average === null ? "—" : String(average),
      filled: values.length,
    };
  });

  const standings = yearResults
    .map((year) => standingFrom(load, year))
    .filter((row): row is StandingRow => row !== null)
    .sort(compareStandings);

  return {
    loadId: load.id,
    label,
    gradeLevel: load.gradeLevel,
    section: load.section,
    subject: load.subject,
    schoolYear: load.schoolYear,
    policy: load.policy,
    learnerCount: load.learners.length,
    expectedScores: totals.expected,
    filledScores: totals.filled,
    missingScores: totals.expected - totals.filled,
    completionPercent: percent(totals.filled, totals.expected),
    classAverage,
    classAverageDisplay,
    passedCount,
    failedCount,
    incompleteCount,
    termAverages,
    termCompletions,
    pending,
    standings,
    yearResults,
  };
}

export function computeDashboardInsights(loads: TeachingLoad[]): DashboardInsights {
  const insights = [...loads]
    .sort((a, b) => a.dashboardOrder - b.dashboardOrder || a.subject.localeCompare(b.subject))
    .map(computeLoadInsights);

  const filledScores = insights.reduce((sum, item) => sum + item.filledScores, 0);
  const expectedScores = insights.reduce((sum, item) => sum + item.expectedScores, 0);
  const numericAverages = insights
    .map((item) => item.classAverage)
    .filter((n): n is number => n !== null);

  const lrns = new Set<string>();
  for (const load of loads) {
    for (const learner of load.learners) {
      lrns.add(learner.lrn || learner.id);
    }
  }

  const standings = insights.flatMap((item) => item.standings).sort(compareStandings);
  const pending = insights.flatMap((item) => item.pending);

  return {
    loadCount: loads.length,
    learnerCount: lrns.size,
    enrollmentCount: loads.reduce((sum, load) => sum + load.learners.length, 0),
    filledScores,
    missingScores: expectedScores - filledScores,
    overallCompletion: percent(filledScores, expectedScores),
    overallAverage: numericMean(numericAverages),
    passedCount: insights.reduce((sum, item) => sum + item.passedCount, 0),
    failedCount: insights.reduce((sum, item) => sum + item.failedCount, 0),
    loads: insights,
    standings,
    pending,
  };
}
