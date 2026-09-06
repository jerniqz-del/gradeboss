import type {
  ChecklistCheckItem,
  ChecklistComponent,
  ChecklistCriterion,
  ChecklistEntry,
  ChecklistPublicationTarget,
  ChecklistScoringMode,
  ScoreState,
} from "../../models/checklist";
import { CHECKLIST_COMPONENTS, CHECKLIST_SCORING_MODES } from "../../models/checklist";
import type { Learner } from "../../models/learner";
import type { ScoreMap } from "../../models/types";
import { scoreKey } from "../../models/assessment";
import type { TeachingLoad } from "../../models/teaching-load";

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso(now?: string): string {
  return now || new Date().toISOString();
}

export function todayIso(now?: string): string {
  return (now || new Date().toISOString()).slice(0, 10);
}

export function finiteNonNegative(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

export function optionalPositive(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

/** Port of eclassrecord `roundScore`. */
export function roundScore(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

export function scoreState(scores: ScoreMap | undefined, key: string): ScoreState {
  const present = Object.prototype.hasOwnProperty.call(scores || {}, key) && scores?.[key] !== "";
  return {
    present,
    value: present ? Number(scores?.[key]) : null,
  };
}

export function equalScoreState(left: ScoreState | null | undefined, right: ScoreState | null | undefined): boolean {
  const leftPresent = Boolean(left?.present);
  const rightPresent = Boolean(right?.present);
  if (leftPresent !== rightPresent) return false;
  if (!leftPresent) return true;
  return Number(left?.value) === Number(right?.value);
}

export function writeScoreState(scores: ScoreMap, key: string, state: ScoreState): ScoreMap {
  const next = { ...scores };
  if (!state.present) delete next[key];
  else next[key] = Number(state.value);
  return next;
}

export function normalizeScoreState(state: unknown): ScoreState | null {
  if (!state || typeof state !== "object") return null;
  const item = state as ScoreState;
  if (!item.present) return { present: false, value: null };
  const value = Number(item.value);
  return Number.isFinite(value) ? { present: true, value } : null;
}

export function emptyPublicationTarget(): ChecklistPublicationTarget {
  return {
    assessmentId: "",
    lastPublishedAt: "",
    publishedContributions: {},
    publishedScoreStates: {},
    originalScoreStates: {},
  };
}

export function normalizeContributionMap(value: unknown): Record<string, number> {
  const output: Record<string, number> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const [learnerId, contribution] of Object.entries(value as Record<string, unknown>)) {
    const numeric = Number(contribution);
    if (learnerId && Number.isFinite(numeric) && numeric >= 0) output[learnerId] = numeric;
  }
  return output;
}

export function normalizeScoreStateMap(value: unknown): Record<string, ScoreState> {
  const output: Record<string, ScoreState> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const [learnerId, state] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeScoreState(state);
    if (learnerId && normalized) output[learnerId] = normalized;
  }
  return output;
}

export function normalizePublicationTarget(target: unknown): ChecklistPublicationTarget {
  const existing = target && typeof target === "object" && !Array.isArray(target) ? (target as ChecklistPublicationTarget) : emptyPublicationTarget();
  return {
    assessmentId: String(existing.assessmentId || ""),
    lastPublishedAt: String(existing.lastPublishedAt || ""),
    publishedContributions: normalizeContributionMap(existing.publishedContributions),
    publishedScoreStates: normalizeScoreStateMap(existing.publishedScoreStates),
    originalScoreStates: normalizeScoreStateMap(existing.originalScoreStates),
  };
}

export function isPublicationTargetPublished(target: unknown): boolean {
  const normalized = normalizePublicationTarget(target);
  return Boolean(
    normalized.lastPublishedAt ||
      Object.keys(normalized.publishedContributions).length ||
      Object.keys(normalized.publishedScoreStates).length,
  );
}

export function normalizedChecklistComponent(value: unknown): ChecklistComponent {
  const component = String(value || "").toUpperCase();
  return CHECKLIST_COMPONENTS.includes(component as ChecklistComponent) ? (component as ChecklistComponent) : "TRACKING";
}

export function normalizedScoringMode(value: unknown, fallback: ChecklistScoringMode = "CHECK"): ChecklistScoringMode {
  const mode = String(value || "").toUpperCase();
  return CHECKLIST_SCORING_MODES.includes(mode as ChecklistScoringMode) ? (mode as ChecklistScoringMode) : fallback;
}

export function standardChecklistType(value: unknown): ChecklistCriterion["standardType"] {
  const standardTypes = ["recitation", "notebook", "assignment"] as const;
  const candidates =
    value && typeof value === "object"
      ? [(value as ChecklistCriterion).standardType, (value as ChecklistCriterion).label]
      : [value];
  const found = candidates
    .map((candidate) => String(candidate || "").trim().toLowerCase())
    .find((candidate) => standardTypes.includes(candidate as (typeof standardTypes)[number]));
  return (found as ChecklistCriterion["standardType"]) || "";
}

export function normalizeCheckItem(item: unknown, index = 0): ChecklistCheckItem | null {
  if (!item || typeof item !== "object") return null;
  const label = String((item as ChecklistCheckItem).label || "").trim();
  if (!label) return null;
  return {
    id: String((item as ChecklistCheckItem).id || createId("check-item")),
    label,
    pointValue: finiteNonNegative((item as ChecklistCheckItem).pointValue, 1),
    active: (item as ChecklistCheckItem).active !== false,
    order: Number.isFinite(Number((item as ChecklistCheckItem).order)) ? Number((item as ChecklistCheckItem).order) : index,
  };
}

export function normalizeChecklistEntry(entry: unknown): ChecklistEntry | null {
  if (entry === "" || entry === null || entry === undefined) return null;
  if (typeof entry === "number") {
    return Number.isFinite(entry) && entry >= 0 ? { points: entry, note: "", updatedAt: "", selectedItemIds: [] } : null;
  }
  if (typeof entry !== "object") return null;
  const points = Number((entry as ChecklistEntry).points);
  if (!Number.isFinite(points) || points < 0) return null;
  const selected = Array.isArray((entry as ChecklistEntry).selectedItemIds)
    ? Array.from(new Set((entry as ChecklistEntry).selectedItemIds.map(String).filter(Boolean)))
    : [];
  return {
    points,
    note: String((entry as ChecklistEntry).note || ""),
    updatedAt: String((entry as ChecklistEntry).updatedAt || ""),
    selectedItemIds: selected,
  };
}

export function activeLearners(load: Pick<TeachingLoad, "learners">): Learner[] {
  return (load.learners || []).filter((learner) => learner && !learner.transferredOutTerm);
}

export function isEligibleLearner(learner: Learner | undefined): boolean {
  return Boolean(learner && !learner.transferredOutTerm);
}

export function assessmentHasScores(load: Pick<TeachingLoad, "scores">, assessmentId: string): boolean {
  const suffix = `|${assessmentId}`;
  return Object.entries(load.scores || {}).some(([key, value]) => key.endsWith(suffix) && value !== "" && value !== null && value !== undefined);
}

export function officialScoreKey(learnerId: string, assessmentId: string): string {
  return scoreKey(learnerId, assessmentId);
}
