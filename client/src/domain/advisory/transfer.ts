import type {
  AdvisoryClass,
  AdvisoryGrade,
  AdvisoryImportBatch,
  AdvisoryLearner,
  AdvisoryStore,
  AdvisorySubject,
  ConflictDecision,
} from "../../models/advisory";
import {
  ADVISORY_SCHEMA_VERSION,
  GRADE_TRANSFER_FORMAT,
  GRADE_TRANSFER_SCHEMA_VERSION,
  createEmptyAdvisoryStore,
  createRecordId,
  nowIso,
} from "../../models/advisory";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { computeTermResult } from "../grading/term-result";
import { weightsToTriplet } from "../grading/weights";
import { matchAdvisoryLearner, officialFullName, type LearnerMatchStatus } from "./match";
import { normalizeMatchText } from "./match";
import { cleanText, mapehExportSubjectName, normalizeSubjectKey } from "./subjects";

export interface GradeTransferLearner {
  learnerId: string;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  fullName: string;
  finalGrade: number;
  gradeStatus: "final";
  remarks: string;
}

export interface GradeTransferFile {
  format: typeof GRADE_TRANSFER_FORMAT;
  schemaVersion: typeof GRADE_TRANSFER_SCHEMA_VERSION;
  exportId: string;
  exportedAt: string;
  appVersion: string;
  schoolYear: string;
  school: { name: string; schoolId: string; district?: string; division?: string; region?: string };
  teacher: { name: string };
  class: { id: string; name: string; gradeLevel: string; section: string };
  subject: {
    name: string;
    normalizedKey: string;
    isSpecialProgramSubject?: boolean;
    specialProgramWeights?: number[];
    strand?: string;
  };
  term: { number: 1 | 2 | 3; label: string };
  learners: GradeTransferLearner[];
}

export interface TransferValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportRow {
  index: number;
  incoming: GradeTransferLearner;
  matchedLearner: AdvisoryLearner | null;
  status: LearnerMatchStatus | "conflict";
  warning: string;
  existingGrade: AdvisoryGrade | null;
  conflictDecision: ConflictDecision | "";
  accepted: boolean;
}

export interface ImportPlan {
  payload: GradeTransferFile;
  filename: string;
  fileFingerprint: string;
  correctedReimport: boolean;
  advisoryClass: AdvisoryClass;
  subject: AdvisorySubject | null;
  rows: ImportRow[];
  errors: string[];
  warnings: string[];
  unmatchedCount: number;
  conflictCount: number;
  importableCount: number;
  unresolvedConflictCount: number;
  canImport: boolean;
}

function asTerm(value: unknown): Term | "" {
  const text = cleanText(value);
  return text === "1" || text === "2" || text === "3" ? text : "";
}

export function fileFingerprint(payload: unknown): string {
  const source = JSON.stringify(payload);
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    hashA ^= code;
    hashA = Math.imul(hashA, 0x01000193);
    hashB ^= code + index;
    hashB = Math.imul(hashB, 0x85ebca6b);
  }
  return `fnv64-${(hashA >>> 0).toString(16).padStart(8, "0")}${(hashB >>> 0).toString(16).padStart(8, "0")}`;
}

function sanitizeFilenamePart(value: string): string {
  return (
    [...cleanText(value)]
      .map((char) => {
        const code = char.charCodeAt(0);
        if (code < 32 || '<>:"/\\|?*'.includes(char)) return "-";
        return char;
      })
      .join("")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.\- ]+|[.\- ]+$/g, "")
      .slice(0, 80) || "Unknown"
  );
}

export function gradeTransferFilename(payload: GradeTransferFile): string {
  const classLabel = `Grade${payload.class.gradeLevel}-${payload.class.section}`;
  return [
    "ECR_Grades",
    `SY${sanitizeFilenamePart(payload.schoolYear)}`,
    sanitizeFilenamePart(classLabel),
    sanitizeFilenamePart(payload.subject.name),
    `Term${payload.term.number}`,
  ].join("_") + ".json";
}

export function numericFinalGrade(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "T/O") return null;
  const grade = Number(value);
  if (!Number.isFinite(grade) || grade < 60 || grade > 100) return null;
  return grade;
}

