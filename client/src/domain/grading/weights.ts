import type { ComponentWeights } from "../../models/types";
import { DEFAULT_WEIGHTS } from "../../models/types";
import type { ExamComponent, PolicyInput, WeightTriplet } from "./types";
import { parseGradeLevel } from "../policy";

export const SENIOR_HIGH_SUBJECT_GROUPS = Object.freeze({
  SHS_CORE: { label: "Core Subject", weights: [20, 50, 30] as WeightTriplet },
  SHS_ACADEMIC: { label: "Academic - All Other Electives", weights: [20, 50, 30] as WeightTriplet },
  SHS_ARTS: { label: "Sports and Arts Elective", weights: [20, 60, 20] as WeightTriplet },
  SHS_FIELD: { label: "Field Experience / Exposure", weights: [15, 70, 15] as WeightTriplet },
  SHS_RESEARCH: { label: "Research, Design and Innovation", weights: [40, 60, 0] as WeightTriplet },
  SHS_TECHPRO: { label: "TechPro - All Other Electives", weights: [15, 65, 20] as WeightTriplet },
  SHS_WORK: { label: "Work Immersion", weights: [20, 80, 0] as WeightTriplet },
});

export type SeniorHighSubjectGroup = keyof typeof SENIOR_HIGH_SUBJECT_GROUPS;

const WEIGHT_PRESETS: Record<string, WeightTriplet> = {
  KS2_TRIMESTER: [20, 50, 30],
  CORE_20_50_30: [20, 50, 30],
  SKILLS_20_60_20: [20, 60, 20],
  JHS_CORE: [20, 50, 30],
  KS1_DESCRIPTIVE: [20, 50, 30],
  GENERAL: [20, 50, 30],
  ...Object.fromEntries(
    Object.entries(SENIOR_HIGH_SUBJECT_GROUPS).map(([key, config]) => [key, config.weights]),
  ),
  SHS_ARTS_SPORTS: SENIOR_HIGH_SUBJECT_GROUPS.SHS_ARTS.weights,
};

const SHS_GROUP_ALIASES: Record<string, SeniorHighSubjectGroup> = {
  SHS_ARTS_SPORTS: "SHS_ARTS",
};

export function tripletToWeights(triplet: WeightTriplet | number[]): ComponentWeights {
  return {
    writtenWorks: Number(triplet[0]) || 0,
    performanceTasks: Number(triplet[1]) || 0,
    examination: Number(triplet[2]) || 0,
  };
}

export function weightsToTriplet(weights: ComponentWeights): WeightTriplet {
  return [weights.writtenWorks, weights.performanceTasks, weights.examination];
}

/** Returns [WW, PT, Exam] percentages. Unknown groups fall back to 20/50/30. */
export function weightsFor(group?: string): WeightTriplet {
  return WEIGHT_PRESETS[group || ""] || [20, 50, 30];
}

export function normalizeSeniorHighSubjectGroup(value?: string): SeniorHighSubjectGroup | "" {
  const normalized = SHS_GROUP_ALIASES[value || ""] || value;
  return normalized && normalized in SENIOR_HIGH_SUBJECT_GROUPS
    ? (normalized as SeniorHighSubjectGroup)
    : "";
}

export function normalizeSpecialProgramWeights(
  value: ComponentWeights | WeightTriplet | number[] | null | undefined,
): WeightTriplet | null {
  let weights: number[] | null = null;
  if (Array.isArray(value) && value.length === 3) {
    weights = value.map(Number);
  } else if (value && typeof value === "object" && "writtenWorks" in value) {
    weights = [value.writtenWorks, value.performanceTasks, value.examination];
  }
  if (!weights) return null;
  if (weights.some((weight) => !Number.isInteger(weight) || weight < 0 || weight > 100)) return null;
  return weights.reduce((sum, weight) => sum + weight, 0) === 100
    ? (weights as unknown as WeightTriplet)
    : null;
}

export function weightsForLoad(load: PolicyInput): WeightTriplet {
  if (load.isSpecialProgramSubject) {
    const custom = normalizeSpecialProgramWeights(load.specialProgramWeights);
    if (custom) return custom;
  }
  return weightsFor(load.subjectGroup);
}

export function weightsForLoadAsObject(load: PolicyInput): ComponentWeights {
  const triplet = weightsForLoad(load);
  return tripletToWeights(triplet);
}

/**
 * Catalog + keyword detection from eclassrecord `determineSubjectGroup`.
 * SHS catalog lookup is handled by the caller via `shsSubjectGroup` / override.
 */
export function determineSubjectGroup(
  gradeLevel: string | number,
  subject?: string,
  _policy?: string,
  seniorHighOverride?: string,
): string {
  const grade = parseInt(String(gradeLevel), 10);
  const s = (subject || "").toLowerCase();

  if (grade >= 11) {
    const explicitGroup = normalizeSeniorHighSubjectGroup(seniorHighOverride);
    if (explicitGroup) return explicitGroup;
    if (/work\s*immersion/i.test(s)) return "SHS_WORK";
    if (/field\s*experience|field\s*exposure|exposure|arts?\s*apprenticeship|creative\s*production/i.test(s)) {
      return "SHS_FIELD";
    }
    if (/research|design\s*(and|&)\s*innovation/i.test(s)) return "SHS_RESEARCH";
    if (/techpro|nc\s*i{1,3}\b/i.test(s)) return "SHS_TECHPRO";
    if (/\barts?\b|\bsports?\b|health and wellness|human movement|physical education/i.test(s)) {
      return "SHS_ARTS";
    }
    const coreSubjects = new Set([
      "effective communication",
      "mabisang komunikasyon",
      "general mathematics",
      "general science",
      "life and career skills",
    ]);
    return coreSubjects.has(s.trim()) ? "SHS_CORE" : "SHS_ACADEMIC";
  }

  if (/mapeh|music|arts|physical|health|tle|epp|livelihood|pantahanan|pangkabuhayan|technology/i.test(s)) {
    return "SKILLS_20_60_20";
  }
  if (grade >= 4 && grade <= 6) return "KS2_TRIMESTER";
  return "CORE_20_50_30";
}

export function examinationComponentsForLoad(load: PolicyInput): ExamComponent[] {
  const grade = parseGradeLevel(load.gradeLevel);
  if (grade < 11 || grade > 12) return ["ST1", "ST2", "TE"];

  const explicitGroup = normalizeSeniorHighSubjectGroup(load.shsSubjectGroup || load.subjectGroup);
  const group =
    explicitGroup ||
    determineSubjectGroup(load.gradeLevel, load.subject, load.policy, load.shsSubjectGroup);

  if (group === "SHS_RESEARCH" || group === "SHS_WORK") return [];
  if (group === "SHS_FIELD") return ["TE"];
  return ["ST1", "ST2", "TE"];
}

export { DEFAULT_WEIGHTS };
