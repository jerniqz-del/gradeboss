import { createDefaultProfile, type TeacherProfile } from "../../models/teacher-profile";
import type { LegacyGradebook } from "../../models/legacy";
import type { TeachingLoad } from "../../models/teaching-load";
import type { SchoolClass } from "../../classes";
import { createEmptyAdvisoryStore, type AdvisoryStore } from "../../models/advisory";
import { createEmptyCalendarStore, type CalendarStore } from "../../models/calendar";
import { createEmptyWorkplaceStore, type WorkplaceStore } from "../../models/workplace";
import { parseAdvisoryStore } from "../../domain/advisory/transfer";
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupBundle } from "./types";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asProfile(value: unknown): TeacherProfile {
  const fallback = createDefaultProfile();
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<TeacherProfile>;
  return {
    ...fallback,
    ...item,
    teacherName: typeof item.teacherName === "string" ? item.teacherName : fallback.teacherName,
    schoolYear: typeof item.schoolYear === "string" ? item.schoolYear : fallback.schoolYear,
    currentTerm: item.currentTerm === "2" || item.currentTerm === "3" ? item.currentTerm : "1",
  };
}

function asLegacy(value: unknown): LegacyGradebook {
  if (!value || typeof value !== "object") return { students: [], courses: [], grades: [] };
  const item = value as Partial<LegacyGradebook>;
  return {
    students: asArray(item.students),
    courses: asArray(item.courses),
    grades: asArray(item.grades),
  };
}

export function buildBackupBundle(input: {
  profile?: TeacherProfile;
  teachingLoads: TeachingLoad[];
  legacy?: LegacyGradebook;
  schoolClasses?: SchoolClass[];
  advisory?: AdvisoryStore;
  calendar?: CalendarStore;
  workplace?: WorkplaceStore;
  exportedAt?: string;
}): BackupBundle {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: input.exportedAt || new Date().toISOString(),
    profile: input.profile || createDefaultProfile(),
    teachingLoads: input.teachingLoads,
    legacy: input.legacy || { students: [], courses: [], grades: [] },
    schoolClasses: input.schoolClasses || [],
    advisory: input.advisory || createEmptyAdvisoryStore(),
    calendar: input.calendar || createEmptyCalendarStore(),
    workplace: input.workplace || createEmptyWorkplaceStore(),
  };
}

export function parseBackupBundle(value: unknown): BackupBundle {
  if (!value || typeof value !== "object") {
    throw new Error("This file is not a GradeBoss backup.");
  }
  const item = value as Partial<BackupBundle>;
  if (item.format !== BACKUP_FORMAT) {
    throw new Error("This file is not a GradeBoss backup.");
  }
  if (item.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version (${String(item.version)}).`);
  }
  const teachingLoads = asArray<TeachingLoad>(item.teachingLoads);
  if (teachingLoads.some((load) => !load || typeof load !== "object" || typeof load.id !== "string")) {
    throw new Error("Backup teaching loads are missing or invalid.");
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof item.exportedAt === "string" ? item.exportedAt : new Date().toISOString(),
    profile: asProfile(item.profile),
    teachingLoads,
    legacy: asLegacy(item.legacy),
    schoolClasses: asArray<SchoolClass>(item.schoolClasses),
    advisory: parseAdvisoryStore(item.advisory),
    calendar: item.calendar || createEmptyCalendarStore(),
    workplace: item.workplace || createEmptyWorkplaceStore(),
  };
}

export function mergeBackupBundles(local: BackupBundle, incoming: BackupBundle): BackupBundle {
  const byId = new Map(local.teachingLoads.map((load) => [load.id, load]));
  for (const load of incoming.teachingLoads) byId.set(load.id, load);

  const students = new Map(local.legacy.students.map((row) => [row.id, row]));
  for (const row of incoming.legacy.students) students.set(row.id, row);
  const courses = new Map(local.legacy.courses.map((row) => [row.id, row]));
  for (const row of incoming.legacy.courses) courses.set(row.id, row);
  const grades = new Map(local.legacy.grades.map((row) => [row.id, row]));
  for (const row of incoming.legacy.grades) grades.set(row.id, row);

  const classes = new Map(local.schoolClasses.map((row) => [row.id, row]));
  for (const row of incoming.schoolClasses) classes.set(row.id, row);

  const mergeById = <T extends { id: string }>(localRows: T[], incomingRows: T[]): T[] => {
    const map = new Map(localRows.map((row) => [row.id, row]));
    for (const row of incomingRows) map.set(row.id, row);
    return [...map.values()];
  };

  return buildBackupBundle({
    profile: incoming.profile,
    teachingLoads: [...byId.values()],
    legacy: {
      students: [...students.values()],
      courses: [...courses.values()],
      grades: [...grades.values()],
    },
    schoolClasses: [...classes.values()],
    advisory: {
      schemaVersion: incoming.advisory.schemaVersion || local.advisory.schemaVersion,
      classes: mergeById(local.advisory.classes, incoming.advisory.classes),
      learners: mergeById(local.advisory.learners, incoming.advisory.learners),
      subjects: mergeById(local.advisory.subjects, incoming.advisory.subjects),
      grades: mergeById(local.advisory.grades, incoming.advisory.grades),
      importBatches: mergeById(local.advisory.importBatches, incoming.advisory.importBatches),
      sourceMappings: mergeById(local.advisory.sourceMappings, incoming.advisory.sourceMappings),
    },
    calendar: {
      version: 1,
      events: mergeById(local.calendar?.events || [], incoming.calendar?.events || []),
      filters: incoming.calendar?.filters || local.calendar?.filters || createEmptyCalendarStore().filters,
    },
    workplace: incoming.workplace || local.workplace || createEmptyWorkplaceStore(),
    exportedAt: incoming.exportedAt,
  });
}
