import { createDefaultProfile, type TeacherProfile } from "../../models/teacher-profile";
import type { LegacyGradebook } from "../../models/legacy";
import type { TeachingLoad } from "../../models/teaching-load";
import type { SchoolClass } from "../../classes";
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

  return buildBackupBundle({
    profile: incoming.profile,
    teachingLoads: [...byId.values()],
    legacy: {
      students: [...students.values()],
      courses: [...courses.values()],
      grades: [...grades.values()],
    },
    schoolClasses: [...classes.values()],
    exportedAt: incoming.exportedAt,
  });
}
