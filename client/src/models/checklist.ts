import type { AssessmentComponent, MapePart, Term } from "./types";

/** Port of eclassrecord `CHECKLIST_COMPONENTS` / `CHECKLIST_SCORING_MODES`. */
export type ChecklistComponent = "TRACKING" | "WW" | "PT";
export type ChecklistScoringMode = "CHECK" | "NUMERIC";
export type ChecklistStatus = "active" | "archived";
export type ChecklistEntryOperation = "entry" | "bulk" | "session-reset" | "term-reset" | "criterion-clear";

export interface ChecklistCheckItem {
  id: string;
  label: string;
  pointValue: number;
  active: boolean;
  order: number;
}

export interface ChecklistCriterion {
  id: string;
  label: string;
  standardType: "recitation" | "notebook" | "assignment" | "";
  destinationComponent: ChecklistComponent;
  scoringMode: ChecklistScoringMode;
  pointsPerCheck: number;
  maxPointsPerSession: number;
  maxPointsPerTerm: number | null;
  checkItems: ChecklistCheckItem[];
  allowNotes: boolean;
  active: boolean;
  order: number;
}

export interface ChecklistEntry {
  points: number;
  note: string;
  updatedAt: string;
  selectedItemIds: string[];
}

export interface ScoreState {
  present: boolean;
  value: number | null;
}

export interface ChecklistPublicationTarget {
  assessmentId: string;
  lastPublishedAt: string;
  publishedContributions: Record<string, number>;
  publishedScoreStates: Record<string, ScoreState>;
  originalScoreStates: Record<string, ScoreState>;
}

export interface ChecklistActivity {
  id: string;
  criterionId: string;
  title: string;
  sequence: number;
  destinationComponent: ChecklistComponent;
  scoringMode: ChecklistScoringMode;
  pointsPerCheck: number;
  maxPoints: number;
  allowNotes: boolean;
  status: ChecklistStatus;
  deletedAt: string;
  checkItems: ChecklistCheckItem[];
  publicationTarget: ChecklistPublicationTarget;
}

export interface ChecklistSession {
  id: string;
  date: string;
  title: string;
  entries: Record<string, Record<string, ChecklistEntry>>;
  activity: ChecklistActivity | null;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceChecklist {
  id: string;
  assignmentId: string;
  schoolYear: string;
  term: Term;
  mapePart: MapePart | "";
  title: string;
  status: ChecklistStatus;
  criteria: ChecklistCriterion[];
  sessions: ChecklistSession[];
  publicationTargets: {
    WW: ChecklistPublicationTarget;
    PT: ChecklistPublicationTarget;
  };
  publicationHistory: ChecklistPublicationHistoryEntry[];
  entryHistory: ChecklistEntryHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ScoreChange {
  key: string;
  learnerId: string;
  before: ScoreState;
  after: ScoreState;
}

export interface ChecklistPublicationHistoryEntry {
  id: string;
  checklistId: string;
  assignmentId: string;
  activityId: string;
  activityTitle: string;
  assessmentId: string;
  component: Extract<AssessmentComponent, "WW" | "PT">;
  term: Term;
  appliedAt: string;
  assessmentBefore: { title: string; maxScore: number | "" };
  assessmentAfter: { title: string; maxScore: number | "" };
  changes: ScoreChange[];
  publicationBefore: ChecklistPublicationTarget;
  publicationAfter: ChecklistPublicationTarget;
  status: "applied" | "reverted";
  revertedAt: string;
}

export interface ChecklistEntryHistoryChange {
  sessionId: string;
  learnerId: string;
  criterionId: string;
  before: ChecklistEntry | null;
  after: ChecklistEntry | null;
}

export interface ChecklistEntryHistoryEntry {
  id: string;
  checklistId: string;
  assignmentId: string;
  operation: ChecklistEntryOperation;
  label: string;
  createdAt: string;
  changes: ChecklistEntryHistoryChange[];
  status: "applied" | "reverted";
  revertedAt: string;
}

export const CHECKLIST_COMPONENTS: ChecklistComponent[] = ["TRACKING", "WW", "PT"];
export const CHECKLIST_SCORING_MODES: ChecklistScoringMode[] = ["CHECK", "NUMERIC"];
export const CHECKLIST_HISTORY_LIMIT = 20;
export const CHECKLIST_ENTRY_HISTORY_LIMIT = 50;
