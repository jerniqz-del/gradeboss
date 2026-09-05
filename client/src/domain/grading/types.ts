import type { AssessmentComponent, ComponentWeights, MapePart, Term } from "../../models/types";

/** Weight triplet [WW %, PT %, Exam %] as stored in E-Class Record. */
export type WeightTriplet = readonly [number, number, number];

export type ExamComponent = Extract<AssessmentComponent, "ST1" | "ST2" | "TE">;

/** Numeric transmuted grade, descriptive letter, or transfer marker. */
export type TermGrade = number | "A" | "B" | "C" | "D" | "E" | "T/O";

export interface ComponentScore {
  raw: number;
  max: number;
  /** Percentage score (0–100). 0 when no HPS is recorded. */
  ps: number;
  hasData: boolean;
}

export interface TermResult {
  ww: ComponentScore;
  pt: ComponentScore;
  st1: ComponentScore;
  st2: ComponentScore;
  te: ComponentScore;
  examPS: number;
  initialGrade: number;
  /** Transmuted grade, or null when the term has no recorded scores. */
  termGrade: TermGrade | null;
  hasData: boolean;
  isTransferredOut?: boolean;
  isTransferredIn?: boolean;
}

export interface MapehTermResult {
  musicArts: TermResult;
  peHealth: TermResult;
  /** Rounded average of the two part term grades (desktop `consolidateMapehGrades`). */
  consolidatedGrade: TermGrade | "";
}

export interface GradingOptions {
  /**
   * Desktop `db.useUniversalTrimesterLayout` — treat any grade as KS2
   * for transmutation / layout decisions.
   */
  useUniversalTrimesterLayout?: boolean;
}

export interface PolicyInput {
  gradeLevel: string | number;
  subject?: string;
  schoolYear?: string;
  policy?: string;
  subjectGroup?: string;
  shsSubjectGroup?: string;
  isSpecialProgramSubject?: boolean;
  specialProgramWeights?: ComponentWeights | WeightTriplet | number[] | null;
}

export type { AssessmentComponent, ComponentWeights, MapePart, Term };
