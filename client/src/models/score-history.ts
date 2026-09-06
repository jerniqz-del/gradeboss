/** Per-cell audit log stored on a teaching load (eclassrecord `scoreHistory`). */
export type ScoreHistorySource =
  | "grading-sheet"
  | "quick-grade"
  | "checklist-publication"
  | "checklist-publication-revert"
  | "score-transfer-copy"
  | "score-transfer-move"
  | "undo"
  | "redo";

export interface ScoreHistoryEntry {
  id: string;
  learnerId: string;
  assessmentId: string;
  term: string;
  previousValue: number | null;
  newValue: number | null;
  source: string;
  changedAt: string;
}

export const SCORE_HISTORY_MAX = 10_000;
