import { describe, expect, it } from "vitest";
import { createTemplateAssessments, subjectsForGrade, templateForGrade } from "./catalog";
import { createLearner, createTeachingLoad, formatWeights } from "./create-load";
import { computeClassTermResults, computeTermResult } from "../../domain/grading";
import { scoreKey } from "../../models/assessment";

describe("assessment templates", () => {
  it("uses 4 WW + 4 PT for Grades 1–3", () => {
    const slots = templateForGrade(2);
    expect(slots.filter((s) => s.component === "WW")).toHaveLength(4);
    expect(slots.filter((s) => s.component === "PT")).toHaveLength(4);
    expect(slots.map((s) => s.component).slice(-3)).toEqual(["ST1", "ST2", "TE"]);
  });

  it("uses 5 WW + 3 PT for Grades 4–12", () => {
    const slots = templateForGrade(10);
    expect(slots).toHaveLength(11);
    expect(slots.filter((s) => s.component === "WW")).toHaveLength(5);
    expect(slots.filter((s) => s.component === "PT")).toHaveLength(3);
  });

  it("duplicates MAPEH assessments for both parts across 3 terms", () => {
    const assessments = createTemplateAssessments(8, "MAPEH");
    expect(assessments).toHaveLength(11 * 3 * 2);
    expect(assessments.some((a) => a.mapePart === "music_arts")).toBe(true);
    expect(assessments.some((a) => a.mapePart === "pe_health")).toBe(true);
  });

  it("lists JHS subjects including MAPEH and TLE", () => {
    expect(subjectsForGrade(8)).toContain("MAPEH");
    expect(subjectsForGrade(8)).toContain("Technology and Livelihood Education (TLE)");
  });
});

describe("createTeachingLoad", () => {
  it("assigns DO15_TRANSITION and 20/50/30 for G10 Mathematics in SY 2026–2027", () => {
    const load = createTeachingLoad({
      gradeLevel: "10",
      section: "Rizal",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    expect(load.policy).toBe("DO15_TRANSITION");
    expect(load.subjectGroup).toBe("CORE_20_50_30");
    expect(formatWeights(load.subjectGroup)).toBe("20/50/30");
    expect(load.assessments.length).toBeGreaterThan(0);
  });

  it("uses skills weights for MAPEH", () => {
    const load = createTeachingLoad({
      gradeLevel: "8",
      section: "Bonifacio",
      subject: "MAPEH",
      schoolYear: "2026-2027",
    });
    expect(load.subjectGroup).toBe("SKILLS_20_60_20");
    expect(formatWeights(load.subjectGroup)).toBe("20/60/20");
  });
});

describe("score grid engine wiring", () => {
  it("computes matching TGs for 30 learners × 10 assessments", () => {
    const load = createTeachingLoad({
      gradeLevel: "10",
      section: "Bulk",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    const term1 = load.assessments.filter((a) => a.term === "1").slice(0, 10);
    expect(term1.length).toBe(10);
    for (const assessment of term1) {
      assessment.maxScore = 50;
    }
    load.learners = Array.from({ length: 30 }, (_, i) =>
      createLearner({ lastName: `Learner`, firstName: `${i + 1}`, sex: i % 2 ? "F" : "M" }),
    );
    for (const learner of load.learners) {
      for (const assessment of term1) {
        const ratio = 0.7 + (learner.id.charCodeAt(learner.id.length - 1) % 5) * 0.05;
        load.scores[scoreKey(learner.id, assessment.id)] = Math.round(50 * ratio);
      }
    }

    const results = computeClassTermResults(load, "1");
    expect(results.size).toBe(30);
    for (const learner of load.learners) {
      const expected = computeTermResult(load, learner.id, "1");
      const actual = results.get(learner.id);
      expect(actual?.termGrade).toBe(expected.termGrade);
      expect(actual?.initialGrade).toBeCloseTo(expected.initialGrade);
      expect(actual?.hasData).toBe(true);
    }
  });
});
