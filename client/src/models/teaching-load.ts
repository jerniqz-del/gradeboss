import type { Sf1Meta } from "../sf1";
import type { Assessment } from "./assessment";
import type { AttendanceState } from "./attendance";
import type { Learner } from "./learner";
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
  createdAt: string;
  updatedAt: string;
}