export function buildGradeTransferFromLoad(
  load: TeachingLoad,
  profile: TeacherProfile,
  term: Term,
  options: { mapePart?: MapePart; appVersion?: string; exportId?: string; exportedAt?: string } = {},
): GradeTransferFile {
  const termNumber = Number(term) as 1 | 2 | 3;
  if (![1, 2, 3].includes(termNumber)) throw new Error("Select a valid term.");
  const subjectName = options.mapePart ? mapehExportSubjectName(options.mapePart) : load.subject;
  const learners = load.learners
    .map((learner) => {
      const result = computeTermResult(load, learner.id, term, options.mapePart);
      const grade = numericFinalGrade(result.termGrade);
      if (grade === null) return null;
      return {
        learnerId: learner.id,
        lrn: cleanText(learner.lrn),
        lastName: cleanText(learner.lastName),
        firstName: cleanText(learner.firstName),
        middleName: cleanText(learner.middleName),
        extensionName: cleanText(learner.extensionName),
        fullName: officialFullName(learner),
        finalGrade: grade,
        gradeStatus: "final" as const,
        remarks: "",
      };
    })
    .filter((row): row is GradeTransferLearner => row !== null);

  if (learners.length === 0) {
    throw new Error("No numeric term finals (60–100) are ready to export for this class.");
  }

  return {
    format: GRADE_TRANSFER_FORMAT,
    schemaVersion: GRADE_TRANSFER_SCHEMA_VERSION,
    exportId: options.exportId || createRecordId("grade-export"),
    exportedAt: options.exportedAt || nowIso(),
    appVersion: options.appVersion || "1.0.0",
    schoolYear: load.schoolYear,
    school: {
      name: profile.schoolName,
      schoolId: profile.schoolId,
      district: profile.district,
      division: profile.division,
      region: profile.region,
    },
    teacher: { name: profile.teacherName },
    class: {
      id: load.id,
      name: `${load.subject} ${load.gradeLevel} - ${load.section}`,
      gradeLevel: load.gradeLevel,
      section: load.section,
    },
    subject: {
      name: subjectName,
      normalizedKey: normalizeSubjectKey(subjectName),
      ...(options.mapePart ? { strand: options.mapePart } : {}),
      ...(load.isSpecialProgramSubject
        ? {
            isSpecialProgramSubject: true,
            specialProgramWeights: [...weightsToTriplet(load.specialProgramWeights || { writtenWorks: 0, performanceTasks: 0, examination: 0 })],
          }
        : {}),
    },
    term: { number: termNumber, label: `Term ${termNumber}` },
    learners,
  };
}

export function validateGradeTransfer(payload: unknown): TransferValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { isValid: false, errors: ["This file is not a valid E-Class Record Grade Transfer File."], warnings };
  }
  const file = payload as Partial<GradeTransferFile>;
  if (file.format !== GRADE_TRANSFER_FORMAT) errors.push("This file is not a valid E-Class Record Grade Transfer File.");
  if (cleanText(file.schemaVersion) !== GRADE_TRANSFER_SCHEMA_VERSION) {
    errors.push("The selected file uses an unsupported schema version.");
  }
  if (!cleanText(file.exportId)) errors.push("The Grade Transfer File is missing its export ID.");
  if (!cleanText(file.schoolYear)) errors.push("The Grade Transfer File is missing its school year.");
  if (!file.class || !cleanText(file.class.gradeLevel) || !cleanText(file.class.section)) {
    errors.push("The Grade Transfer File is missing class grade-level or section information.");
  }
  if (!file.subject || !cleanText(file.subject.name)) {
    errors.push("The Grade Transfer File is missing subject information.");
  }
  if (file.subject?.isSpecialProgramSubject === true) {
    const weights = file.subject.specialProgramWeights;
    if (
      !Array.isArray(weights) ||
      weights.length !== 3 ||
      weights.some((weight) => !Number.isInteger(Number(weight)) || Number(weight) < 0 || Number(weight) > 100) ||
      weights.reduce((sum, weight) => sum + Number(weight), 0) !== 100
    ) {
      errors.push("The Grade Transfer File contains invalid special-program grading percentages.");
    }
  }
  const term = Number(file.term?.number);
  if (![1, 2, 3].includes(term)) errors.push("The Grade Transfer File is missing a supported term.");
  if (!Array.isArray(file.learners)) errors.push("The Grade Transfer File is missing learner grades.");
  else if (!file.learners.length) errors.push("No valid learner grades were found in this file.");

  const seenLrns = new Set<string>();
  (Array.isArray(file.learners) ? file.learners : []).forEach((learner, index) => {
    const label = `Learner row ${index + 1}`;
    const lrn = cleanText(learner?.lrn);
    if (lrn && !/^\d{12}$/.test(lrn)) errors.push(`${label} has an invalid LRN.`);
    if (lrn && seenLrns.has(lrn)) errors.push(`Two learner records use the same LRN (${lrn}).`);
    if (lrn) seenLrns.add(lrn);
    if (!cleanText(learner?.lastName) || !cleanText(learner?.firstName)) {
      errors.push(`${label} is missing the learner's official name.`);
    }
    if (numericFinalGrade(learner?.finalGrade) === null) errors.push(`${label} contains an invalid final grade.`);
    if (cleanText(learner?.gradeStatus) && cleanText(learner.gradeStatus) !== "final") {
      warnings.push(`${label} is not marked final.`);
    }
  });
  return { isValid: errors.length === 0, errors, warnings };
}

