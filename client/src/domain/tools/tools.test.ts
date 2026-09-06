import { describe, expect, it } from "vitest";
import { scoreKey } from "../../models/assessment";
import type { TeachingLoad } from "../../models/teaching-load";
import { createSampleTeachingLoad } from "../../storage/seed";
import { computeTermResult } from "../grading";
import {
  activeLearners,
  applySimulation,
  createNamePicker,
  createSimulationSession,
  planSimulationApply,
  planSimulationRevert,
  randomizeGroups,
  revertSimulation,
  setSimulationScore,
  simulationChanges,
} from "./index";

function sequenceRandom(values: number[]) {
  let index = 0;
  return (max: number) => {
    const value = values[index++ % values.length];
    return Math.abs(value) % max;
  };
}

function learner(id: string, sex: "M" | "F" | "") {
  return { id, firstName: id, lastName: "Learner", sex };
}

function fixtureLoad(): TeachingLoad {
  const base = createSampleTeachingLoad();
  const learners = [
    { ...base.learners[0], id: "m1", sex: "M" as const },
    { ...base.learners[1], id: "m2", sex: "M" as const },
    { ...base.learners[2], id: "f1", sex: "F" as const },
    { ...base.learners[3], id: "f2", sex: "F" as const },
    { ...base.learners[0], id: "out", sex: "M" as const, transferredOutTerm: "1" as const },
  ];
  const ww = { ...base.assessments.find((item) => item.term === "1" && item.component === "WW")!, id: "ww-1", maxScore: 20 };
  const pt = { ...base.assessments.find((item) => item.term === "1" && item.component === "PT")!, id: "pt-1", maxScore: 30 };
  const ww2 = { ...base.assessments.find((item) => item.term === "2" && item.component === "WW")!, id: "ww-2", maxScore: 20 };
  return {
    ...base,
    id: "class-1",
    learners,
    assessments: [ww, pt, ww2],
    scores: {
      [scoreKey("m1", "ww-1")]: 10,
      [scoreKey("m2", "ww-1")]: 11,
      [scoreKey("f1", "ww-1")]: 12,
    },
  };
}

describe("group randomizer", () => {
  it("partitions every eligible learner into near-equal groups", () => {
    const load = fixtureLoad();
    const eligible = activeLearners(load);
    expect(eligible).toHaveLength(4);
    expect(eligible.some((item) => item.id === "out")).toBe(false);
    const groups = randomizeGroups(eligible, 3, "random", sequenceRandom([2, 1, 0, 3]));
    expect(groups).toHaveLength(3);
    const flattened = groups.flat();
    expect(new Set(flattened.map((item) => item.id)).size).toBe(eligible.length);
    expect(flattened.map((item) => item.id).sort()).toEqual(eligible.map((item) => item.id).sort());
    expect(Math.max(...groups.map((group) => group.length)) - Math.min(...groups.map((group) => group.length))).toBeLessThanOrEqual(1);
  });

  it("balances male and female counts across groups", () => {
    const roster = [
      ...Array.from({ length: 8 }, (_, index) => learner(`m${index}`, "M")),
      ...Array.from({ length: 8 }, (_, index) => learner(`f${index}`, "F")),
      learner("unknown-1", ""),
    ];
    const balanced = randomizeGroups(roster, 4, "balanced", sequenceRandom([0, 2, 1, 3]));
    const maleCounts = balanced.map((group) => group.filter((item) => item.sex === "M").length);
    const femaleCounts = balanced.map((group) => group.filter((item) => item.sex === "F").length);
    expect(Math.max(...maleCounts) - Math.min(...maleCounts)).toBeLessThanOrEqual(1);
    expect(Math.max(...femaleCounts) - Math.min(...femaleCounts)).toBeLessThanOrEqual(1);
    expect(Math.max(...balanced.map((group) => group.length)) - Math.min(...balanced.map((group) => group.length))).toBeLessThanOrEqual(1);
  });

  it("rejects group counts outside 2..roster", () => {
    const eligible = activeLearners(fixtureLoad());
    expect(() => randomizeGroups(eligible, 1)).toThrow(/Choose between 2/);
    expect(() => randomizeGroups(eligible, 8)).toThrow(/Choose between 2/);
  });
});

