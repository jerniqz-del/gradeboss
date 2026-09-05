import {
  determinePolicy,
  determineSubjectGroup,
  weightsFor,
} from "../../domain/grading";
import type { TeachingLoad } from "../../models/teaching-load";
import { createLearner } from "../roster/learner";
import { createTemplateAssessments } from "./catalog";

export interface CreateLoadInput {
  gradeLevel: string;
  section: string;
  subject: string;
  schoolYear: string;
  shsSubjectGroup?: string;
}

export function createTeachingLoad(input: CreateLoadInput): TeachingLoad {
  const now = new Date().toISOString();
  const policy = determinePolicy(input.gradeLevel, input.subject, input.schoolYear);
  const subjectGroup = determineSubjectGroup(
    input.gradeLevel,
    input.subject,
    policy,
    input.shsSubjectGroup,
  );
  return {
    id: crypto.randomUUID(),
    gradeLevel: input.gradeLevel,
    section: input.section.trim() || "Unassigned",
    subject: input.subject,
    subjectGroup,
    ...(input.shsSubjectGroup ? { shsSubjectGroup: input.shsSubjectGroup } : {}),
    policy,
    schoolYear: input.schoolYear,
    dashboardOrder: Date.now(),
    learners: [],
    assessments: createTemplateAssessments(input.gradeLevel, input.subject),
    scores: {},
    createdAt: now,
    updatedAt: now,
  };
}

export { createLearner };

export function formatWeights(group: string): string {
  const [ww, pt, exam] = weightsFor(group);
  return `${ww}/${pt}/${exam}`;
}

export function policyLabel(policy: string): string {
  switch (policy) {
    case "DO15_TRANSITION":
      return "DO 015 transition";
    case "DO15_ZERO":
      return "DO 015 zero-based";
    case "DO15_DESCRIPTIVE":
      return "Descriptive (A–E)";
    case "KEY_STAGE_2_TRIMESTER":
      return "KS2 trimester";
    case "DO8_2015":
      return "DO 8 s. 2015";
    default:
      return policy;
  }
}
