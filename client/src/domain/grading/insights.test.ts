import { describe, expect, it } from "vitest";
import type { Assessment } from "../../models/assessment";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { createSampleTeachingLoad } from "../../storage/seed";
import golden from "./fixtures/eclassrecord-golden.json";
import { computeDashboardInsights, computeLoadInsights } from "./insights";

function learner(id: string): Learner {
  return {
    id,
    lrn: `lrn-${id}`,
    lastName: "Test",
    firstName: id,
    middleName: "",
    sex: "F",
    birthdate: "2012-01-01",
  };
}

function emptyLoad(overrides: Partial<TeachingLoad> = {}): TeachingLoad {
  return {
    id: "empty",
    gradeLevel: "7",
    section: "Luna",
    subject: "English",
    subjectGroup: "JHS_CORE",
    policy: "DO15_TRANSITION",
    schoolYear: "2026-2027",
    dashboardOrder: 1,
    learners: [],
    assessments: [],
    scores: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeLoadInsights — seed Mathematics", () => {
  const seed = createSampleTeachingLoad();
  const insights = computeLoadInsights(seed);

  it("counts completion from filled vs expected score cells", () => {
    // 5 learners × 6 assessments × 3 terms; only term 1 is scored.
    expect(insights.expectedScores).toBe(90);
    expect(insights.filledScores).toBe(30);
    expect(insights.missingScores).toBe(60);
    expect(insights.completionPercent).toBe(33.3);
  });

  it("computes class average from transmuted annual grades, not raw percents", () => {
    const expected = Object.values(golden.seedTerms).map((row) => row.termGrade);
    const mean = expected.reduce((sum, value) => sum + value, 0) / expected.length;
    expect(insights.classAverage).toBe(Math.round(mean * 10) / 10);
    expect(insights.classAverageDisplay).toBe(String(insights.classAverage));
    expect(insights.passedCount).toBe(5);
    expect(insights.failedCount).toBe(0);
  });

  it("flags incomplete later terms and ranks standings by transmuted grade", () => {
    expect(insights.termCompletions[0]?.percent).toBe(100);
    expect(insights.termCompletions[1]?.percent).toBe(0);
    expect(insights.termCompletions[2]?.percent).toBe(0);
    expect(insights.pending.some((task) => task.kind === "incomplete-term" && task.title.includes("Term 2"))).toBe(true);
    expect(insights.standings[0]?.annualGrade).toBe(90);
    expect(insights.standings.map((row) => row.annualGrade)).toEqual([90, 87, 83, 79, 76]);
  });
});

describe("computeLoadInsights — edge cases", () => {
  it("reports empty roster and 0% completion when nothing is expected", () => {
    const insights = computeLoadInsights(emptyLoad());
    expect(insights.completionPercent).toBe(0);
    expect(insights.pending.some((task) => task.kind === "empty-roster")).toBe(true);
  });

  it("treats maxScore 0 as missing HPS and excludes those cells from expected", () => {
    const assessments: Assessment[] = [
      { id: "ww", term: "1", component: "WW", title: "WW", maxScore: 0, date: "" },
      { id: "pt", term: "1", component: "PT", title: "PT", maxScore: 50, date: "" },
    ];
    const teachingLoad = emptyLoad({
      id: "hps",
      learners: [learner("L1")],
      assessments,
      scores: { "L1|pt": 40 },
    });
    const insights = computeLoadInsights(teachingLoad);
    expect(insights.expectedScores).toBe(1);
    expect(insights.filledScores).toBe(1);
    expect(insights.completionPercent).toBe(100);
    expect(insights.pending.some((task) => task.kind === "missing-hps")).toBe(true);
  });

  it("does not expect scores for transferred-in terms", () => {
    const assessments: Assessment[] = [
      { id: "ww", term: "1", component: "WW", title: "WW", maxScore: 25, date: "" },
    ];
    const teachingLoad = emptyLoad({
      learners: [{ ...learner("L1"), transferredInGrades: { "1": 80 } }],
      assessments,
      scores: {},
    });
    const insights = computeLoadInsights(teachingLoad);
    expect(insights.expectedScores).toBe(0);
    expect(insights.yearResults[0]?.termGrades[0]).toBe(80);
  });
});

describe("computeDashboardInsights", () => {
  it("rolls up unique learners and overall completion across loads", () => {
    const seed = createSampleTeachingLoad();
    const second = emptyLoad({
      id: "empty-2",
      learners: [learner("shared"), { ...learner("extra"), lrn: seed.learners[0].lrn }],
    });
    const dash = computeDashboardInsights([seed, second]);
    expect(dash.loadCount).toBe(2);
    expect(dash.enrollmentCount).toBe(seed.learners.length + 2);
    expect(dash.learnerCount).toBe(seed.learners.length + 1);
    expect(dash.overallCompletion).toBe(33.3);
    expect(dash.standings[0]?.annualGrade).toBe(90);
    expect(dash.pending.length).toBeGreaterThan(0);
  });
});
