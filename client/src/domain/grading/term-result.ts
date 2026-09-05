import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import type { ComponentScore, GradingOptions, TermResult } from "./types";
import {
  componentScore,
  examPercentageScore,
  examinationHasData,
} from "./components";
import { initialGrade } from "./initial-grade";
import { transmuteForLoad } from "./transmutation";
import { examinationComponentsForLoad, weightsForLoad } from "./weights";

const EMPTY_COMPONENT: ComponentScore = { raw: 0, max: 0, ps: 0, hasData: false };

function emptyTermResult(overrides: Partial<TermResult>): TermResult {
  return {
    ww: EMPTY_COMPONENT,
    pt: EMPTY_COMPONENT,
    st1: EMPTY_COMPONENT,
    st2: EMPTY_COMPONENT,
    te: EMPTY_COMPONENT,
    examPS: 0,
    initialGrade: 0,
    termGrade: null,
    hasData: false,
    ...overrides,
  };
}

/**
 * Full term result for one learner (optional MAPEH part).
 * Port of eclassrecord `computeTerm`. Designed for the Phase 3 score grid.
 */
export function computeTermResult(
  load: TeachingLoad,
  learnerId: string,
  term: Term | string,
  mapePart?: MapePart,
  options?: GradingOptions,
): TermResult {
  const learner = load.learners.find((item) => item.id === learnerId);
  if (learner) {
    if (learner.transferredOutTerm && parseInt(String(term), 10) > parseInt(learner.transferredOutTerm, 10)) {
      return emptyTermResult({ termGrade: "T/O", isTransferredOut: true });
    }
    if (learner.transferredInGrades && learner.transferredInGrades[term as Term] !== undefined) {
      return emptyTermResult({
        termGrade: learner.transferredInGrades[term as Term] as number,
        hasData: true,
        isTransferredIn: true,
      });
    }
  }

  const weights = weightsForLoad(load);
  const ww = componentScore(load.assessments, load.scores, learnerId, term, ["WW"], mapePart);
  const pt = componentScore(load.assessments, load.scores, learnerId, term, ["PT"], mapePart);
  const st1 = componentScore(load.assessments, load.scores, learnerId, term, ["SA1", "ST1"], mapePart);
  const st2 = componentScore(load.assessments, load.scores, learnerId, term, ["SA2", "ST2"], mapePart);
  const te = componentScore(load.assessments, load.scores, learnerId, term, ["TE"], mapePart);

  const examinationComponents = examinationComponentsForLoad(load);
  const examPS = examPercentageScore(st1, st2, te, examinationComponents);
  const ig = initialGrade(ww.ps, pt.ps, examPS, weights);
  const hasData = ww.hasData || pt.hasData || examinationHasData(st1, st2, te, examinationComponents);

  return {
    ww,
    pt,
    st1,
    st2,
    te,
    examPS,
    initialGrade: ig,
    termGrade: hasData ? transmuteForLoad(load, ig, options) : null,
    hasData,
  };
}

export function computeClassTermResults(
  load: TeachingLoad,
  term: Term | string,
  mapePart?: MapePart,
  options?: GradingOptions,
): Map<string, TermResult> {
  const results = new Map<string, TermResult>();
  for (const learner of load.learners) {
    results.set(learner.id, computeTermResult(load, learner.id, term, mapePart, options));
  }
  return results;
}
