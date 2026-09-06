import type { Assessment } from "../../models/assessment";
import type { ScoreHistoryEntry } from "../../models/score-history";
import type { ScoreMap } from "../../models/types";
import type { TeachingLoad } from "../../models/teaching-load";

export const UNDO_LIMIT = 100;

export interface LoadScoreSnapshot {
  id: string;
  scores: ScoreMap;
  assessments: Assessment[];
  scoreHistory: ScoreHistoryEntry[];
}

export interface MultiLoadSnapshot {
  loads: LoadScoreSnapshot[];
}

export interface UndoStacks {
  undo: MultiLoadSnapshot[];
  redo: MultiLoadSnapshot[];
}

export function emptyUndoStacks(): UndoStacks {
  return { undo: [], redo: [] };
}

export function snapshotLoads(loads: TeachingLoad[]): MultiLoadSnapshot {
  return {
    loads: loads.map((load) => ({
      id: load.id,
      scores: { ...load.scores },
      assessments: load.assessments.map((item) => ({ ...item })),
      scoreHistory: [...(load.scoreHistory || [])],
    })),
  };
}

export function applyLoadSnapshot(load: TeachingLoad, snapshot: LoadScoreSnapshot | undefined): TeachingLoad {
  if (!snapshot || snapshot.id !== load.id) return load;
  return {
    ...load,
    scores: { ...snapshot.scores },
    assessments: snapshot.assessments.map((item) => ({ ...item })),
    scoreHistory: [...snapshot.scoreHistory],
  };
}

export function applyMultiLoadSnapshot(loads: TeachingLoad[], snapshot: MultiLoadSnapshot): TeachingLoad[] {
  return loads.map((load) => applyLoadSnapshot(load, snapshot.loads.find((item) => item.id === load.id)));
}

export function pushUndo(stacks: UndoStacks, current: MultiLoadSnapshot): UndoStacks {
  return {
    undo: [...stacks.undo, current].slice(-UNDO_LIMIT),
    redo: [],
  };
}

export function undoOnce(
  stacks: UndoStacks,
  current: MultiLoadSnapshot,
): { stacks: UndoStacks; snapshot: MultiLoadSnapshot } | null {
  if (!stacks.undo.length) return null;
  const snapshot = stacks.undo[stacks.undo.length - 1];
  return {
    snapshot,
    stacks: {
      undo: stacks.undo.slice(0, -1),
      redo: [...stacks.redo, current].slice(-UNDO_LIMIT),
    },
  };
}

export function redoOnce(
  stacks: UndoStacks,
  current: MultiLoadSnapshot,
): { stacks: UndoStacks; snapshot: MultiLoadSnapshot } | null {
  if (!stacks.redo.length) return null;
  const snapshot = stacks.redo[stacks.redo.length - 1];
  return {
    snapshot,
    stacks: {
      undo: [...stacks.undo, current].slice(-UNDO_LIMIT),
      redo: stacks.redo.slice(0, -1),
    },
  };
}
