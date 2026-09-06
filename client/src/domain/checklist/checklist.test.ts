import { describe, expect, it } from "vitest";
import { scoreKey } from "../../models/assessment";
import { createSampleTeachingLoad } from "../../storage/seed";
import {
  addChecklistActivity,
  addChecklistCriterion,
  applyChecklistActivityPublication,
  applyChecklistEntryTransaction,
  bulkMarkChecklist,
  checklistActivityTargetSuggestions,
  createPerformanceChecklist,
  ensureChecklist,
  hasToolsPin,
  nudgeChecklistEntry,
  planChecklistActivityPublication,
  resetSessionEntries,
  revertChecklistPublication,
  setChecklistEntry,
  setToolsPin,
  undoLastChecklistEntryChange,
  verifyToolsPin,
} from "./index";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

describe("performance checklist", () => {
  it("creates Recitation, Notebook, and Assignment columns", () => {
    const load = createSampleTeachingLoad();
    const checklist = createPerformanceChecklist(load, "1");
    expect(checklist.criteria.map((item) => item.label)).toEqual(["Recitation", "Notebook", "Assignment"]);
    expect(checklist.sessions[0].activity?.title).toBe("Recitation 1");
    expect(checklist.sessions[0].activity?.destinationComponent).toBe("WW");
  });

  it("caps +/- points at the activity HPS", () => {
    const load = createSampleTeachingLoad();
    const checklist = createPerformanceChecklist(load, "1");
    const session = checklist.sessions[0];
    const criterionId = session.activity?.criterionId || "";
    const learnerId = load.learners[0].id;
    expect(() => setChecklistEntry(checklist, load, session.id, learnerId, criterionId, 11)).toThrow(/0 to 10/);
    const filled = setChecklistEntry(checklist, load, session.id, learnerId, criterionId, 10);
    const nudged = nudgeChecklistEntry(filled, load, session.id, learnerId, criterionId, 1);
    expect(nudged.sessions[0].entries[learnerId][criterionId].points).toBe(10);
  });

  it("bulk-marks missing learners and undoes the batch", () => {
    const load = createSampleTeachingLoad();
    const checklist = createPerformanceChecklist(load, "1");
    const session = checklist.sessions[0];
    const criterionId = session.activity?.criterionId || "";
    const first = setChecklistEntry(checklist, load, session.id, load.learners[0].id, criterionId, 4);
    const bulked = bulkMarkChecklist(first, load, session.id, criterionId, 8, "missing");
    expect(bulked.checklist.sessions[0].entries[load.learners[0].id][criterionId].points).toBe(4);
    expect(bulked.checklist.sessions[0].entries[load.learners[1].id][criterionId].points).toBe(8);
    const undone = undoLastChecklistEntryChange(bulked.checklist);
    expect(undone.sessions[0].entries[load.learners[0].id][criterionId].points).toBe(4);
    expect(undone.sessions[0].entries[load.learners[1].id]?.[criterionId]).toBeUndefined();
  });

  it("publishes checklist points into a WW column without exceeding HPS", () => {
    const base = createSampleTeachingLoad();
    const ww = base.assessments.find((item) => item.term === "1" && item.component === "WW")!;
    const load = {
      ...base,
      scores: Object.fromEntries(Object.entries(base.scores).filter(([key]) => !key.endsWith(`|${ww.id}`))),
    };
    const checklist = createPerformanceChecklist(load, "1", { activityTitle: "Recitation 1" });
    const session = checklist.sessions[0];
    const criterionId = session.activity!.criterionId;
    let working = checklist;
    for (const learner of load.learners) {
      working = setChecklistEntry(working, load, session.id, learner.id, criterionId, 10);
    }
    const suggestions = checklistActivityTargetSuggestions(working, load, session.activity!.id);
    const target = suggestions.find((item) => item.assessmentId === ww.id);
    expect(target?.compatible).toBe(true);
    const plan = planChecklistActivityPublication(working, load, session.activity!.id, ww.id);
    expect(plan.canApply).toBe(true);
    expect(plan.blocked).toHaveLength(0);
    expect(plan.maxScore).toBe(10);
    const published = applyChecklistActivityPublication(working, load, plan);
    for (const learner of load.learners) {
      expect(published.load.scores[scoreKey(learner.id, ww.id)]).toBe(10);
    }
    expect(published.load.assessments.find((item) => item.id === ww.id)?.maxScore).toBe(10);
    expect(published.checklist.sessions[0].activity?.publicationTarget.lastPublishedAt).toBeTruthy();
  });

  it("blocks publication when checklist points would exceed existing HPS", () => {
    const load = createSampleTeachingLoad();
    const ww = load.assessments.find((item) => item.term === "1" && item.component === "WW")!;
    const checklist = createPerformanceChecklist(load, "1");
    const session = checklist.sessions[0];
    const filled = setChecklistEntry(checklist, load, session.id, load.learners[0].id, session.activity!.criterionId, 10);
    const plan = planChecklistActivityPublication(filled, load, session.activity!.id, ww.id);
    expect(plan.canApply).toBe(false);
    expect(plan.blocked.some((item) => item.reason === "score-exceeds-hps")).toBe(true);
  });

  it("locks published activities until revert restores official scores", () => {
    const base = createSampleTeachingLoad();
    const ww = base.assessments.find((item) => item.term === "1" && item.component === "WW")!;
    const load = {
      ...base,
      scores: Object.fromEntries(Object.entries(base.scores).filter(([key]) => !key.endsWith(`|${ww.id}`))),
    };
    const checklist = createPerformanceChecklist(load, "1");
    const session = checklist.sessions[0];
    const filled = setChecklistEntry(checklist, load, session.id, load.learners[0].id, session.activity!.criterionId, 9);
    const plan = planChecklistActivityPublication(filled, load, session.activity!.id, ww.id);
    const published = applyChecklistActivityPublication(filled, load, plan);
    expect(() =>
      setChecklistEntry(published.checklist, published.load, session.id, load.learners[1].id, session.activity!.criterionId, 5),
    ).toThrow(/locked/i);
    const reverted = revertChecklistPublication(published.history, published.checklist, published.load);
    expect(reverted.load.scores[scoreKey(load.learners[0].id, ww.id)]).toBeUndefined();
    const again = setChecklistEntry(reverted.checklist, reverted.load, session.id, load.learners[1].id, session.activity!.criterionId, 5);
    expect(again.sessions[0].entries[load.learners[1].id][session.activity!.criterionId].points).toBe(5);
  });

  it("adds a custom criterion and a new activity", () => {
    const load = createSampleTeachingLoad();
    const created = ensureChecklist(load, "1");
    const withCustom = addChecklistCriterion(created.checklist, {
      label: "Group work",
      destinationComponent: "PT",
      scoringMode: "NUMERIC",
      maxPointsPerSession: 15,
    });
    const next = addChecklistActivity(withCustom, { criterionId: withCustom.criteria[3].id, title: "Group work 1", maxPoints: 15 });
    expect(next.sessions).toHaveLength(2);
    expect(next.sessions[1].activity?.destinationComponent).toBe("PT");
    expect(next.sessions[1].activity?.maxPoints).toBe(15);
  });

  it("records entry transactions for a single cell change", () => {
    const load = createSampleTeachingLoad();
    const checklist = createPerformanceChecklist(load, "1");
    const session = checklist.sessions[0];
    const result = applyChecklistEntryTransaction(checklist, load, [
      { sessionId: session.id, learnerId: load.learners[0].id, criterionId: session.activity!.criterionId, value: 3 },
    ]);
    expect(result.history.operation).toBe("entry");
    expect(result.checklist.entryHistory).toHaveLength(1);
  });

  it("resets an unpublished activity", () => {
    const load = createSampleTeachingLoad();
    const checklist = createPerformanceChecklist(load, "1");
    const session = checklist.sessions[0];
    const filled = setChecklistEntry(checklist, load, session.id, load.learners[0].id, session.activity!.criterionId, 6);
    const reset = resetSessionEntries(filled, load, session.id);
    expect(reset.checklist.sessions[0].entries[load.learners[0].id]?.[session.activity!.criterionId]).toBeUndefined();
  });
});

describe("tools PIN", () => {
  it("treats a missing PIN as verified", async () => {
    const storage = memoryStorage();
    expect(hasToolsPin(storage)).toBe(false);
    expect(await verifyToolsPin("1234", storage)).toBe(true);
  });

  it("stores and verifies a 4-8 digit PIN", async () => {
    const storage = memoryStorage();
    await setToolsPin("2468", storage);
    expect(hasToolsPin(storage)).toBe(true);
    expect(await verifyToolsPin("2468", storage)).toBe(true);
    expect(await verifyToolsPin("0000", storage)).toBe(false);
  });
});
