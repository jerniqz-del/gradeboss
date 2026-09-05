import type { GradingPolicy } from "../models/types";

/** Infer DepEd policy from numeric grade level (Phase 2 will expand subject-aware rules). */
export function detectPolicy(gradeLevel: number): GradingPolicy {
  if (gradeLevel >= 1 && gradeLevel <= 3) return "DO15_DESCRIPTIVE";
  if (gradeLevel >= 4 && gradeLevel <= 6) return "KEY_STAGE_2_TRIMESTER";
  return "DO15_TRANSITION";
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
