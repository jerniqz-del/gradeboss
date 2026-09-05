/**
 * DepEd grading engine — pure functions ported from E-Class Record `grading.js`.
 *
 * Phase 3 score-grid entry points:
 * - `computeTermResult(load, learnerId, term, mapePart?)` — one learner / term
 * - `computeMapehTermResult(load, learnerId, term)` — Music & Arts + PE & Health
 * - `computeClassTermResults(load, term)` — whole section
 *
 * Building blocks (`componentScore`, `initialGrade`, `transmute`) are exported
 * for unit tests and for UI cells that only need a single column.
 */

export type {
  ComponentScore,
  ExamComponent,
  GradingOptions,
  MapehTermResult,
  PolicyInput,
  TermGrade,
  TermResult,
  WeightTriplet,
} from "./types";

export {
  DO15_TRANSITION,
  DO8_2015,
  KEY_STAGE_2_TRIMESTER,
  descriptor,
  formatGradeForDisplay,
  isPassing,
  roundInitialGradeForTable,
  termDescription,
  transmute,
  transmuteDescriptive,
  transmuteForLoad,
} from "./transmutation";

export {
  canonicalAssessmentComponent,
  componentScore,
  examPercentageScore,
  examinationHasData,
  isAssessmentIncludedForLoad,
  performanceTaskScore,
  writtenWorkScore,
} from "./components";

export { formatInitialGrade, initialGrade } from "./initial-grade";

export { computeClassTermResults, computeTermResult } from "./term-result";

export { computeMapehTermResult, consolidateMapehGrades } from "./mapeh";

export {
  DEFAULT_WEIGHTS,
  SENIOR_HIGH_SUBJECT_GROUPS,
  determineSubjectGroup,
  examinationComponentsForLoad,
  normalizeSeniorHighSubjectGroup,
  normalizeSpecialProgramWeights,
  tripletToWeights,
  weightsFor,
  weightsForLoad,
  weightsForLoadAsObject,
  weightsToTriplet,
} from "./weights";

export {
  defaultSubjectGroup,
  detectPolicy,
  determinePolicy,
  isKeyStage2Load,
  isMapehSubject,
  isZeroBasedSchoolYear,
  parseGradeLevel,
} from "../policy";
