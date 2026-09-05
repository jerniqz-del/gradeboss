import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import { isMapehSubject } from "../policy";
import { computeMapehTermResult } from "./mapeh";
import { computeTermResult } from "./term-result";
import { descriptor, formatGradeForDisplay, isPassing, transmuteForLoad } from "./transmutation";
import type { GradingOptions, TermGrade, TermResult } from "./types";

export const TERMS: Term[] = ["1", "2", "3"];

export interface LearnerTermSummary {
  term: Term;
  result: TermResult;
  grade: TermGrade | null;
  display: string;
  descriptor: string;
  /** null when the term has no usable grade (incomplete, not T/O). */
  passing: boolean | null;
}

export interface LearnerYearResult {
  learnerId: string;
  terms: LearnerTermSummary[];
  termGrades: Array<TermGrade | null>;
  /** Mean of contributing initial grades, or null when only T/I finals exist. */
  annualInitialGrade: number | null;
  annualGrade: TermGrade | null;
  annualDisplay: string;
  annualDescriptor: string;
  passed: boolean | null;
  termsWithData: number;
}

function emptyTermResult(): TermResult {
  return {
    ww: { raw: 0, max: 0, ps: 0, hasData: false },
    pt: { raw: 0, max: 0, ps: 0, hasData: false },
    st1: { raw: 0, max: 0, ps: 0, hasData: false },
    st2: { raw: 0, max: 0, ps: 0, hasData: false },
    te: { raw: 0, max: 0, ps: 0, hasData: false },
    examPS: 0,
    initialGrade: 0,
    termGrade: null,
    hasData: false,
  };
}

function asTermGrade(value: TermGrade | "" | null | undefined): TermGrade | null {
  if (value === null || value === undefined || value === "") return null;
  return value;
}

function termSummaryFromResult(
  load: TeachingLoad,
  term: Term,
  result: TermResult,
  grade: TermGrade | null,
): LearnerTermSummary {
  const display = formatGradeForDisplay(grade, load.policy);
  return {
    term,
    result,
    grade,
    display,
    descriptor: descriptor(grade),
    passing: grade === null || grade === "T/O" ? null : isPassing(grade),
  };
}

