import { describe, expect, it } from "vitest";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Assessment } from "../../models/assessment";
import type { Learner } from "../../models/learner";
import golden from "./fixtures/eclassrecord-golden.json";
import { computeClassTermResults, computeTermResult } from "./term-result";

function learner(id: string): Learner {
  return {
    id,
    lrn: "1",
    lastName: "Test",
    firstName: id,
    middleName: "",
    sex: "F",
    birthdate: "2012-01-01",
  };
}

function load(partial: Partial<TeachingLoad> & Pick<TeachingLoad, "assessments" | "scores">): TeachingLoad {
  return {
    id: "load-1",
    gradeLevel: "10",
    section: "Rizal",
    subject: "Mathematics",
    subjectGroup: "CORE_20_50_30",
    policy: "DO15_TRANSITION",
    schoolYear: "2026-2027",
    dashboardOrder: 0,
    learners: [learner("L1")],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const seedAssessments: Assessment[] = [
  ["WW", "a1", 25],
  ["WW", "a2", 25],
  ["PT", "a3", 50],
  ["ST1", "a4", 40],
  ["ST2", "a5", 40],
  ["TE", "a6", 50],
].map(([component, id, maxScore]) => ({
  id,
  term: "1",
  component,
  title: id,
  maxScore,
  date: "",
}));

function seedScores(): TeachingLoad["scores"] {
  const scores: TeachingLoad["scores"] = {};
  for (const learnerId of Object.keys(golden.seedTerms)) {
    const ratio = 0.72 + (learnerId.charCodeAt(learnerId.length - 1) % 5) * 0.04;
    for (const assessment of seedAssessments) {
      scores[`${learnerId}|${assessment.id}`] = Math.round(assessment.maxScore * ratio);
    }
  }
  return scores;
}

describe("computeTermResult — golden seed class", () => {
  const teachingLoad = load({
    learners: Object.keys(golden.seedTerms).map(learner),
    assessments: seedAssessments,
    scores: seedScores(),
  });

  it("matches E-Class Record IG, TG, and component PS for every seed learner", () => {
    for (const [learnerId, expected] of Object.entries(golden.seedTerms)) {
      const actual = computeTermResult(teachingLoad, learnerId, "1");
      expect(actual.hasData).toBe(expected.hasData);
      expect(actual.ww.ps).toBeCloseTo(expected.ww.ps);
      expect(actual.pt.ps).toBeCloseTo(expected.pt.ps);
      expect(actual.examPS).toBeCloseTo(expected.examPS);
      expect(actual.initialGrade).toBeCloseTo(expected.initialGrade);
      expect(actual.termGrade).toBe(expected.termGrade);
    }
  });

  it("returns a map for the whole class", () => {
    const results = computeClassTermResults(teachingLoad, "1");
    expect(results.size).toBe(5);
    expect(results.get("seed-learner-1")?.termGrade).toBe(golden.seedTerms["seed-learner-1"].termGrade);
  });
});

describe("computeTermResult — SHS variants", () => {
  it("ignores TE for Research (40/60/0)", () => {
    const research = load({
      gradeLevel: "12",
      subject: "Research 1",
      subjectGroup: "SHS_RESEARCH",
      shsSubjectGroup: "SHS_RESEARCH",
      assessments: [
        { id: "ww", term: "1", component: "WW", title: "WW", maxScore: 50, date: "" },
        { id: "pt", term: "1", component: "PT", title: "PT", maxScore: 50, date: "" },
        { id: "te", term: "1", component: "TE", title: "TE", maxScore: 50, date: "" },
      ],
      scores: { "L1|ww": 40, "L1|pt": 45, "L1|te": 50 },
    });
    const result = computeTermResult(research, "L1", "1");
    expect(result.examPS).toBeCloseTo(golden.shs.research.examPS);
    expect(result.initialGrade).toBeCloseTo(golden.shs.research.initialGrade);
    expect(result.termGrade).toBe(golden.shs.research.termGrade);
  });

  it("ignores TE for Work Immersion (20/80/0)", () => {
    const work = load({
      gradeLevel: "12",
      subject: "Work Immersion",
      subjectGroup: "SHS_WORK",
      shsSubjectGroup: "SHS_WORK",
      assessments: [
        { id: "ww", term: "1", component: "WW", title: "WW", maxScore: 50, date: "" },
        { id: "pt", term: "1", component: "PT", title: "PT", maxScore: 50, date: "" },
        { id: "te", term: "1", component: "TE", title: "TE", maxScore: 50, date: "" },
      ],
      scores: { "L1|ww": 40, "L1|pt": 45, "L1|te": 50 },
    });
    const result = computeTermResult(work, "L1", "1");
    expect(result.examPS).toBeCloseTo(golden.shs.work.examPS);
    expect(result.initialGrade).toBeCloseTo(golden.shs.work.initialGrade);
    expect(result.termGrade).toBe(golden.shs.work.termGrade);
  });

  it("uses TE-only exam PS for Field Experience", () => {
    const field = load({
      gradeLevel: "12",
      subject: "Creative Production and Presentation",
      subjectGroup: "SHS_FIELD",
      shsSubjectGroup: "SHS_FIELD",
      assessments: [
        { id: "ww", term: "1", component: "WW", title: "WW", maxScore: 50, date: "" },
        { id: "pt", term: "1", component: "PT", title: "PT", maxScore: 50, date: "" },
        { id: "te", term: "1", component: "TE", title: "TE", maxScore: 50, date: "" },
      ],
      scores: { "L1|ww": 40, "L1|pt": 45, "L1|te": 40 },
    });
    const result = computeTermResult(field, "L1", "1");
    expect(result.examPS).toBeCloseTo(golden.shs.field.examPS);
    expect(result.initialGrade).toBeCloseTo(golden.shs.field.initialGrade);
    expect(result.termGrade).toBe(golden.shs.field.termGrade);
  });
});

describe("computeTermResult — transfers and empty terms", () => {
  it("returns T/O after a transferred-out term", () => {
    const teachingLoad = load({
      learners: [{ ...learner("L1"), transferredOutTerm: "1" }],
      assessments: seedAssessments,
      scores: { "L1|a1": 20 },
    });
    const later = computeTermResult(teachingLoad, "L1", "2");
    expect(later.termGrade).toBe("T/O");
    expect(later.isTransferredOut).toBe(true);
    expect(later.hasData).toBe(false);
  });

  it("uses transferred-in override grades", () => {
    const teachingLoad = load({
      learners: [{ ...learner("L1"), transferredInGrades: { "1": 88 } }],
      assessments: seedAssessments,
      scores: {},
    });
    const result = computeTermResult(teachingLoad, "L1", "1");
    expect(result.termGrade).toBe(88);
    expect(result.isTransferredIn).toBe(true);
    expect(result.hasData).toBe(true);
  });

  it("returns null termGrade when nothing is scored", () => {
    const teachingLoad = load({ assessments: seedAssessments, scores: {} });
    const result = computeTermResult(teachingLoad, "L1", "1");
    expect(result.hasData).toBe(false);
    expect(result.termGrade).toBeNull();
    expect(result.initialGrade).toBe(0);
  });
});
