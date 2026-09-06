import type { ChecklistEntry, ChecklistEntryHistoryEntry, ChecklistEntryOperation } from "../../models/checklist";
import { CHECKLIST_ENTRY_HISTORY_LIMIT } from "../../models/checklist";
import type { TeachingLoad } from "../../models/teaching-load";
import type { PerformanceChecklist } from "../../models/checklist";
import {
  checklistActivityDefinition,
  checklistEntry,
  isChecklistActivityPublished,
  writeChecklistEntryState,
} from "./document";
import { clone, createId, isEligibleLearner, nowIso } from "./helpers";

export interface EntryChangeInput {
  sessionId: string;
  learnerId: string;
  criterionId: string;
  value: number | "";
  note?: string;
}

function setEntryOn(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  sessionId: string,
  learnerId: string,
  criterionId: string,
  rawValue: number | "",
  metadata: { note?: string; now?: string } = {},
): PerformanceChecklist {
  if (String(checklist.assignmentId) !== String(load.id)) {
    throw new Error("The checklist no longer matches the active class.");
  }
  const session = checklist.sessions.find((item) => item.id === sessionId);
  const criterion = checklist.criteria.find((item) => item.id === criterionId);
  const activityCriterion = checklistActivityDefinition(checklist, session || sessionId);
  const learner = load.learners.find((item) => item.id === learnerId);
  if (!session) throw new Error("The selected checklist session is unavailable.");
  if (!criterion) throw new Error("The selected criterion is unavailable.");
  if (isChecklistActivityPublished(session)) {
    throw new Error("Published activities are locked. Unlock this activity with your PIN before editing learner points.");
  }
  if (activityCriterion && activityCriterion.criterionId !== criterion.id) {
    throw new Error("The selected activity does not accept this entry type.");
  }
  const next = clone(checklist);
  const nextSession = next.sessions.find((item) => item.id === sessionId);
  if (!nextSession) throw new Error("The selected checklist session is unavailable.");
  if (!nextSession.entries || typeof nextSession.entries !== "object") nextSession.entries = {};
  if (!nextSession.entries[learnerId]) nextSession.entries[learnerId] = {};
  const text = rawValue === "" ? "" : String(rawValue).trim();
  const stamp = nowIso(metadata.now);
  if (text === "") {
    delete nextSession.entries[learnerId][criterionId];
    if (!Object.keys(nextSession.entries[learnerId]).length) delete nextSession.entries[learnerId];
    nextSession.updatedAt = stamp;
    next.updatedAt = stamp;
    return next;
  }
  const entryDefinition = activityCriterion || criterion;
  if (!entryDefinition.active) throw new Error("The selected criterion is unavailable.");
  if (!isEligibleLearner(learner)) {
    throw new Error("This learner is not eligible for a new checklist entry.");
  }
  const points = Number(text);
  if (!Number.isFinite(points) || points < 0 || points > entryDefinition.maxPointsPerSession) {
    throw new RangeError(`Enter points from 0 to ${entryDefinition.maxPointsPerSession}.`);
  }
  const previous = nextSession.entries[learnerId][criterionId];
  nextSession.entries[learnerId][criterionId] = {
    ...(previous && typeof previous === "object" ? previous : { selectedItemIds: [] }),
    points,
    note: String(metadata.note ?? previous?.note ?? ""),
    updatedAt: stamp,
    selectedItemIds: Array.isArray(previous?.selectedItemIds) ? [...previous.selectedItemIds] : [],
  };
  nextSession.updatedAt = stamp;
  next.updatedAt = stamp;
  return next;
}

export function setChecklistEntry(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  sessionId: string,
  learnerId: string,
  criterionId: string,
  rawValue: number | "",
  metadata: { note?: string; now?: string } = {},
): PerformanceChecklist {
  return setEntryOn(checklist, load, sessionId, learnerId, criterionId, rawValue, metadata);
}

