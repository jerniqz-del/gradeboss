import { describe, expect, it } from "vitest";
import { scoreKey } from "../../models/assessment";
import { createSampleTeachingLoad } from "../../storage/seed";
import {
  applyMultiLoadSnapshot,
  applyScoreTransfer,
  buildScoreTransferPreview,
  emptyUndoStacks,
  pushUndo,
  recordScoreChange,
  redoOnce,
  snapshotLoads,
  undoOnce,
} from "./index";

describe("score history", () => {
  it("records a cell change and skips no-ops", () => {
    const load = createSampleTeachingLoad();
    const assessment = load.assessments[0];
    const learner = load.learners[0];
    const key = scoreKey(learner.id, assessment.id);
    const next = recordScoreChange(load, {
      learnerId: learner.id,
      assessmentId: assessment.id,
      previousValue: load.scores[key],
      newValue: 12,
      source: "grading-sheet",
    });
    expect(next.scoreHistory?.at(-1)?.newValue).toBe(12);
    const same = recordScoreChange(load, {
      learnerId: learner.id,
      assessmentId: assessment.id,
      previousValue: load.scores[key],
      newValue: load.scores[key],
      source: "grading-sheet",
    });
    expect(same.scoreHistory).toBeUndefined();
  });
});

describe("sheet undo/redo", () => {
  it("restores the prior score map", () => {
    const load = createSampleTeachingLoad();
    const assessment = load.assessments[0];
    const learner = load.learners[0];
    const key = scoreKey(learner.id, assessment.id);
    const before = snapshotLoads([load]);
    const stacks = pushUndo(emptyUndoStacks(), before);
    const edited = { ...load, scores: { ...load.scores, [key]: 1 } };
    const undone = undoOnce(stacks, snapshotLoads([edited]));
    expect(undone).not.toBeNull();
    const restored = applyMultiLoadSnapshot([edited], undone!.snapshot)[0];
    expect(restored.scores[key]).toBe(load.scores[key]);
    const redone = redoOnce(undone!.stacks, undone!.snapshot);
    const again = applyMultiLoadSnapshot([restored], redone!.snapshot)[0];
    expect(again.scores[key]).toBe(1);
  });
});

describe("score transfer", () => {
  it("matches learners by LRN and copies scores after preview", () => {
    const source = createSampleTeachingLoad();
    const sourceAssessment = source.assessments.find((item) => item.term === "1" && item.component === "WW")!;
    const target = {
      ...source,
      id: "target-load",
      section: "Bonifacio",
      scores: {},
      assessments: source.assessments.map((item) => ({ ...item, id: `t-${item.id}` })),
    };
    const targetAssessment = target.assessments.find((item) => item.title === sourceAssessment.title)!;
    const preview = buildScoreTransferPreview({
      source,
      target,
      sourceAssessment,
      targetAssessment,
      mode: "copy",
      conflictMode: "skip",
      copyHps: false,
    });
    expect(preview.valid).toBe(true);
    expect(preview.transferable.length).toBe(source.learners.length);
    expect(preview.transferable[0].matchType).toBe("LRN");
    const applied = applyScoreTransfer(
      { source, target, sourceAssessment, targetAssessment, mode: "copy", conflictMode: "skip", copyHps: false },
      preview,
    );
    const learner = source.learners[0];
    expect(applied.target.scores[scoreKey(learner.id, targetAssessment.id)]).toBe(source.scores[scoreKey(learner.id, sourceAssessment.id)]);
    expect(applied.source.scores[scoreKey(learner.id, sourceAssessment.id)]).toBe(source.scores[scoreKey(learner.id, sourceAssessment.id)]);
  });

  it("moves scores and skips filled targets unless overwrite is on", () => {
    const source = createSampleTeachingLoad();
    const sourceAssessment = source.assessments.find((item) => item.term === "1" && item.component === "PT")!;
    const targetAssessment = source.assessments.find((item) => item.term === "1" && item.component === "WW")!;
    const skip = buildScoreTransferPreview({
      source,
      target: source,
      sourceAssessment,
      targetAssessment,
      mode: "move",
      conflictMode: "skip",
      copyHps: false,
    });
    expect(skip.conflicts.length).toBeGreaterThan(0);
    expect(skip.transferable.length).toBe(0);
    const overwrite = buildScoreTransferPreview({
      source,
      target: source,
      sourceAssessment,
      targetAssessment,
      mode: "move",
      conflictMode: "overwrite",
      copyHps: false,
    });
    const applied = applyScoreTransfer(
      { source, target: source, sourceAssessment, targetAssessment, mode: "move", conflictMode: "overwrite", copyHps: false },
      overwrite,
    );
    const learner = source.learners[0];
    expect(applied.target.scores[scoreKey(learner.id, targetAssessment.id)]).toBe(source.scores[scoreKey(learner.id, sourceAssessment.id)]);
    expect(applied.source.scores[scoreKey(learner.id, sourceAssessment.id)]).toBeUndefined();
  });
});
