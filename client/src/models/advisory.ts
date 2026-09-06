import type { Learner } from "./learner";
import type { Sex, Term } from "./types";

export const ADVISORY_SCHEMA_VERSION = 1;
export const GRADE_TRANSFER_FORMAT = "eclass-record-grade-export";
export const GRADE_TRANSFER_SCHEMA_VERSION = "1.0";

export type AdvisorySourceType = "grade-transfer-file" | "local-subject-class" | "manual";
export type AdvisoryEnrollmentStatus = "active" | "inactive";
export type ImportBatchStatus = "pending" | "complete" | "partial" | "undone";
export type ConflictDecision = "keep" | "replace";

export interface AdvisoryClass {
  id: string;
  schoolYear: string;
  gradeLevel: string;
  section: string;
  adviserName: string;
  schoolName: string;
  schoolId: string;
  district: string;
  division: string;
  region: string;
  isSpecialClass: boolean;
  specialProgramName: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisoryLearner {
  id: string;
  advisoryClassId: string;
  linkedLearnerId: string;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  sex: Sex;
  avatarPresetId: string;
  avatarAssignment: "auto" | "manual";
  birthdate: string;
  enrollmentStatus: AdvisoryEnrollmentStatus;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorySubject {
  id: string;
  advisoryClassId: string;
  subjectName: string;
  normalizedSubjectKey: string;
  expectedSourceTeacher: string;
  expectedSourceClass: string;
  expectedSourceClassId: string;
  sourceType: AdvisorySourceType;
  displayOrder: number;
  isSpecialProgramSubject: boolean;
  includeInGeneralAverage: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisoryGrade {
  id: string;
  advisoryClassId: string;
  advisoryLearnerId: string;
  advisorySubjectId: string;
  schoolYear: string;
  learnerLrn: string;
  subjectName: string;
  normalizedSubjectKey: string;
  gradeLevel: string;
  section: string;
  term: Term;
  finalGrade: number;
  gradeStatus: "final";
  sourceType: AdvisorySourceType;
  sourceClassId: string;
  sourceClassName: string;
  sourceTeacherName: string;
  exportId: string;
  importBatchId: string;
  exportedAt: string;
  importedAt: string;
  validationStatus: "valid";
  conflictStatus: "none" | "resolved";
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisoryUndoEntry {
  action: "created" | "updated";
  gradeId: string;
  previous?: AdvisoryGrade;
}

export interface AdvisoryImportBatch {
  id: string;
  advisoryClassId: string;
  exportId: string;
  filename: string;
  fileFingerprint: string;
  schemaVersion: string;
  schoolYear: string;
  subject: string;
  term: Term;
  sourceTeacher: string;
  sourceClass: string;
  exportedAt: string;
  importedAt: string;
  totalRecords: number;
  importedCount: number;
  skippedCount: number;
  updatedCount: number;
  unmatchedCount: number;
  conflictCount: number;
  status: ImportBatchStatus;
  conflictDecisions: Record<string, ConflictDecision>;
  undoMetadata: { entries: AdvisoryUndoEntry[] };
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorySourceMapping {
  id: string;
  advisoryClassId: string;
  importedSubjectName: string;
  importedNormalizedKey: string;
  advisorySubjectId: string;
  sourceTeacher: string;
  sourceClass: string;
  schoolYear: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisoryStore {
  schemaVersion: number;
  classes: AdvisoryClass[];
  learners: AdvisoryLearner[];
  subjects: AdvisorySubject[];
  grades: AdvisoryGrade[];
  importBatches: AdvisoryImportBatch[];
  sourceMappings: AdvisorySourceMapping[];
}

export function createEmptyAdvisoryStore(): AdvisoryStore {
  return {
    schemaVersion: ADVISORY_SCHEMA_VERSION,
    classes: [],
    learners: [],
    subjects: [],
    grades: [],
    importBatches: [],
    sourceMappings: [],
  };
}

export function createRecordId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function advisoryLearnerAsLearner(row: AdvisoryLearner): Learner {
  return {
    id: row.id,
    lrn: row.lrn,
    lastName: row.lastName,
    firstName: row.firstName,
    middleName: row.middleName,
    extensionName: row.extensionName,
    sex: row.sex,
    birthdate: row.birthdate,
    avatarPresetId: row.avatarPresetId,
    avatarAssignment: row.avatarAssignment,
  };
}
