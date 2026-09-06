import { parseScoreKey, scoreKey } from "../../models/assessment";
import { loadLabel } from "../grading";
import type { SimulationChange, SimulationHistoryEntry, SimulationSession, ScoreState } from "../../models/simulation";
import { SIMULATION_HISTORY_LIMIT } from "../../models/simulation";
import type { ScoreMap } from "../../models/types";
import type { TeachingLoad } from "../../models/teaching-load";
import { recordScoreDiff } from "../scores";
import { activeLearners } from "./learners";

function cloneScores(scores: ScoreMap): ScoreMap {
  return { ...scores };
}

export function scoreState(scores: ScoreMap | undefined, key: string): ScoreState {
  const present = Object.prototype.hasOwnProperty.call(scores || {}, key) && scores![key] !== "";
  return {
    present,
    value: present ? Number(scores![key]) : null,
  };
}

export function equalScoreState(left: ScoreState | null | undefined, right: ScoreState | null | undefined): boolean {
  return Boolean(left?.present) === Boolean(right?.present) && (!left?.present || Number(left?.value) === Number(right?.value));
}

function writeScoreState(scores: ScoreMap, key: string, state: ScoreState): ScoreMap {
  const next = { ...scores };
  if (!state.present) delete next[key];
  else next[key] = Number(state.value);
  return next;
}