function contextValidation(payload: GradeTransferFile, advisoryClass: AdvisoryClass): string[] {
  const errors: string[] = [];
  if (cleanText(payload.schoolYear) !== cleanText(advisoryClass.schoolYear)) {
    errors.push(
      `The selected file is for School Year ${cleanText(payload.schoolYear)}, but the active Advisory Class is for School Year ${cleanText(advisoryClass.schoolYear)}.`,
    );
  }
  if (cleanText(payload.class.gradeLevel) !== cleanText(advisoryClass.gradeLevel)) {
    errors.push("The selected file grade level does not match the active Advisory Class.");
  }
  if (normalizeMatchText(payload.class.section) !== normalizeMatchText(advisoryClass.section)) {
    errors.push("The selected file section does not match the active Advisory Class.");
  }
  return errors;
}

export function recalculatePlan(plan: ImportPlan): ImportPlan {
  const importableCount = plan.rows.filter((row) => row.accepted).length;
  const unmatchedCount = plan.rows.filter((row) => row.status === "unmatched" || row.status === "ambiguous").length;
  const conflictCount = plan.rows.filter((row) => row.status === "conflict").length;
  const unresolvedConflictCount = plan.rows.filter(
    (row) => row.status === "conflict" && row.conflictDecision !== "keep" && row.conflictDecision !== "replace",
  ).length;
  const resolvedKeeps = plan.rows.filter((row) => row.status === "conflict" && row.conflictDecision === "keep").length;
  return {
    ...plan,
    importableCount,
    unmatchedCount,
    conflictCount,
    unresolvedConflictCount,
    canImport: plan.errors.length === 0 && unresolvedConflictCount === 0 && (importableCount > 0 || resolvedKeeps > 0),
  };
}

