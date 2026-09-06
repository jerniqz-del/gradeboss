import type { Sf1Meta } from "../sf1";
import type { Assessment } from "./assessment";
import type { AttendanceState } from "./attendance";
import type { PerformanceChecklist } from "./checklist";
import type { Learner } from "./learner";
import type { ScoreHistoryEntry } from "./score-history";
import type {
  ComponentWeights,
  GradingPolicy,
  ScoreMap,
} from "./types";

export interface TeachingLoad {
  id: string;
  gradeLevel: string;
  section: string;
  subject: string;
  subjectGroup: string;
  shsSubjectGroup?: string;
  isSpecialProgramSubject?: boolean;
  specialProgramWeights?: ComponentWeights;
  policy: GradingPolicy;
  schoolYear: string;
  dashboardOrder: number;
  /** Link back to an SF1 import (`gradeboss:classes` id) when created from roster. */
  sourceClassId?: string;
  sf1Meta?: Partial<Sf1Meta>;
  learners: Learner[];
  assessments: Assessment[];
  scores: ScoreMap;
  attendance?: AttendanceState;
  /** Performance checklists for this load (Phase 10). */
  checklists?: PerformanceChecklist[];
  /** Per-cell score audit (Phase 10). */
  scoreHistory?: ScoreHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
