import type { Term } from "./types";

/** Workplace dashboard store — ported from eclassrecord `dashboard-workplace.js`. */

export const WORKPLACE_STORE_VERSION = 1;

export type WorkplaceAction = "grading" | "advisory" | "calendar" | "classes" | "learner";
export type WorkplaceSeverity = "danger" | "warning" | "info";
export type WorkplaceTaskKind =
  | "empty-class"
  | "invalid-scores"
  | "missing-hps"
  | "incomplete-scores"
  | "upcoming-deadline"
  | "advisory-conflicts"
  | "advisory-missing"
  | "pending-import";

export interface WorkplaceTask {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  createdAt: string;
}

export interface WorkplacePreferences {
  collapsedPanels: string[];
  includeDuplicateLearners: boolean;
  analyticsScope: "all" | "current";
  attentionScope: "all" | "current";
}

export interface WorkplaceContext {
  assignmentId: string;
  term: Term;
  action: WorkplaceAction;
}

export interface WorkplaceStore {
  version: number;
  tasks: WorkplaceTask[];
  preferences: WorkplacePreferences;
  lastContext: WorkplaceContext;
}

export function createEmptyWorkplaceStore(): WorkplaceStore {
  return {
    version: WORKPLACE_STORE_VERSION,
    tasks: [],
    preferences: {
      collapsedPanels: [],
      includeDuplicateLearners: true,
      analyticsScope: "all",
      attentionScope: "all",
    },
    lastContext: {
      assignmentId: "",
      term: "1",
      action: "grading",
    },
  };
}

export function createWorkplaceTaskId(): string {
  return `work-task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
