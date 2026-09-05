import type { Assessment } from "../../models/assessment";
import { scoreKey } from "../../models/assessment";
import type { AssessmentComponent, MapePart, ScoreMap, Term } from "../../models/types";
import type { ComponentScore, ExamComponent, PolicyInput } from "./types";
import { examinationComponentsForLoad } from "./weights";

function toNumber(value: unknown): number {
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? 0 : n;
}

export function canonicalAssessmentComponent(component?: string): string {
  if (component === "SA1") return "ST1";
  if (component === "SA2") return "ST2";
  return component || "";
}

export function isAssessmentIncludedForLoad(load: PolicyInput, assessment: Pick<Assessment, "component">): boolean {
  const component = canonicalAssessmentComponent(assessment.component);
  if (!["ST1", "ST2", "TE"].includes(component)) return true;
  return examinationComponentsForLoad(load).includes(component as ExamComponent);
}

/**
 * Component PS = Σ(scores) / Σ(HPS) × 100.
 * Assessments with HPS ≤ 0 are skipped. Missing scores count as 0 toward raw
 * but still include their HPS in the denominator (desktop `componentScore`).
 */
export function componentScore(
  assessments: Assessment[],
  scores: ScoreMap,
  learnerId: string,
  term: Term | string,
  components: readonly string[],
  mapePart?: MapePart,
): ComponentScore {
  let raw = 0;
  let max = 0;
  let hasData = false;

  for (const item of assessments) {
    if (String(item.term) !== String(term)) continue;
    if (!components.includes(item.component) && !components.includes(canonicalAssessmentComponent(item.component))) {
      continue;
    }
    if (mapePart && item.mapePart !== mapePart) continue;

    const maxScoreVal = toNumber(item.maxScore);
    if (maxScoreVal <= 0) continue;

    max += maxScoreVal;
    const val = scores[scoreKey(learnerId, item.id)];
    if (val !== undefined && val !== "") {
      raw += toNumber(val);
      hasData = true;
    }
  }

  if (max <= 0) return { raw, max, ps: 0, hasData: false };
  return { raw, max, ps: (raw / max) * 100, hasData };
}

export function writtenWorkScore(
  assessments: Assessment[],
  scores: ScoreMap,
  learnerId: string,
  term: Term | string,
  mapePart?: MapePart,
): ComponentScore {
  return componentScore(assessments, scores, learnerId, term, ["WW"], mapePart);
}

export function performanceTaskScore(
  assessments: Assessment[],
  scores: ScoreMap,
  learnerId: string,
  term: Term | string,
  mapePart?: MapePart,
): ComponentScore {
  return componentScore(assessments, scores, learnerId, term, ["PT"], mapePart);
}

/**
 * Exam PS. Standard: ST1×30% + ST2×30% + TE×40%.
 * SHS Field Experience: TE only. Research / Work Immersion: none (0).
 */
export function examPercentageScore(
  st1: ComponentScore,
  st2: ComponentScore,
  te: ComponentScore,
  examinationComponents: readonly ExamComponent[],
): number {
  if (examinationComponents.length === 1 && examinationComponents[0] === "TE") return te.ps;
  if (examinationComponents.length > 0) return st1.ps * 0.3 + st2.ps * 0.3 + te.ps * 0.4;
  return 0;
}

export function examinationHasData(
  st1: ComponentScore,
  st2: ComponentScore,
  te: ComponentScore,
  examinationComponents: readonly ExamComponent[],
): boolean {
  return examinationComponents.some((component) => {
    if (component === "ST1") return st1.hasData;
    if (component === "ST2") return st2.hasData;
    return te.hasData;
  });
}

export type { AssessmentComponent };
