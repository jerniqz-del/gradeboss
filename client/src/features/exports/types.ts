import type { SchoolClass } from "../../classes";
import type { LegacyGradebook } from "../../models/legacy";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";

export const BACKUP_FORMAT = "gradeboss-backup";
export const SEALED_FORMAT = "gradeboss-backup-sealed";
export const BACKUP_VERSION = 1;

export type BackupMode = "replace" | "merge";

export interface BackupBundle {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  profile: TeacherProfile;
  teachingLoads: TeachingLoad[];
  legacy: LegacyGradebook;
  schoolClasses: SchoolClass[];
}

export interface SealedBackup {
  format: typeof SEALED_FORMAT;
  version: number;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export type BackupFile = BackupBundle | SealedBackup;