export function planGradeTransferImport(
  store: AdvisoryStore,
  advisoryClass: AdvisoryClass,
  raw: unknown,
  filename: string,
): ImportPlan {
  const validation = validateGradeTransfer(raw);
  const payload = raw as GradeTransferFile;
  const errors = [...validation.errors];
  if (validation.isValid) errors.push(...contextValidation(payload, advisoryClass));
  const warnings = [...validation.warnings];
  const fingerprint = fileFingerprint(raw);
  const sameExportBatches = store.importBatches.filter(
    (item) => item.advisoryClassId === advisoryClass.id && item.exportId === cleanText(payload?.exportId) && item.status !== "undone",
  );
  const exactDuplicate = store.importBatches.find(
    (item) =>
      item.advisoryClassId === advisoryClass.id &&
      item.status !== "undone" &&
      (item.fileFingerprint === fingerprint ||
        (item.exportId === cleanText(payload?.exportId) && (!item.fileFingerprint || item.fileFingerprint === fingerprint))),
  );
  const correctedReimport = !exactDuplicate && sameExportBatches.length > 0;
  if (exactDuplicate) errors.push("This Grade Transfer File has already been imported.");
  if (correctedReimport) {
    warnings.push("This appears to be a corrected version of a previously imported Grade Transfer File. Existing grades require a decision.");
  }

  const subjectKey = normalizeSubjectKey(payload?.subject?.normalizedKey || payload?.subject?.name);
  const subject =
    store.subjects.find(
      (item) => item.advisoryClassId === advisoryClass.id && !item.isArchived && item.normalizedSubjectKey === subjectKey,
    ) || null;
  if (!subject && validation.isValid) {
    errors.push("The subject in this Grade Transfer File is not an active subject in the Advisory Class. Configure or restore it before importing.");
  }
  if (payload?.subject?.isSpecialProgramSubject === true && (!advisoryClass.isSpecialClass || !subject?.isSpecialProgramSubject)) {
    errors.push("This special-program Grade Transfer File must match an active special subject in a Special Class.");
  }
  if (!payload?.subject?.isSpecialProgramSubject && subject?.isSpecialProgramSubject) {
    warnings.push("This older Grade Transfer File does not identify the subject as special-program, but its subject name matches an active special subject.");
  }

  const term = asTerm(payload?.term?.number);
  const roster = store.learners.filter((item) => item.advisoryClassId === advisoryClass.id);
  const rows: ImportRow[] =
    errors.length || !Array.isArray(payload?.learners)
      ? []
      : payload.learners.map((incoming, index) => {
          const match = matchAdvisoryLearner(roster, incoming);
          const existingGrade =
            match.learner && subject && term
              ? store.grades.find(
                  (item) =>
                    item.advisoryClassId === advisoryClass.id &&
                    item.advisoryLearnerId === match.learner!.id &&
                    item.advisorySubjectId === subject.id &&
                    item.term === term,
                ) || null
              : null;
          let status: ImportRow["status"] = match.status;
          let warning = match.warning;
          if (existingGrade) {
            status = "conflict";
            warning = `Saved grade ${existingGrade.finalGrade} differs from or duplicates incoming grade ${incoming.finalGrade}. Choose which value to keep.`;
          }
          return {
            index,
            incoming,
            matchedLearner: match.learner,
            status,
            warning,
            existingGrade,
            conflictDecision: "",
            accepted: status === "matched-lrn" || status === "matched-name",
          };
        });

  const matchedLearnerIds = new Set<string>();
  rows.forEach((row) => {
    if (!row.matchedLearner || !row.accepted) return;
    if (matchedLearnerIds.has(row.matchedLearner.id)) {
      row.status = "ambiguous";
      row.accepted = false;
      row.warning = "Another file row already matches this Advisory learner.";
    } else matchedLearnerIds.add(row.matchedLearner.id);
  });
  const unmatchedCount = rows.filter((row) => row.status === "unmatched" || row.status === "ambiguous").length;
  if (unmatchedCount) {
    warnings.push(`${unmatchedCount} learner${unmatchedCount === 1 ? "" : "s"} could not be matched safely and will remain unresolved.`);
  }

  return recalculatePlan({
    payload,
    filename: cleanText(filename) || "Grade-Transfer-File.json",
    fileFingerprint: fingerprint,
    correctedReimport,
    advisoryClass,
    subject,
    rows,
    errors,
    warnings,
    unmatchedCount,
    conflictCount: 0,
    importableCount: 0,
    unresolvedConflictCount: 0,
    canImport: false,
  });
}

export function setConflictDecision(plan: ImportPlan, rowIndex: number, decision: ConflictDecision): ImportPlan {
  const rows = plan.rows.map((row) =>
    row.index === rowIndex && row.status === "conflict"
      ? { ...row, conflictDecision: decision, accepted: decision === "replace" }
      : row,
  );
  return recalculatePlan({ ...plan, rows });
}

export function applyConflictDecisionToAll(plan: ImportPlan, decision: ConflictDecision): ImportPlan {
  const rows = plan.rows.map((row) =>
    row.status === "conflict" ? { ...row, conflictDecision: decision, accepted: decision === "replace" } : row,
  );
  return recalculatePlan({ ...plan, rows });
}

