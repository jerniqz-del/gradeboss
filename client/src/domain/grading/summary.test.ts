import { describe, expect, it } from "vitest";
import type { Assessment } from "../../models/assessment";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { createSampleTeachingLoad } from "../../storage/seed";
import golden from "./fixtures/eclassrecord-golden.json";
import { computeClassYearResults, computeLearnerYearResult } from "./summary";
import { isPassing, transmuteForLoad } from "./transmutation";

function learner(id: string, extra: Partial<Learner> = {}): Learner {
  return {
    id,
    lrn: id,
    lastName: "Test",
    firstName: id,
    middleName: "",
    sex: "F",
    birthdate: "2012-01-01",
    ...extra,
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

const term1: Assessment[] = [
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

function ratioScores(learnerIds: string[], assessments: Assessment[]): TeachingLoad["scores"] {
  const scores: TeachingLoad["scores"] = {};
  for (const learnerId of learnerIds) {
    const ratio = 0.72 + (learnerId.charCodeAt(learnerId.length - 1) % 5) * 0.04;
    for (const assessment of assessments) {
      scores[`${learnerId}|${assessment.id}`] = Math.round(assessment.maxScore * ratio);
    }
  }
  return scores;
}

describe("computeLearnerYearResult — sample class", () => {
  const seed = createSampleTeachingLoad();

  it("matches golden term 1 finals and uses that term as the annual when later terms are empty", () => {
    for (const [learnerId, expected] of Object.entries(golden.seedTerms)) {
      const year = computeLearnerYearResult(seed, learnerId);
      expect(year.termGrades[0]).toBe(expected.termGrade);
      expect(year.termGrades[1]).toBeNull();
      expect(year.termGrades[2]).toBeNull();
      expect(year.annualGrade).toBe(expected.termGrade);
      expect(year.annualInitialGrade).toBeCloseTo(expected.initialGrade);
      expect(year.passed).toBe(isPassing(expected.termGrade));
      expect(year.termsWithData).toBe(1);
    }
  });

  it("averages IGs across scored terms then transmutes the annual", () => {
    const teachingLoad = load({
      learners: [learner("L1")],
      assessments: [
        ...term1,
        ...term1.map((item) => ({ ...item, id: `t2-${item.id}`, term: "2" as const })),
      ],
      scores: {
        ...ratioScores(["L1"], term1),
        "L1|t2-a1": 18,
        "L1|t2-a2": 18,
        "L1|t2-a3": 36,
        "L1|t2-a4": 29,
        "L1|t2-a5": 29,
        "L1|t2-a6": 36,
      },
    });
    const year = computeLearnerYearResult(teachingLoad, "L1");
    const t1 = year.terms[0].result;
    const t2 = year.terms[1].result;
    expect(t1.hasData).toBe(true);
    expect(t2.hasData).toBe(true);
    const expectedIg = (t1.initialGrade + t2.initialGrade) / 2;
    expect(year.annualInitialGrade).toBeCloseTo(expectedIg);
    expect(year.annualGrade).toBe(transmuteForLoad(teachingLoad, expectedIg));
    expect(year.termsWithData).toBe(2);
  });
});

describe("computeLearnerYearResult — transfers and descriptive", () => {
  it("skips T/O terms in the annual and keeps the T/O marker", () => {
    const teachingLoad = load({
      learners: [learner("L1", { transferredOutTerm: "1" })],
      assessments: term1,
      scores: ratioScores(["L1"], term1),
    });
    const year = computeLearnerYearResult(teachingLoad, "L1");
    expect(year.termGrades[0]).not.toBeNull();
    expect(year.termGrades[1]).toBe("T/O");
    expect(year.termGrades[2]).toBe("T/O");
    expect(year.annualGrade).toBe(year.termGrades[0]);
    expect(year.passed).toBe(isPassing(year.annualGrade));
  });

  it("mixes transferred-in finals with computed terms without treating T/I IG as 0", () => {
    const teachingLoad = load({
      learners: [learner("L1", { transferredInGrades: { "1": 88 } })],
      assessments: [
        ...term1,
        ...term1.map((item) => ({ ...item, id: `t2-${item.id}`, term: "2" as const })),
      ],
      scores: {
        "L1|t2-a1": 20,
        "L1|t2-a2": 20,
        "L1|t2-a3": 40,
        "L1|t2-a4": 32,
        "L1|t2-a5": 32,
        "L1|t2-a6": 40,
      },
    });
    const year = computeLearnerYearResult(teachingLoad, "L1");
    expect(year.termGrades[0]).toBe(88);
    expect(year.terms[0].result.isTransferredIn).toBe(true);
    expect(year.annualGrade).not.toBeNull();
    expect(typeof year.annualGrade === "number" ? year.annualGrade : 0).toBeGreaterThan(70);
  });

  it("shows descriptive letters and A/B/C pass for Grades 1–3", () => {
    const teachingLoad = load({
      gradeLevel: "1",
      policy: "DO15_DESCRIPTIVE",
      subjectGroup: "KS1_DESCRIPTIVE",
      assessments: term1,
      scores: ratioScores(["L1"], term1),
    });
    const year = computeLearnerYearResult(teachingLoad, "L1");
    expect(typeof year.annualGrade).toBe("string");
    expect(["A", "B", "C", "D", "E"]).toContain(year.annualGrade);
    expect(year.annualDisplay).toBe(String(year.annualGrade));
    expect(year.annualDescriptor.length).toBeGreaterThan(0);
    expect(year.passed).toBe(isPassing(year.annualGrade));
  });
});

describe("computeLearnerYearResult — MAPEH", () => {
  const assessments: Assessment[] = [
    ...(["WW", "PT", "ST1", "ST2", "TE"] as const).map((component, i) => ({
      id: `ma-${i}`,
      term: "1" as const,
      component,
      title: component,
      maxScore: 50,
      date: "",
      mapePart: "music_arts" as const,
    })),
    ...(["WW", "PT", "ST1", "ST2", "TE"] as const).map((component, i) => ({
      id: `ph-${i}`,
      term: "1" as const,
      component,
      title: component,
      maxScore: 50,
      date: "",
      mapePart: "pe_health" as const,
    })),
  ];
  const scores: TeachingLoad["scores"] = {};
  for (const item of assessments) {
    scores[`L1|${item.id}`] = item.mapePart === "music_arts" ? 45 : 40;
  }

  it("uses the consolidated MAPEH term grade and annual from part IGs", () => {
    const teachingLoad = load({
      gradeLevel: "8",
      subject: "MAPEH",
      subjectGroup: "SKILLS_20_60_20",
      assessments,
      scores,
    });
    const year = computeLearnerYearResult(teachingLoad, "L1");
    expect(year.termGrades[0]).toBe(golden.mapeh.consolidated);
    expect(year.annualGrade).toBe(transmuteForLoad(teachingLoad, year.annualInitialGrade ?? 0));
    expect(year.passed).toBe(true);
  });
});

describe("computeClassYearResults", () => {
  it("returns one row per learner in roster order of the load", () => {
    const seed = createSampleTeachingLoad();
    const rows = computeClassYearResults(seed);
    expect(rows.map((row) => row.learnerId)).toEqual(seed.learners.map((item) => item.id));
    expect(rows.every((row) => row.annualGrade !== null)).toBe(true);
  });
});
