import { parseScoreKey } from "../../models/assessment";
import type { ScoreHistoryEntry } from "../../models/score-history";
import { SCORE_HISTORY_MAX } from "../../models/score-history";
import type { ScoreMap } from "../../models/types";
import type { TeachingLoad } from "../../models/teaching-load";

export function hasScore(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

export function normalizedScoreValue(value: unknown): number | null {
  return hasScore(value) ? Number(value) : null;
}

export function createHistoryId(): string {
  return crypto.randomUUID();
}

export function recordScoreChange(
  load: TeachingLoad,
  change: {
    learnerId: string;
    assessmentId: string;
    previousValue: unknown;
    newValue: unknown;
    source?: string;
    changedAt?: string;
    term?: string;
  },
): TeachingLoad {
  const previousValue = normalizedScoreValue(change.previousValue);
  const newValue = normalizedScoreValue(change.newValue);
  if (previousValue === newValue || (previousValue === null && newValue === null)) return load;
  const assessment = load.assessments.find((item) => item.id === change.assessmentId);
  const entry: ScoreHistoryEntry = {
    id: createHistoryId(),
    learnerId: String(change.learnerId || ""),
    assessmentId: String(change.assessmentId || ""),
    term: String(change.term || assessment?.term || "1"),
    previousValue,
    newValue,
    source: String(change.source || "grading-sheet"),
    changedAt: change.changedAt || new Date().toISOString(),
  };
  if (!entry.learnerId || !entry.assessmentId) return load;
  const history = [...(load.scoreHistory || []), entry];
  return {
    ...load,
    scoreHistory: history.length > SCORE_HISTORY_MAX ? history.slice(history.length - SCORE_HISTORY_MAX) : history,
  };
}

export function recordScoreDiff(
  load: TeachingLoad,
  beforeScores: ScoreMap,
  afterScores: ScoreMap,
  source: string,
  changedAt?: string,
): TeachingLoad {
  const keys = new Set([...Object.keys(beforeScores || {}), ...Object.keys(afterScores || {})]);
  let next = load;
  for (const key of keys) {
    const ids = parseScoreKey(key);
    if (!ids) continue;
    next = recordScoreChange(next, {
      ...ids,
      previousValue: beforeScores[key],
      newValue: afterScores[key],
      source,
      changedAt,
    });
  }
  return next;
}

export function scoreHistoryForCell(load: TeachingLoad, learnerId: string, assessmentId: string): ScoreHistoryEntry[] {
  return (load.scoreHistory || [])
    .filter((entry) => entry.learnerId === learnerId && entry.assessmentId === assessmentId)
    .slice()
    .sort((left, right) => String(right.changedAt || "").localeCompare(String(left.changedAt || "")));
}