export function assignUnmatchedLearner(store: AdvisoryStore, plan: ImportPlan, rowIndex: number, learnerId: string): ImportPlan {
  const learner = store.learners.find((item) => item.id === learnerId && item.advisoryClassId === plan.advisoryClass.id);
  const term = asTerm(plan.payload.term.number);
  const rows = plan.rows.map((row) => {
    if (row.index !== rowIndex || (row.status !== "unmatched" && row.status !== "ambiguous") || !learner) return row;
    if (plan.rows.some((item) => item.index !== row.index && item.accepted && item.matchedLearner?.id === learner.id)) {
      throw new Error("Another incoming row is already matched to this Advisory learner.");
    }
    const existingGrade =
      plan.subject && term
        ? store.grades.find(
            (item) =>
              item.advisoryClassId === plan.advisoryClass.id &&
              item.advisoryLearnerId === learner.id &&
              item.advisorySubjectId === plan.subject!.id &&
              item.term === term,
          ) || null
        : null;
    if (existingGrade) {
      return {
        ...row,
        matchedLearner: learner,
        existingGrade,
        status: "conflict" as const,
        conflictDecision: "" as const,
        accepted: false,
        warning: `Manually matched. Saved grade ${existingGrade.finalGrade} requires a keep/replace decision.`,
      };
    }
    return {
      ...row,
      matchedLearner: learner,
      existingGrade: null,
      status: "matched-manual" as const,
      accepted: true,
      warning: "Manually matched by the adviser.",
    };
  });
  return recalculatePlan({ ...plan, rows });
}

function cloneStore(store: AdvisoryStore): AdvisoryStore {
  return JSON.parse(JSON.stringify(store)) as AdvisoryStore;
}

export function applyGradeTransferImport(store: AdvisoryStore, plan: ImportPlan): AdvisoryStore {
  if (!plan.canImport || !plan.subject) throw new Error("This import plan is not ready for confirmation.");
  const next = cloneStore(store);
  const importedAt = nowIso();
  const acceptedRows = plan.rows.filter((row) => row.accepted && row.matchedLearner);
  const conflictDecisions: Record<string, ConflictDecision> = {};
  plan.rows
    .filter((row) => row.status === "conflict" && (row.conflictDecision === "keep" || row.conflictDecision === "replace"))
    .forEach((row) => {
      conflictDecisions[String(row.index)] = row.conflictDecision as ConflictDecision;
    });
  const batch: AdvisoryImportBatch = {
    id: createRecordId("grade-import"),
    advisoryClassId: plan.advisoryClass.id,
    exportId: cleanText(plan.payload.exportId),
    filename: plan.filename,
    fileFingerprint: plan.fileFingerprint,
    schemaVersion: cleanText(plan.payload.schemaVersion),
    schoolYear: cleanText(plan.payload.schoolYear),
    subject: cleanText(plan.payload.subject.name),
    term: String(plan.payload.term.number) as Term,
    sourceTeacher: cleanText(plan.payload.teacher?.name),
    sourceClass: cleanText(plan.payload.class.name),
    exportedAt: cleanText(plan.payload.exportedAt),
    importedAt,
    totalRecords: plan.rows.length,
    importedCount: acceptedRows.length,
    skippedCount: plan.rows.length - acceptedRows.length,
    updatedCount: acceptedRows.filter((row) => row.existingGrade).length,
    unmatchedCount: plan.unmatchedCount,
    conflictCount: plan.conflictCount,
    status: acceptedRows.length === plan.rows.length ? "complete" : "partial",
    conflictDecisions,
    undoMetadata: { entries: [] },
    createdAt: importedAt,
    updatedAt: importedAt,
  };

  acceptedRows.forEach((row) => {
    const learner = row.matchedLearner!;
    const values: AdvisoryGrade = {
      id: row.existingGrade?.id || createRecordId("advisory-grade"),
      advisoryClassId: plan.advisoryClass.id,
      advisoryLearnerId: learner.id,
      advisorySubjectId: plan.subject!.id,
      schoolYear: cleanText(plan.payload.schoolYear),
      learnerLrn: cleanText(row.incoming.lrn || learner.lrn),
      subjectName: cleanText(plan.payload.subject.name),
      normalizedSubjectKey: plan.subject!.normalizedSubjectKey,
      gradeLevel: cleanText(plan.payload.class.gradeLevel),
      section: cleanText(plan.payload.class.section),
      term: String(plan.payload.term.number) as Term,
      finalGrade: Number(row.incoming.finalGrade),
      gradeStatus: "final",
      sourceType: "grade-transfer-file",
      sourceClassId: cleanText(plan.payload.class.id),
      sourceClassName: cleanText(plan.payload.class.name),
      sourceTeacherName: cleanText(plan.payload.teacher?.name),
      exportId: cleanText(plan.payload.exportId),
      importBatchId: batch.id,
      exportedAt: cleanText(plan.payload.exportedAt),
      importedAt,
      validationStatus: "valid",
      conflictStatus: row.existingGrade ? "resolved" : "none",
      remarks: cleanText(row.incoming.remarks),
      createdAt: row.existingGrade?.createdAt || importedAt,
      updatedAt: importedAt,
    };
    if (row.existingGrade) {
      batch.undoMetadata.entries.push({ action: "updated", gradeId: row.existingGrade.id, previous: row.existingGrade });
      const index = next.grades.findIndex((item) => item.id === row.existingGrade!.id);
      next.grades[index] = values;
    } else {
      batch.undoMetadata.entries.push({ action: "created", gradeId: values.id });
      next.grades.push(values);
    }
  });

  if (
    !next.sourceMappings.some(
      (item) => item.advisoryClassId === plan.advisoryClass.id && item.importedNormalizedKey === plan.subject!.normalizedSubjectKey,
    )
  ) {
    const stamped = nowIso();
    next.sourceMappings.push({
      id: createRecordId("subject-source"),
      advisoryClassId: plan.advisoryClass.id,
      importedSubjectName: plan.subject.subjectName,
      importedNormalizedKey: plan.subject.normalizedSubjectKey,
      advisorySubjectId: plan.subject.id,
      sourceTeacher: cleanText(plan.payload.teacher?.name),
      sourceClass: cleanText(plan.payload.class.name),
      schoolYear: cleanText(plan.payload.schoolYear),
      createdAt: stamped,
      updatedAt: stamped,
    });
  }

  next.importBatches.push(batch);
  return next;
}