function numericGrade(grade: TermGrade | null): number | null {
  if (grade === null || grade === "T/O") return null;
  if (typeof grade === "number") return grade;
  const parsed = parseFloat(String(grade));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Annual final: average contributing IGs, then transmute (DepEd).
 * Transferred-in finals are already TGs — when any T/I term is present,
 * mix those TGs with transmuted computed terms and average the finals.
 */
function annualFromContributions(
  load: TeachingLoad,
  igs: number[],
  transferredFinals: number[],
  options?: GradingOptions,
): { annualInitialGrade: number | null; annualGrade: TermGrade | null } {
  if (igs.length === 0 && transferredFinals.length === 0) {
    return { annualInitialGrade: null, annualGrade: null };
  }

  if (transferredFinals.length === 0) {
    const annualIg = igs.reduce((sum, value) => sum + value, 0) / igs.length;
    return { annualInitialGrade: annualIg, annualGrade: transmuteForLoad(load, annualIg, options) };
  }

  const computedFinals = igs.map((ig) => numericGrade(transmuteForLoad(load, ig, options))).filter((n): n is number => n !== null);
  const finals = [...computedFinals, ...transferredFinals];
  if (finals.length === 0) return { annualInitialGrade: null, annualGrade: null };
  const mean = finals.reduce((sum, value) => sum + value, 0) / finals.length;
  if (load.policy === "DO15_DESCRIPTIVE") {
    return { annualInitialGrade: igs.length ? igs.reduce((sum, value) => sum + value, 0) / igs.length : null, annualGrade: transmuteForLoad(load, mean, options) };
  }
  return { annualInitialGrade: igs.length ? igs.reduce((sum, value) => sum + value, 0) / igs.length : null, annualGrade: Math.round(mean) };
}

function computeNonMapehYear(
  load: TeachingLoad,
  learnerId: string,
  options?: GradingOptions,
): LearnerYearResult {
  const igs: number[] = [];
  const transferredFinals: number[] = [];
  const terms = TERMS.map((term) => {
    const result = computeTermResult(load, learnerId, term, undefined, options);
    const grade = asTermGrade(result.termGrade);
    if (result.isTransferredOut) {
      return termSummaryFromResult(load, term, result, "T/O");
    }
    if (result.isTransferredIn) {
      const numeric = numericGrade(grade);
      if (numeric !== null) transferredFinals.push(numeric);
      return termSummaryFromResult(load, term, result, grade);
    }
    if (result.hasData) igs.push(result.initialGrade);
    return termSummaryFromResult(load, term, result, grade);
  });

  const { annualInitialGrade, annualGrade } = annualFromContributions(load, igs, transferredFinals, options);
  return finalizeYear(learnerId, load, terms, annualInitialGrade, annualGrade);
}

function computeMapehYear(
  load: TeachingLoad,
  learnerId: string,
  options?: GradingOptions,
): LearnerYearResult {
  const igs: number[] = [];
  const transferredFinals: number[] = [];
  const terms = TERMS.map((term) => {
    const mapeh = computeMapehTermResult(load, learnerId, term, options);
    const transferredOut = mapeh.musicArts.isTransferredOut || mapeh.peHealth.isTransferredOut;
    const transferredIn = mapeh.musicArts.isTransferredIn || mapeh.peHealth.isTransferredIn;
    const grade = transferredOut ? "T/O" : asTermGrade(mapeh.consolidatedGrade);
    const result: TermResult = transferredOut
      ? { ...emptyTermResult(), termGrade: "T/O", isTransferredOut: true }
      : transferredIn
        ? { ...emptyTermResult(), termGrade: grade, hasData: grade !== null, isTransferredIn: true }
        : {
            ...mapeh.musicArts,
            initialGrade:
              mapeh.musicArts.hasData && mapeh.peHealth.hasData
                ? (mapeh.musicArts.initialGrade + mapeh.peHealth.initialGrade) / 2
                : mapeh.musicArts.hasData
                  ? mapeh.musicArts.initialGrade
                  : mapeh.peHealth.initialGrade,
            termGrade: grade,
            hasData: mapeh.musicArts.hasData || mapeh.peHealth.hasData,
          };

    if (transferredOut) return termSummaryFromResult(load, term, result, "T/O");
    if (transferredIn) {
      const numeric = numericGrade(grade);
      if (numeric !== null) transferredFinals.push(numeric);
      return termSummaryFromResult(load, term, result, grade);
    }
    if (mapeh.musicArts.hasData) igs.push(mapeh.musicArts.initialGrade);
    if (mapeh.peHealth.hasData) igs.push(mapeh.peHealth.initialGrade);
    return termSummaryFromResult(load, term, result, grade);
  });

  const { annualInitialGrade, annualGrade } = annualFromContributions(load, igs, transferredFinals, options);
  return finalizeYear(learnerId, load, terms, annualInitialGrade, annualGrade);
}

function finalizeYear(
  learnerId: string,
  load: TeachingLoad,
  terms: LearnerTermSummary[],
  annualInitialGrade: number | null,
  annualGrade: TermGrade | null,
): LearnerYearResult {
  const termsWithData = terms.filter((row) => row.grade !== null && row.grade !== "T/O").length;
  return {
    learnerId,
    terms,
    termGrades: terms.map((row) => row.grade),
    annualInitialGrade,
    annualGrade,
    annualDisplay: formatGradeForDisplay(annualGrade, load.policy),
    annualDescriptor: descriptor(annualGrade),
    passed: annualGrade === null || annualGrade === "T/O" ? null : isPassing(annualGrade),
    termsWithData,
  };
}

/**
 * Year-to-date summary for one learner: term finals, annual average, pass/fail.
 * MAPEH uses consolidated term grades; annual still averages part IGs then transmutes.
 */
export function computeLearnerYearResult(
  load: TeachingLoad,
  learnerId: string,
  options?: GradingOptions,
): LearnerYearResult {
  return isMapehSubject(load.subject)
    ? computeMapehYear(load, learnerId, options)
    : computeNonMapehYear(load, learnerId, options);
}

export function computeClassYearResults(
  load: TeachingLoad,
  options?: GradingOptions,
): LearnerYearResult[] {
  return load.learners.map((learner) => computeLearnerYearResult(load, learner.id, options));
}
