import type { GradingPolicy } from "../models/types";
import type { GradingOptions, PolicyInput } from "./grading/types";

/** Infer DepEd policy from numeric grade level (kept for Phase 1 callers). */
export function detectPolicy(gradeLevel: number, subject?: string, schoolYear?: string): GradingPolicy {
  return determinePolicy(gradeLevel, subject, schoolYear);
}

export function parseGradeLevel(value: string | number): number {
  const n = typeof value === "number" ? value : parseInt(String(value).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 0;
}

export function defaultSubjectGroup(gradeLevel: number): string {
  if (gradeLevel >= 11) return "SHS_CORE";
  if (gradeLevel >= 7) return "JHS_CORE";
  if (gradeLevel >= 4) return "KS2_TRIMESTER";
  if (gradeLevel >= 1) return "KS1_DESCRIPTIVE";
  return "GENERAL";
}

/**
 * Automatically determines the policy mode from grade, subject, and school year.
 * Port of eclassrecord `determinePolicy` in `grading.js`.
 */
export function determinePolicy(
  gradeLevel: string | number,
  _subject?: string,
  schoolYear?: string,
): GradingPolicy {
  const grade = parseInt(String(gradeLevel), 10);

  let startYear = 2026;
  if (schoolYear) {
    const parts = String(schoolYear).split("-");
    const parsed = parseInt(parts[0], 10);
    if (!Number.isNaN(parsed)) startYear = parsed;
  }

  if (grade <= 3) {
    if (grade === 1) return "DO15_DESCRIPTIVE";
    if (grade === 2) return startYear >= 2027 ? "DO15_DESCRIPTIVE" : "DO15_TRANSITION";
    if (grade === 3) {
      if (startYear === 2026) return "DO15_TRANSITION";
      if (startYear === 2027) return "DO15_ZERO";
      return "DO15_DESCRIPTIVE";
    }
  }

  if (grade >= 4 && grade <= 6) return "KEY_STAGE_2_TRIMESTER";

  if (startYear >= 2027) return "DO15_ZERO";
  return "DO15_TRANSITION";
}

export function isZeroBasedSchoolYear(schoolYear?: string): boolean {
  if (!schoolYear) return false;
  const startYear = parseInt(String(schoolYear).split("-")[0], 10);
  return !Number.isNaN(startYear) && startYear >= 2027;
}

export function isKeyStage2Load(load: PolicyInput, options?: GradingOptions): boolean {
  if (options?.useUniversalTrimesterLayout) return true;
  const grade = parseInt(String(load.gradeLevel), 10);
  return grade >= 4 && grade <= 6;
}

export function isMapehSubject(subject?: string): boolean {
  const s = (subject || "").toLowerCase();
  return s === "mapeh" || s.includes("mapeh") || s.includes("music and arts") || s.includes("physical education and health");
}