export function undoLatestImport(store: AdvisoryStore, advisoryClassId: string): AdvisoryStore {
  const next = cloneStore(store);
  const batch = [...next.importBatches]
    .reverse()
    .find((item) => item.advisoryClassId === advisoryClassId && item.status !== "undone");
  if (!batch) throw new Error("There is no import to undo.");
  for (const entry of [...batch.undoMetadata.entries].reverse()) {
    if (entry.action === "created") {
      next.grades = next.grades.filter((item) => item.id !== entry.gradeId);
    } else if (entry.action === "updated" && entry.previous) {
      const changed = next.grades.find((item) => item.id === entry.gradeId);
      if (changed && changed.updatedAt !== entry.previous.updatedAt && changed.importBatchId !== batch.id) {
        throw new Error("Undo refused: a grade changed after that import.");
      }
      const index = next.grades.findIndex((item) => item.id === entry.gradeId);
      if (index >= 0) next.grades[index] = entry.previous;
    }
  }
  const index = next.importBatches.findIndex((item) => item.id === batch.id);
  next.importBatches[index] = { ...batch, status: "undone", updatedAt: nowIso() };
  return next;
}

export function parseAdvisoryStore(value: unknown): AdvisoryStore {
  if (!value || typeof value !== "object") return createEmptyAdvisoryStore();
  const item = value as Partial<AdvisoryStore>;
  return {
    schemaVersion: Number(item.schemaVersion) || ADVISORY_SCHEMA_VERSION,
    classes: Array.isArray(item.classes) ? item.classes : [],
    learners: Array.isArray(item.learners) ? item.learners : [],
    subjects: Array.isArray(item.subjects) ? item.subjects : [],
    grades: Array.isArray(item.grades) ? item.grades : [],
    importBatches: Array.isArray(item.importBatches) ? item.importBatches : [],
    sourceMappings: Array.isArray(item.sourceMappings) ? item.sourceMappings : [],
  };
}
