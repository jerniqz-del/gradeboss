import { scoreKey } from "../../models/assessment";
import { learnerDisplayName, type Learner } from "../../models/learner";
import type { Assessment } from "../../models/assessment";
import type { ScoreMap } from "../../models/types";
import type { TeachingLoad } from "../../models/teaching-load";
import { hasScore } from "./history";
import { recordScoreChange } from "./history";

export type ScoreTransferMode = "copy" | "move";
export type ScoreTransferConflictMode = "skip" | "overwrite";

export interface ScoreTransferConfig {
  source: TeachingLoad;
  target: TeachingLoad;
  sourceAssessment: Assessment;
  targetAssessment: Assessment;
  mode: ScoreTransferMode;
  conflictMode: ScoreTransferConflictMode;
  copyHps: boolean;
}

export interface ScoreTransferRow {
  sourceLearner: Learner;
  targetLearner: Learner | null;
  sourceKey?: string;
  targetKey?: string;
  sourceValue: number | "";
  targetValue: number | "";
  matchType: "LRN" | "Name" | "";
  willOverwrite?: boolean;
  willClearSource?: boolean;
  status: "blank" | "unmatched" | "conflict" | "overwrite" | "transfer";
  action: string;
}

export interface ScoreTransferPreview {
  valid: boolean;
  error: string;
  transferable: ScoreTransferRow[];
  conflicts: ScoreTransferRow[];
  unmatched: ScoreTransferRow[];
  rows: ScoreTransferRow[];
  blankSource: number;
  hpsWarning: string;
  willCopyHps: boolean;
  mode: ScoreTransferMode;
  conflictMode: ScoreTransferConflictMode;
}

function normalizeLrn(learner: Learner): string {
  return String(learner.lrn || "").replace(/\D/g, "").trim();
}

