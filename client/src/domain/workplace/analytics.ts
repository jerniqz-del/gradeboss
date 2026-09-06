/**
 * Workplace optimization analytics.
 *
 * Ported from eclassrecord `dashboard-workplace.js`
 * (`buildScoreCoverage`, `buildComponentPerformance`, `buildAnalytics`).
 * Exam mix uses GradeBoss `examinationComponentsForLoad` (ST1 30 / ST2 30 / TE 40).
 */

import { scoreKey } from "../../models/assessment";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import { examinationComponentsForLoad } from "../grading/weights";

export interface ComponentBucket {
  earned: number;
  possible: number;
  entered: number;
  expected: number;
  percent: number | null;
  coverage: number;
}

export interface ClassCoverage {
  id: string;
  label: string;
  subject: string;
  entered: number;
  expected: number;
  missing: number;
  percent: number;
}

export interface ScoreCoverage {
  entered: number;
  expected: number;
  missing: number;
  assessments: number;
  percent: number;
  completeClasses: number;
  byClass: ClassCoverage[];
}

export interface WorkplaceAnalytics {
  assessments: number;
  expectedScores: number;
  enteredScores: number;
  completionPercent: number;
  hpsReady: number;
  hpsPercent: number;
  byClass: Array<{ id: string; label: string; subject: string; entered: number; expected: number; percent: number }>;
  mix: { written: number; performance: number; quarterly: number; other: number };
  termCounts: Record<Term, number>;
  totalMissingScores: number;
  missingHps: number;
  emptyCategories: string[];
  scoreCoverage: ScoreCoverage;
  componentPerformance: {
    written: ComponentBucket;
    performance: ComponentBucket;
    quarterly: ComponentBucket;
  };
}

function clean(value: unknown): string {
  return String(value == null ? "" : value).trim();
}

function activeLearners(load: TeachingLoad, term: Term): Learner[] {
  return (load.learners || []).filter((learner) => {
    if (!learner) return false;
    const outTerm = Number(learner.transferredOutTerm);
    return !Number.isFinite(outTerm) || outTerm > Number(term || 1);
  });
}

function componentKey(component: string): "written" | "performance" | "quarterly" | "other" {
  const value = clean(component).toLowerCase();
  if (value === "ww" || value.includes("written")) return "written";
  if (value === "pt" || value.includes("performance")) return "performance";
  if (["qa", "sa", "sa1", "sa2", "st1", "st2", "te"].includes(value) || value.includes("exam")) return "quarterly";
  return "other";
}

function emptyBucket(): ComponentBucket {
  return { earned: 0, possible: 0, entered: 0, expected: 0, percent: null, coverage: 0 };
}

export function buildScoreCoverage(loads: TeachingLoad[], term: Term): ScoreCoverage {
  let entered = 0;
  let expected = 0;
  let assessments = 0;
  const byClass = loads.map((load) => {
    let classEntered = 0;
    let classExpected = 0;
    const termAssessments = (load.assessments || []).filter((item) => item.term === term);
    assessments += termAssessments.length;
    for (const assessment of termAssessments) {
      const learners = activeLearners(load, assessment.term);
      classExpected += learners.length;
      for (const learner of learners) {
        const value = load.scores[scoreKey(learner.id, assessment.id)];
        if (!(value === undefined || value === null || value === "")) classEntered += 1;
      }
    }
    entered += classEntered;
    expected += classExpected;
    return {
      id: load.id,
      label: `G${clean(load.gradeLevel)} ${clean(load.section)}`,
      subject: clean(load.subject),
      entered: classEntered,
      expected: classExpected,
      missing: Math.max(0, classExpected - classEntered),
      percent: classExpected ? Math.round((classEntered / classExpected) * 100) : 0,
    };
  });
  return {
    entered,
    expected,
    missing: Math.max(0, expected - entered),
    assessments,
    percent: expected ? Math.round((entered / expected) * 100) : 0,
    completeClasses: byClass.filter((item) => item.expected > 0 && item.entered === item.expected).length,
    byClass,
  };
}

