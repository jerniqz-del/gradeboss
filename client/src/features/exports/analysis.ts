/**
 * Class-analysis stats for PDF export and the Phase 11 Teacher Tools view.
 * Port of eclassrecord `class-analysis.js` `computeClassAnalysis`.
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
  min: number;
  max: number;
  itemPassRate: number;
  distribution: number[];
  performanceLevel: { advanced: number; proficient: number; developing: number; beginning: number };
  variability: string;
  discriminationLabel: string;
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

function performanceBucket(percent: number): "advanced" | "proficient" | "developing" | "beginning" {
  if (percent >= 90) return "advanced";
  if (percent >= 75) return "proficient";
  if (percent >= 50) return "developing";
  return "beginning";
}

function discriminationLabel(scores: number[], hps: number): string {
  if (scores.length < 6 || hps <= 0) return "Insufficient data";
  const sorted = [...scores].sort((a, b) => b - a);
  const groupSize = Math.max(1, Math.round(sorted.length * 0.27));
  const upper = sorted.slice(0, groupSize);
  const lower = sorted.slice(sorted.length - groupSize);
  const gap = (mean(upper) / hps) * 100 - (mean(lower) / hps) * 100;
  if (gap >= 30) return "Strong separation";
  if (gap >= 15) return "Moderate separation";
  return "Weak separation";
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
    const distribution = [0, 0, 0, 0, 0];
    const performanceLevel = { advanced: 0, proficient: 0, developing: 0, beginning: 0 };
    scores.forEach((score) => {
      const pct = hps > 0 ? (score / hps) * 100 : 0;
      distribution[Math.min(4, Math.floor(pct / 20))] += 1;
      performanceLevel[performanceBucket(pct)] += 1;
    });
    const deviation = stdDev(scores);
    return {
      title: assessment.title || assessment.component,
      component: assessment.component,
      hps,
      takers: scores.length,
      mean: round1(avg),
      median: round1(median(scores)),
      mode: mode(scores),
      stdDev: round1(deviation),
      mps: round1(mps),
      mastery: masteryLabel(mps),
      min: scores.length ? Math.min(...scores) : 0,
      max: scores.length ? Math.max(...scores) : 0,
      itemPassRate: scores.length > 0 && hps > 0 ? round1((scores.filter((score) => score >= hps * 0.75).length / scores.length) * 100) : 0,
      distribution,
      performanceLevel,
      variability: deviation <= hps * 0.1 ? "consistent" : deviation <= hps * 0.2 ? "moderately varied" : "highly varied",
      discriminationLabel: discriminationLabel(scores, hps),
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
