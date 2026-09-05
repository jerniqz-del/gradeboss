import { describe, expect, it } from "vitest";
import { componentScore, examPercentageScore } from "./components";
import { initialGrade } from "./initial-grade";
import type { Assessment } from "../../models/assessment";

const assessments: Assessment[] = [
  { id: "ww1", term: "1", component: "WW", title: "WW 1", maxScore: 20, date: "" },
  { id: "ww2", term: "1", component: "WW", title: "WW 2", maxScore: 30, date: "" },
  { id: "pt1", term: "1", component: "PT", title: "PT 1", maxScore: 50, date: "" },
  { id: "st1", term: "1", component: "ST1", title: "ST1", maxScore: 40, date: "" },
  { id: "st2", term: "1", component: "ST2", title: "ST2", maxScore: 40, date: "" },
  { id: "te", term: "1", component: "TE", title: "TE", maxScore: 50, date: "" },
  { id: "other", term: "2", component: "WW", title: "WW 1", maxScore: 20, date: "" },
];

describe("componentScore", () => {
  it("computes Σ scores / Σ HPS × 100", () => {
    const result = componentScore(
      assessments,
      { "L1|ww1": 18, "L1|ww2": 27 },
      "L1",
      "1",
      ["WW"],
    );
    expect(result.raw).toBe(45);
    expect(result.max).toBe(50);
    expect(result.ps).toBe(90);
    expect(result.hasData).toBe(true);
  });

  it("treats missing scores as 0 while still counting HPS", () => {
    const result = componentScore(assessments, { "L1|ww1": 20 }, "L1", "1", ["WW"]);
    expect(result.raw).toBe(20);
    expect(result.max).toBe(50);
    expect(result.ps).toBe(40);
    expect(result.hasData).toBe(true);
  });

  it("skips assessments with HPS ≤ 0 and empty terms", () => {
    const empty = componentScore(
      [{ ...assessments[0], maxScore: 0 }],
      { "L1|ww1": 10 },
      "L1",
      "1",
      ["WW"],
    );
    expect(empty).toEqual({ raw: 0, max: 0, ps: 0, hasData: false });
  });

  it("filters by MAPEH part", () => {
    const parts: Assessment[] = [
      { id: "ma", term: "1", component: "WW", title: "WW", maxScore: 10, date: "", mapePart: "music_arts" },
      { id: "ph", term: "1", component: "WW", title: "WW", maxScore: 10, date: "", mapePart: "pe_health" },
    ];
    const result = componentScore(parts, { "L1|ma": 8, "L1|ph": 4 }, "L1", "1", ["WW"], "music_arts");
    expect(result.raw).toBe(8);
    expect(result.max).toBe(10);
  });

  it("accepts legacy SA1/SA2 component aliases", () => {
    const legacy: Assessment[] = [{ id: "sa", term: "1", component: "ST1", title: "SA1", maxScore: 20, date: "" }];
    const result = componentScore(legacy, { "L1|sa": 16 }, "L1", "1", ["SA1", "ST1"]);
    expect(result.ps).toBe(80);
  });
});

describe("examPercentageScore", () => {
  const st1 = { raw: 30, max: 40, ps: 75, hasData: true };
  const st2 = { raw: 32, max: 40, ps: 80, hasData: true };
  const te = { raw: 45, max: 50, ps: 90, hasData: true };

  it("is ST1×30 + ST2×30 + TE×40", () => {
    expect(examPercentageScore(st1, st2, te, ["ST1", "ST2", "TE"])).toBeCloseTo(75 * 0.3 + 80 * 0.3 + 90 * 0.4);
  });

  it("uses TE only for Field Experience", () => {
    expect(examPercentageScore(st1, st2, te, ["TE"])).toBe(90);
  });

  it("is 0 when the subject has no exam component", () => {
    expect(examPercentageScore(st1, st2, te, [])).toBe(0);
  });
});

describe("initialGrade", () => {
  it("weights WW/PT/Exam by the subject preset", () => {
    expect(initialGrade(80, 90, 70, [20, 50, 30])).toBeCloseTo(80 * 0.2 + 90 * 0.5 + 70 * 0.3);
    expect(initialGrade(80, 90, 70, { writtenWorks: 20, performanceTasks: 60, examination: 20 })).toBeCloseTo(
      80 * 0.2 + 90 * 0.6 + 70 * 0.2,
    );
  });
});