function normalizeName(learner: Learner): string {
  return learnerDisplayName(learner).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export function findScoreTransferTargetLearner(
  sourceLearner: Learner,
  targetLearners: Learner[],
): { learner: Learner | null; matchType: "LRN" | "Name" | "unmatched" } {
  const sourceLrn = normalizeLrn(sourceLearner);
  if (sourceLrn) {
    const byLrn = targetLearners.find((learner) => normalizeLrn(learner) === sourceLrn);
    return byLrn ? { learner: byLrn, matchType: "LRN" } : { learner: null, matchType: "unmatched" };
  }
  const sourceName = normalizeName(sourceLearner);
  if (!sourceName) return { learner: null, matchType: "unmatched" };
  const byName = targetLearners.find((learner) => normalizeName(learner) === sourceName);
  return byName ? { learner: byName, matchType: "Name" } : { learner: null, matchType: "unmatched" };
}

function scoreValue(scores: ScoreMap, key: string): number | "" {
  const value = scores[key];
  return hasScore(value) ? Number(value) : "";
}

export function buildScoreTransferPreview(config: ScoreTransferConfig): ScoreTransferPreview {
  const result: ScoreTransferPreview = {
    valid: false,
    error: "",
    transferable: [],
    conflicts: [],
    unmatched: [],
    rows: [],
    blankSource: 0,
    hpsWarning: "",
    willCopyHps: false,
    mode: config.mode === "copy" ? "copy" : "move",
    conflictMode: config.conflictMode === "overwrite" ? "overwrite" : "skip",
  };

  if (!config.source || !config.target || !config.sourceAssessment || !config.targetAssessment) {
    result.error = "Select a valid source and target class and assessment.";
    return result;
  }
  if (config.source.id === config.target.id && config.sourceAssessment.id === config.targetAssessment.id) {
    result.error = "Source and target assessment cannot be the same.";
    return result;
  }

  const sourceMax = Number(config.sourceAssessment.maxScore);
  const targetMax = Number(config.targetAssessment.maxScore);
  if (sourceMax > 0 && targetMax > 0 && sourceMax !== targetMax) {
    result.hpsWarning = `HPS differs: source is ${sourceMax}, target is ${targetMax}. Scores will be copied as raw values.`;
  }
  if (config.copyHps && sourceMax > 0 && !(targetMax > 0)) {
    result.willCopyHps = true;
  }

  for (const sourceLearner of config.source.learners || []) {
    const sourceKey = scoreKey(sourceLearner.id, config.sourceAssessment.id);
    const sourceValue = scoreValue(config.source.scores, sourceKey);
    if (sourceValue === "") {
      result.blankSource += 1;
      result.rows.push({
        sourceLearner,
        targetLearner: null,
        sourceValue: "",
        targetValue: "",
        matchType: "",
        status: "blank",
        action: "No source score",
      });
      continue;
    }

    const match = findScoreTransferTargetLearner(sourceLearner, config.target.learners || []);
    if (!match.learner) {
      const row: ScoreTransferRow = {
        sourceLearner,
        targetLearner: null,
        sourceValue,
        targetValue: "",
        matchType: "",
        status: "unmatched",
        action: "No matching learner",
      };
      result.unmatched.push(row);
      result.rows.push(row);
      continue;
    }

    const targetKey = scoreKey(match.learner.id, config.targetAssessment.id);
    const targetValue = scoreValue(config.target.scores, targetKey);
    const hasConflict = targetValue !== "";
    if (hasConflict && result.conflictMode !== "overwrite") {
      const row: ScoreTransferRow = {
        sourceLearner,
        targetLearner: match.learner,
        sourceValue,
        targetValue,
        matchType: match.matchType === "unmatched" ? "" : match.matchType,
        status: "conflict",
        action: "Skipped - target has score",
      };
      result.conflicts.push(row);
      result.rows.push(row);
      continue;
    }

    const row: ScoreTransferRow = {
      sourceLearner,
      targetLearner: match.learner,
      sourceKey,
      targetKey,
      sourceValue,
      targetValue,
      matchType: match.matchType === "unmatched" ? "" : match.matchType,
      willOverwrite: hasConflict,
      willClearSource: result.mode === "move",
      status: hasConflict ? "overwrite" : "transfer",
      action: hasConflict ? "Overwrite target score" : result.mode === "move" ? "Move score" : "Copy score",
    };
    result.transferable.push(row);
    result.rows.push(row);
  }

  result.valid = true;
  return result;
}

export function applyScoreTransfer(config: ScoreTransferConfig, preview: ScoreTransferPreview): { source: TeachingLoad; target: TeachingLoad } {
  const plan = buildScoreTransferPreview(config);
  if (!plan.valid) throw new Error(plan.error || "Unable to apply transfer.");
  if (JSON.stringify(plan.transferable.map((row) => row.targetKey)) !== JSON.stringify(preview.transferable.map((row) => row.targetKey))) {
    throw new Error("Scores changed after the preview opened. Review the transfer again.");
  }
  if (!plan.transferable.length) throw new Error("No scores are ready to transfer.");

  const stamp = new Date().toISOString();
  const sameLoad = config.source.id === config.target.id;
  let workingTarget = { ...config.target, scores: { ...config.target.scores } };
  let workingSource = sameLoad ? workingTarget : { ...config.source, scores: { ...config.source.scores } };

  for (const item of plan.transferable) {
    if (!item.targetLearner || !item.targetKey || item.sourceValue === "") continue;
    workingTarget = recordScoreChange(workingTarget, {
      learnerId: item.targetLearner.id,
      assessmentId: config.targetAssessment.id,
      previousValue: workingTarget.scores[item.targetKey],
      newValue: Number(item.sourceValue),
      source: `score-transfer-${plan.mode}`,
      changedAt: stamp,
    });
    workingTarget.scores = { ...workingTarget.scores, [item.targetKey]: Number(item.sourceValue) };
    if (sameLoad) workingSource = workingTarget;
    if (plan.mode === "move" && item.sourceKey) {
      workingSource = recordScoreChange(workingSource, {
        learnerId: item.sourceLearner.id,
        assessmentId: config.sourceAssessment.id,
        previousValue: workingSource.scores[item.sourceKey],
        newValue: null,
        source: "score-transfer-move",
        changedAt: stamp,
      });
      const nextScores = { ...workingSource.scores };
      delete nextScores[item.sourceKey];
      workingSource = { ...workingSource, scores: nextScores };
      if (sameLoad) workingTarget = workingSource;
    }
  }

  if (plan.willCopyHps) {
    workingTarget = {
      ...workingTarget,
      assessments: workingTarget.assessments.map((item) =>
        item.id === config.targetAssessment.id ? { ...item, maxScore: config.sourceAssessment.maxScore } : item,
      ),
    };
    if (sameLoad) workingSource = workingTarget;
  }

  const updatedAt = stamp;
  return { source: { ...workingSource, updatedAt }, target: { ...workingTarget, updatedAt } };
}
