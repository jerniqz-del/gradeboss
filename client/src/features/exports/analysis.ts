/**
 * Compact class-analysis stats for PDF export.
 * Port of eclassrecord `class-analysis.js` `computeClassAnalysis` (no charts).
 * Full interactive analysis UI is Phase 11.
 */

import { computeTermResult, isMapehSubject, isPassing } from "../../domain/grading";
import { scoreKey } from "../../models/assessment";
import type { Assessment } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { termAssessments } from "./csv";

export interface AssessmentStats {
  title: string;
  component: string;
  hps: number;
  takers: number;
  mean: number;
  median: number;
  mode: number | null;
  stdDev: number;
  mps: number;
  mastery: string;
}

export interface AnalysisLearner {
  name: string;
  sex: string;
  rank: number | "";
  wwPs: number | null;
  ptPs: number | null;
  examPs: number | null;
  initialGrade: number | null;
  termGrade: string;
  remarks: string;
}

export interface ClassAnalysis {
  termLabel: string;
  assessments: AssessmentStats[];
  learners: AnalysisLearner[];
  classStats: {
    mean: number;
    median: number;
    mode: number | null;
    stdDev: number;
    mps: number;
    passRate: number;
  };
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(values: number[]): number | null {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  let best: number | null = null;
  let bestCount = 1;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function masteryLabel(mps: number): string {
  if (mps >= 85) return "High mastery";
  if (mps >= 75) return "Generally mastered";
  if (mps >= 50) return "Needs reinforcement";
  return "Difficult / reteaching needed";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeClassAnalysis(
  load: TeachingLoad,
  term: Term | "summary",
  mapePart?: MapePart,
): ClassAnalysis {
  const isSummary = term === "summary";
  const activePart = mapePart || (isMapehSubject(load.subject) ? "music_arts" : undefined);
  const items: Assessment[] = isSummary
    ? (["1", "2", "3"] as Term[]).flatMap((item) => termAssessments(load, item, activePart))
    : termAssessments(load, term, activePart);

  const assessments: AssessmentStats[] = items.map((assessment) => {
    const hps = Number(assessment.maxScore) || 0;
    const scores: number[] = [];
    load.learners.forEach((learner) => {
      const value = parseFloat(String(load.scores[scoreKey(learner.id, assessment.id)]));
      if (!Number.isNaN(value)) scores.push(value);
    });
    const avg = mean(scores);
    const mps = hps > 0 ? (avg / hps) * 100 : 0;
    return {
      title: assessment.title || assessment.component,
      component: assessment.component,
      hps,
      takers: scores.length,
      mean: round1(avg),
      median: round1(median(scores)),
      mode: mode(scores),
      stdDev: round1(stdDev(scores)),
      mps: round1(mps),
      mastery: masteryLabel(mps),
    };
  });

  const termGrades: number[] = [];
  const learners = load.learners.map((learner) => {
    let grade: number | null = null;
    let termGrade: string | number | null = null;
    let wwPs: number | null = null;
    let ptPs: number | null = null;
    let examPs: number | null = null;
    let initial: number | null = null;
    if (isSummary) {
      let total = 0;
      let count = 0;
      for (const item of ["1", "2", "3"] as Term[]) {
        const result = computeTermResult(load, learner.id, item, activePart);
        const numeric = typeof result.termGrade === "number" ? result.termGrade : null;
        if (numeric !== null) {
          total += numeric;
          count += 1;
        }
      }
      grade = count ? Math.round(total / count) : null;
      termGrade = grade;
      initial = grade;
    } else {
      const result = computeTermResult(load, learner.id, term, activePart);
      termGrade = result.termGrade;
      wwPs = result.ww.hasData ? result.ww.ps : null;
      ptPs = result.pt.hasData ? result.pt.ps : null;
      examPs = result.hasData ? result.examPS : null;
      grade = typeof result.termGrade === "number" ? result.termGrade : result.hasData ? result.initialGrade : null;
      initial = result.hasData ? result.initialGrade : null;
    }
    if (typeof grade === "number") termGrades.push(grade);
    return {
      name: learnerDisplayName(learner),
      sex: learner.sex,
      rank: 0 as number | "",
      wwPs,
      ptPs,
      examPs,
      initialGrade: initial,
      termGrade: termGrade === null ? "—" : String(termGrade),
      remarks:
        termGrade === "T/O"
          ? "Transferred Out"
          : grade === null
            ? "—"
            : isPassing(grade)
              ? "Passed"
              : "Failed",
    };
  });

  learners.sort((left, right) => (right.initialGrade || -1) - (left.initialGrade || -1));
  learners.forEach((row, index) => {
    row.rank = row.initialGrade === null ? "" : index + 1;
  });

  const averageMps = assessments.length ? mean(assessments.map((item) => item.mps)) : 0;
  return {
    termLabel: isSummary ? "Summary" : `Term ${term}`,
    assessments,
    learners,
    classStats: {
      mean: round1(mean(termGrades)),
      median: round1(median(termGrades)),
      mode: mode(termGrades),
      stdDev: round1(stdDev(termGrades)),
      mps: round1(averageMps),
      passRate: termGrades.length ? round1((termGrades.filter((grade) => isPassing(grade)).length / termGrades.length) * 100) : 0,
    },
  };
}