export function nudgeChecklistEntry(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  sessionId: string,
  learnerId: string,
  criterionId: string,
  delta: number,
): PerformanceChecklist {
  const session = checklist.sessions.find((item) => item.id === sessionId);
  const definition = checklistActivityDefinition(checklist, session || sessionId) || checklist.criteria.find((item) => item.id === criterionId);
  if (!definition) throw new Error("The selected criterion is unavailable.");
  const current = checklistEntry(checklist, sessionId, learnerId, criterionId);
  const nextPoints = Math.max(0, Math.min(definition.maxPointsPerSession, (current?.points ?? 0) + delta));
  if (nextPoints === 0 && !current) return checklist;
  return setChecklistEntry(checklist, load, sessionId, learnerId, criterionId, nextPoints === 0 && !current?.note ? "" : nextPoints, {
    note: current?.note,
  });
}

function appendEntryHistory(checklist: PerformanceChecklist, entry: ChecklistEntryHistoryEntry): PerformanceChecklist {
  const history = [...(checklist.entryHistory || []), entry];
  return {
    ...checklist,
    entryHistory: history.slice(-CHECKLIST_ENTRY_HISTORY_LIMIT),
  };
}

export function applyChecklistEntryTransaction(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  rawChanges: EntryChangeInput[],
  options: { operation?: ChecklistEntryOperation; label?: string; now?: string } = {},
): { checklist: PerformanceChecklist; history: ChecklistEntryHistoryEntry } {
  if (!Array.isArray(rawChanges) || !rawChanges.length) throw new Error("No checklist entry changes were provided.");
  const unique = new Map<string, EntryChangeInput>();
  for (const change of rawChanges) {
    if (!change) continue;
    unique.set(`${change.sessionId}|${change.learnerId}|${change.criterionId}`, { ...change });
  }
  let working = clone(checklist);
  const changes: ChecklistEntryHistoryEntry["changes"] = [];
  for (const change of unique.values()) {
    const before = checklistEntry(working, change.sessionId, change.learnerId, change.criterionId);
    working = setEntryOn(working, load, change.sessionId, change.learnerId, change.criterionId, change.value, {
      note: change.note,
      now: options.now,
    });
    const after = checklistEntry(working, change.sessionId, change.learnerId, change.criterionId);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({
        sessionId: change.sessionId,
        learnerId: change.learnerId,
        criterionId: change.criterionId,
        before: before ? clone(before) : null,
        after: after ? clone(after) : null,
      });
    }
  }
  if (!changes.length) throw new Error("The checklist already contains the selected values.");
  const history: ChecklistEntryHistoryEntry = {
    id: createId("checklist-entry-change"),
    checklistId: checklist.id,
    assignmentId: load.id,
    operation: options.operation && ["entry", "bulk", "session-reset", "term-reset", "criterion-clear"].includes(options.operation) ? options.operation : "entry",
    label: String(options.label || ""),
    createdAt: nowIso(options.now),
    changes,
    status: "applied",
    revertedAt: "",
  };
  return { checklist: appendEntryHistory(working, history), history };
}

export function planChecklistEntryUndo(
  historyEntry: ChecklistEntryHistoryEntry,
  checklist: PerformanceChecklist,
): { changes: ChecklistEntryHistoryEntry["changes"]; conflicts: ChecklistEntryHistoryEntry["changes"]; canUndo: boolean } {
  if (!historyEntry || historyEntry.checklistId !== checklist.id) {
    throw new Error("The checklist change history no longer matches this checklist.");
  }
  const conflicts = historyEntry.changes.filter((change) => {
    const current = checklistEntry(checklist, change.sessionId, change.learnerId, change.criterionId);
    return JSON.stringify(current || null) !== JSON.stringify(change.after || null);
  });
  return { changes: historyEntry.changes, conflicts, canUndo: conflicts.length === 0 };
}