describe("name picker", () => {
  it("draws without repeats until the cycle restarts", () => {
    const roster = [learner("a", "M"), learner("b", "F"), learner("c", "")];
    const picker = createNamePicker(roster, sequenceRandom([0, 1, 0]));
    const firstCycle = [picker.draw(), picker.draw(), picker.draw()];
    expect(new Set(firstCycle.map((result) => result.learner?.id)).size).toBe(3);
    expect(firstCycle[2].remaining).toBe(0);
    const next = picker.draw();
    expect(next.restarted).toBe(true);
    expect(next.learner).toBeTruthy();
    picker.reset();
    expect(picker.status().remaining).toBe(3);
  });
});

describe("grade simulator", () => {
  it("previews score edits then applies and reverts through the Phase 2 engine", () => {
    const load = fixtureLoad();
    const officialTg = computeTermResult(load, "m1", "1").termGrade;
    const session = createSimulationSession(load, "1");
    const raised = setSimulationScore(session, load, "m1", "ww-1", "18");
    const withPt = setSimulationScore(raised, load, "f2", "pt-1", "25");
    expect(load.scores[scoreKey("m1", "ww-1")]).toBe(10);
    expect(load.scores[scoreKey("f2", "pt-1")]).toBeUndefined();
    expect(simulationChanges(withPt, load)).toHaveLength(2);
    expect(() => setSimulationScore(withPt, load, "m1", "ww-1", "21")).toThrow(/0 to 20/);
    const noHps = {
      ...load,
      assessments: [...load.assessments, { ...load.assessments[0], id: "ww-no-hps", title: "No HPS", maxScore: 0 }],
    };
    expect(() => setSimulationScore(withPt, noHps, "m1", "ww-no-hps", "1")).toThrow(/Set a positive HPS/);
    expect(() => setSimulationScore(withPt, load, "out", "ww-1", "10")).toThrow(/not eligible/);
    expect(() => setSimulationScore(withPt, load, "m1", "ww-2", "10")).toThrow(/selected term/);

    const simulated = { ...load, scores: withPt.draftScores };
    const simulatedTg = computeTermResult(simulated, "m1", "1").termGrade;
    expect(typeof officialTg).toBe("number");
    expect(typeof simulatedTg).toBe("number");
    expect(simulatedTg).not.toBe(officialTg);

    expect(planSimulationApply(withPt, load).canApply).toBe(true);
    const stale = { ...load, scores: { ...load.scores, [scoreKey("m1", "ww-1")]: 15 } };
    expect(planSimulationApply(withPt, stale).conflicts).toHaveLength(1);

    const applied = applySimulation(withPt, load);
    expect(applied.load.scores[scoreKey("m1", "ww-1")]).toBe(18);
    expect(applied.load.scores[scoreKey("f2", "pt-1")]).toBe(25);
    expect(applied.history.changes).toHaveLength(2);
    expect(computeTermResult(applied.load, "m1", "1").termGrade).toBe(simulatedTg);

    expect(planSimulationRevert(applied.history, applied.load).ready).toHaveLength(2);
    const drifted = {
      ...applied.load,
      scores: { ...applied.load.scores, [scoreKey("m1", "ww-1")]: 19 },
    };
    expect(planSimulationRevert(applied.history, drifted).conflicts).toHaveLength(1);
    const reverted = revertSimulation(applied.history, drifted, { [scoreKey("m1", "ww-1")]: "keep" });
    expect(reverted.restored).toHaveLength(1);
    expect(reverted.kept).toHaveLength(1);
    expect(reverted.load.scores[scoreKey("m1", "ww-1")]).toBe(19);
    expect(reverted.load.scores[scoreKey("f2", "pt-1")]).toBeUndefined();
    expect(reverted.history.status).toBe("partially-reverted");
  });
});
