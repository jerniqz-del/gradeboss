/** DepEd grading policy modes (mirrors E-Class Record). */
export type GradingPolicy =
  | "DO15_TRANSITION"
  | "DO15_ZERO"
  | "DO15_DESCRIPTIVE"
  | "KEY_STAGE_2_TRIMESTER"
  | "DO8_2015";

export type AssessmentComponent = "WW" | "PT" | "ST1" | "ST2" | "TE";
export type Term = "1" | "2" | "3";
export type MapePart = "music_arts" | "pe_health";
export type Sex = "M" | "F" | "";

export interface ComponentWeights {
  writtenWorks: number;
  performanceTasks: number;
  examination: number;
}

/** Score map key: `${learnerId}|${assessmentId}` */
export type ScoreMap = Record<string, number | "">;

export const SCHEMA_VERSION = 1;

export const DEFAULT_WEIGHTS: ComponentWeights = {
  writtenWorks: 20,
  performanceTasks: 50,
  examination: 30,
};