export function undoChecklistEntryTransaction(
  historyEntry: ChecklistEntryHistoryEntry,
  checklist: PerformanceChecklist,
): PerformanceChecklist {
  const plan = planChecklistEntryUndo(historyEntry, checklist);
  if (!plan.canUndo) {
    throw new Error("One or more checklist entries changed after this action. The newer entries were preserved.");
  }
  const locked = plan.changes.some((change) => {
    const session = checklist.sessions.find((item) => item.id === change.sessionId);
    return isChecklistActivityPublished(session);
  });
  if (locked) {
    throw new Error("Published activities are locked. Unlock the activity with your PIN before undoing checklist entries.");
  }
  let next = checklist;
  for (const change of [...plan.changes].reverse()) {
    next = writeChecklistEntryState(next, change.sessionId, change.learnerId, change.criterionId, change.before);
  }
  next = clone(next);
  next.entryHistory = (next.entryHistory || []).map((item) =>
    item.id === historyEntry.id ? { ...item, status: "reverted", revertedAt: nowIso() } : item,
  );
  return next;
}

export function latestAppliedEntryHistory(checklist: PerformanceChecklist): ChecklistEntryHistoryEntry | undefined {
  return [...(checklist.entryHistory || [])].reverse().find((item) => item.status === "applied");
}

export function undoLastChecklistEntryChange(checklist: PerformanceChecklist): PerformanceChecklist {
  const latest = latestAppliedEntryHistory(checklist);
  if (!latest) throw new Error("There is nothing to undo on this checklist.");
  return undoChecklistEntryTransaction(latest, checklist);
}

export function bulkMarkChecklist(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  sessionId: string,
  criterionId: string,
  points: number,
  scope: "missing" | "all",
): { checklist: PerformanceChecklist; history: ChecklistEntryHistoryEntry } {
  const session = checklist.sessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("The selected checklist session is unavailable.");
  const definition = checklistActivityDefinition(checklist, session) || checklist.criteria.find((item) => item.id === criterionId);
  if (!definition) throw new Error("The selected criterion is unavailable.");
  if (points < 0 || points > definition.maxPointsPerSession) {
    throw new RangeError(`Enter points from 0 to ${definition.maxPointsPerSession}.`);
  }
  const changes: EntryChangeInput[] = [];
  for (const learner of load.learners) {
    if (!isEligibleLearner(learner)) continue;
    const existing = checklistEntry(checklist, sessionId, learner.id, criterionId);
    if (scope === "missing" && existing) continue;
    changes.push({
      sessionId,
      learnerId: learner.id,
      criterionId,
      value: points,
    });
  }
  return applyChecklistEntryTransaction(checklist, load, changes, {
    operation: "bulk",
    label: scope === "missing" ? "Bulk mark missing" : "Bulk overwrite",
  });
}

export function resetSessionEntries(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  sessionId: string,
): { checklist: PerformanceChecklist; history: ChecklistEntryHistoryEntry } {
  const session = checklist.sessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("The selected checklist session is unavailable.");
  if (isChecklistActivityPublished(session)) {
    throw new Error("Revert published points before resetting this activity.");
  }
  const criterionId = session.activity?.criterionId;
  if (!criterionId) throw new Error("This session has no activity to reset.");
  const changes: EntryChangeInput[] = [];
  for (const [learnerId, entries] of Object.entries(session.entries || {})) {
    if (entries[criterionId]) {
      changes.push({ sessionId, learnerId, criterionId, value: "" });
    }
  }
  if (!changes.length) throw new Error("This activity has no learner entries to reset.");
  return applyChecklistEntryTransaction(checklist, load, changes, { operation: "session-reset", label: "Reset activity" });
}

export function setEntryNote(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  sessionId: string,
  learnerId: string,
  criterionId: string,
  note: string,
): PerformanceChecklist {
  const existing = checklistEntry(checklist, sessionId, learnerId, criterionId);
  const points = existing ? existing.points : "";
  if (points === "") {
    if (!note.trim()) return checklist;
    throw new Error("Enter points before adding a note.");
  }
  return setChecklistEntry(checklist, load, sessionId, learnerId, criterionId, points, { note: note.slice(0, 240) });
}

export type { ChecklistEntry };