function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return `${prefix}-${cryptoApi.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSimulationSession(load: TeachingLoad, term = "1"): SimulationSession {
  const normalizedTerm = ["1", "2", "3"].includes(String(term)) ? String(term) : "1";
  return {
    id: createId("simulation-session"),
    assignmentId: String(load.id || ""),
    term: normalizedTerm,
    baseScores: cloneScores(load.scores || {}),
    draftScores: cloneScores(load.scores || {}),
    createdAt: new Date().toISOString(),
  };
}

export function setSimulationScore(
  session: SimulationSession,
  load: TeachingLoad,
  learnerId: string,
  assessmentId: string,
  rawValue: string | number,
): SimulationSession {
  const learner = load.learners.find((item) => item.id === learnerId);
  const assessment = load.assessments.find((item) => item.id === assessmentId);
  if (!learner || learner.transferredOutTerm) {
    throw new Error("This learner is not eligible for score simulation.");
  }
  if (!assessment || String(assessment.term) !== String(session.term)) {
    throw new Error("This assessment does not belong to the selected term.");
  }
  const text = String(rawValue ?? "").trim();
  const draftScores = cloneScores(session.draftScores);
  const key = scoreKey(learnerId, assessmentId);
  if (text === "") {
    delete draftScores[key];
    return { ...session, draftScores };
  }
  const value = Number(text);
  const maxScore = Number(assessment.maxScore);
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    throw new RangeError("Set a positive HPS for this assessment in the Grading Sheet before simulating scores.");
  }
  if (!Number.isFinite(value) || value < 0 || value > maxScore) {
    throw new RangeError(`Enter a score from 0 to ${maxScore}.`);
  }
  draftScores[key] = value;
  return { ...session, draftScores };
}

export function simulationChanges(session: SimulationSession, load: TeachingLoad): SimulationChange[] {
  const assessmentIds = new Set(
    load.assessments.filter((item) => String(item.term) === String(session.term)).map((item) => String(item.id)),
  );
  const learnerIds = new Set(activeLearners(load).map((item) => String(item.id)));
  const keys = new Set([...Object.keys(session.baseScores || {}), ...Object.keys(session.draftScores || {})]);
  return Array.from(keys)
    .filter((key) => {
      const ids = parseScoreKey(key);
      return ids && learnerIds.has(ids.learnerId) && assessmentIds.has(ids.assessmentId);
    })
    .map((key) => ({
      key,
      before: scoreState(session.baseScores, key),
      after: scoreState(session.draftScores, key),
    }))
    .filter((change) => !equalScoreState(change.before, change.after));
}

export function planSimulationApply(session: SimulationSession, official: TeachingLoad) {
  if (!official || official.id !== session.assignmentId) {
    throw new Error("The simulation no longer matches the active class.");
  }
  const changes = simulationChanges(session, official);
  const conflicts = changes.filter(
    (change) => !equalScoreState(scoreState(official.scores || {}, change.key), change.before),
  );
  return { changes, conflicts, canApply: changes.length > 0 && conflicts.length === 0 };
}

export function applySimulation(
  session: SimulationSession,
  official: TeachingLoad,
): { load: TeachingLoad; history: SimulationHistoryEntry } {
  const plan = planSimulationApply(session, official);
  if (plan.changes.length === 0) throw new Error("There are no simulated score changes to apply.");
  if (plan.conflicts.length > 0) {
    throw new Error("Official scores changed while this simulation was open.");
  }
  let scores = { ...(official.scores || {}) };
  plan.changes.forEach((change) => {
    scores = writeScoreState(scores, change.key, change.after);
  });
  const history: SimulationHistoryEntry = {
    id: createId("grade-simulation"),
    assignmentId: official.id,
    assignmentLabel: loadLabel(official),
    term: session.term,
    appliedAt: new Date().toISOString(),
    changes: plan.changes.map((change) => ({ ...change })),
    status: "applied",
    revertedAt: "",
  };
  const withScores: TeachingLoad = { ...official, scores, updatedAt: new Date().toISOString() };
  const withAudit = recordScoreDiff(withScores, official.scores || {}, scores, "teacher-tools-simulation");
  const previous = (official.simulationHistory || []).filter((item) => item.assignmentId === official.id);
  return {
    load: {
      ...withAudit,
      simulationHistory: [history, ...previous].slice(0, SIMULATION_HISTORY_LIMIT),
    },
    history,
  };
}

export function planSimulationRevert(historyEntry: SimulationHistoryEntry, official: TeachingLoad) {
  if (!official || official.id !== historyEntry.assignmentId) {
    throw new Error("The saved simulation history no longer matches this class.");
  }
  const ready: Array<SimulationChange & { current: ScoreState }> = [];
  const conflicts: Array<SimulationChange & { current: ScoreState }> = [];
  historyEntry.changes.forEach((change) => {
    const current = scoreState(official.scores || {}, change.key);
    (equalScoreState(current, change.after) ? ready : conflicts).push({ ...change, current });
  });
  return { ready, conflicts };
}

export function revertSimulation(
  historyEntry: SimulationHistoryEntry,
  official: TeachingLoad,
  resolutions: Record<string, "restore" | "keep"> = {},
): { load: TeachingLoad; restored: string[]; kept: string[]; history: SimulationHistoryEntry } {
  const plan = planSimulationRevert(historyEntry, official);
  let scores = { ...(official.scores || {}) };
  const restored: string[] = [];
  const kept: string[] = [];
  plan.ready.forEach((change) => {
    scores = writeScoreState(scores, change.key, change.before);
    restored.push(change.key);
  });
  plan.conflicts.forEach((change) => {
    if (resolutions[change.key] === "restore") {
      scores = writeScoreState(scores, change.key, change.before);
      restored.push(change.key);
    } else {
      kept.push(change.key);
    }
  });
  const history: SimulationHistoryEntry = {
    ...historyEntry,
    status: kept.length > 0 ? "partially-reverted" : "reverted",
    revertedAt: new Date().toISOString(),
  };
  const withScores: TeachingLoad = { ...official, scores, updatedAt: new Date().toISOString() };
  const withAudit = recordScoreDiff(
    withScores,
    official.scores || {},
    scores,
    "teacher-tools-revert",
  );
  const list = (official.simulationHistory || []).map((item) => (item.id === history.id ? history : item));
  return {
    load: { ...withAudit, simulationHistory: list },
    restored,
    kept,
    history,
  };
}

export function draftLoad(load: TeachingLoad, session: SimulationSession): TeachingLoad {
  return { ...load, scores: session.draftScores };
}