export function buildComponentPerformance(
  load: TeachingLoad | null,
  term: Term,
): WorkplaceAnalytics["componentPerformance"] {
  const result = {
    written: emptyBucket(),
    performance: emptyBucket(),
    quarterly: emptyBucket(),
  };
  if (!load) return result;
  const learners = activeLearners(load, term);
  const examination: Record<string, { earned: number; possible: number }> = {
    ST1: { earned: 0, possible: 0 },
    ST2: { earned: 0, possible: 0 },
    TE: { earned: 0, possible: 0 },
  };

  for (const assessment of (load.assessments || []).filter((item) => item.term === term)) {
    const key = componentKey(assessment.component);
    if (key === "other" || !(key in result)) continue;
    const bucket = result[key];
    const hps = Number(assessment.maxScore);
    if (!Number.isFinite(hps) || hps <= 0) continue;
    const canonical = assessment.component;
    bucket.expected += learners.length;
    bucket.possible += learners.length * hps;
    if (examination[canonical]) examination[canonical].possible += learners.length * hps;
    for (const learner of learners) {
      const value = load.scores[scoreKey(learner.id, assessment.id)];
      if (value === undefined || value === null || value === "" || !Number.isFinite(Number(value))) continue;
      const earned = Math.max(0, Math.min(hps, Number(value)));
      bucket.entered += 1;
      bucket.earned += earned;
      if (examination[canonical]) examination[canonical].earned += earned;
    }
  }

  for (const item of Object.values(result)) {
    item.percent = item.possible ? Math.round((item.earned / item.possible) * 100) : null;
    item.coverage = item.expected ? Math.round((item.entered / item.expected) * 100) : 0;
  }

  const allowed = examinationComponentsForLoad(load);
  const examWeights: Record<string, number> =
    allowed.length === 1 && allowed[0] === "TE"
      ? { TE: 1 }
      : allowed.length === 0
        ? {}
        : { ST1: 0.3, ST2: 0.3, TE: 0.4 };
  const recognizedPossible = Object.keys(examWeights).reduce((sum, component) => sum + examination[component].possible, 0);
  if (recognizedPossible > 0) {
    result.quarterly.percent = Math.round(
      Object.entries(examWeights).reduce((sum, [component, weight]) => {
        const item = examination[component];
        return sum + (item.possible ? (item.earned / item.possible) * 100 * weight : 0);
      }, 0),
    );
  }
  return result;
}

export function buildAnalytics(loads: TeachingLoad[], currentTerm: Term): WorkplaceAnalytics {
  const mix = { written: 0, performance: 0, quarterly: 0, other: 0 };
  const termCounts: Record<Term, number> = { "1": 0, "2": 0, "3": 0 };
  let assessments = 0;
  let expectedScores = 0;
  let enteredScores = 0;
  let hpsReady = 0;
  let totalMissingScores = 0;

  const byClass = loads.map((load) => {
    const learners = activeLearners(load, currentTerm);
    for (const item of load.assessments || []) {
      if (termCounts[item.term] !== undefined) termCounts[item.term] += 1;
      const termLearners = activeLearners(load, item.term);
      totalMissingScores += termLearners.filter((learner) => {
        const value = load.scores[scoreKey(learner.id, item.id)];
        return value === undefined || value === null || value === "";
      }).length;
    }
    const currentAssessments = (load.assessments || []).filter((item) => item.term === currentTerm);
    let classEntered = 0;
    const classExpected = learners.length * currentAssessments.length;
    for (const assessment of currentAssessments) {
      assessments += 1;
      if (Number(assessment.maxScore) > 0) hpsReady += 1;
      const component = componentKey(assessment.component);
      if (component === "written") mix.written += 1;
      else if (component === "performance") mix.performance += 1;
      else if (component === "quarterly") mix.quarterly += 1;
      else mix.other += 1;
      for (const learner of learners) {
        const value = load.scores[scoreKey(learner.id, assessment.id)];
        if (!(value === undefined || value === null || value === "")) classEntered += 1;
      }
    }
    expectedScores += classExpected;
    enteredScores += classEntered;
    return {
      id: load.id,
      label: `G${clean(load.gradeLevel)} ${clean(load.section)}`,
      subject: clean(load.subject),
      entered: classEntered,
      expected: classExpected,
      percent: classExpected ? Math.round((classEntered / classExpected) * 100) : 0,
    };
  });

  const missingHps = Math.max(0, assessments - hpsReady);
  const emptyCategories = (
    [
      ["written", "Written Work"],
      ["performance", "Performance Task"],
      ["quarterly", "Quarterly/Other"],
    ] as const
  )
    .filter(([key]) => (key === "quarterly" ? mix.quarterly + mix.other === 0 : mix[key] === 0))
    .map(([, label]) => label);

  const currentLoad = loads[0] || null;
  return {
    assessments,
    expectedScores,
    enteredScores,
    completionPercent: expectedScores ? Math.round((enteredScores / expectedScores) * 100) : 0,
    hpsReady,
    hpsPercent: assessments ? Math.round((hpsReady / assessments) * 100) : 0,
    byClass,
    mix,
    termCounts,
    totalMissingScores,
    missingHps,
    emptyCategories,
    scoreCoverage: buildScoreCoverage(loads, currentTerm),
    componentPerformance: buildComponentPerformance(currentLoad, currentTerm),
  };
}
