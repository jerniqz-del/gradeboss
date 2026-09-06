import type { ScoreMap } from "./types";

/** Snapshot of one cell used by grade-simulator apply/revert. */
export interface ScoreState {
  present: boolean;
  value: number | null;
}

export interface SimulationChange {
  key: string;
  before: ScoreState;
  after: ScoreState;
}

export type SimulationStatus = "applied" | "reverted" | "partially-reverted";

export interface SimulationSession {
  id: string;
  assignmentId: string;
  term: string;
  baseScores: ScoreMap;
  draftScores: ScoreMap;
  createdAt: string;
}

export interface SimulationHistoryEntry {
  id: string;
  assignmentId: string;
  assignmentLabel: string;
  term: string;
  appliedAt: string;
  changes: SimulationChange[];
  status: SimulationStatus;
  revertedAt: string;
}

export const SIMULATION_HISTORY_LIMIT = 10;
