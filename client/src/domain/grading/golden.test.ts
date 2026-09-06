import { describe, expect, it } from "vitest";
import golden from "./fixtures/eclassrecord-golden.json";
import { transmute, transmuteForLoad } from "./transmutation";
import { determinePolicy } from "../policy";

/**
 * Dedicated golden-file suite. Values were produced by executing the
 * E-Class Record `grading.js` functions (v1.9.6) against the same inputs.
 */
describe("eclassrecord golden file", () => {
  it("includes the canonical 99.50 → 100 transition boundary", () => {
    expect(golden.transmutation.do15Transition["99.5"]).toBe(100);
    expect(transmute(99.5, "DO15_TRANSITION")).toBe(100);
  });

  it("covers every published policy detection cell", () => {
    expect(Object.keys(golden.policies).length).toBeGreaterThanOrEqual(9);
    expect(determinePolicy(1, "Mathematics", "2026-2027")).toBe("DO15_DESCRIPTIVE");
    expect(determinePolicy(10, "Mathematics", "2026-2027")).toBe("DO15_TRANSITION");
  });

  it("keeps seed-learner-1 IG 87.91 → TG 90", () => {
    expect(golden.seedTerms["seed-learner-1"].initialGrade).toBeCloseTo(87.91);
    expect(golden.seedTerms["seed-learner-1"].termGrade).toBe(90);
    expect(
      transmuteForLoad({ gradeLevel: "10", subject: "Mathematics", schoolYear: "2026-2027" }, 87.91),
    ).toBe(90);
  });

  it("records MAPEH consolidation of the two part TGs (90→91 and 80→83 → 87)", () => {
    expect(golden.mapeh.music.initialGrade).toBe(90);
    expect(golden.mapeh.music.termGrade).toBe(91);
    expect(golden.mapeh.pe.initialGrade).toBe(80);
    expect(golden.mapeh.pe.termGrade).toBe(83);
    expect(golden.mapeh.consolidated).toBe(87);
  });
});
