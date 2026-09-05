import { describe, expect, it } from "vitest";
import type { Assessment } from "../../models/assessment";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import golden from "./fixtures/eclassrecord-golden.json";
import { computeMapehTermResult, consolidateMapehGrades } from "./mapeh";

function baseLoad(assessments: Assessment[], scores: TeachingLoad["scores"]): TeachingLoad {
  const learner: Learner = {
    id: "L1",
    lrn: "1",
    lastName: "Reyes",
    firstName: "Maria",
    middleName: "",
    sex: "F",
    birthdate: "2012-01-01",
  };
  return {
    id: "mapeh",
    gradeLevel: "8",
    section: "Bonifacio",
    subject: "MAPEH",
    subjectGroup: "SKILLS_20_60_20",
    policy: "DO15_TRANSITION",
    schoolYear: "2026-2027",
    dashboardOrder: 0,
    learners: [learner],
    assessments,
    scores,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("consolidateMapehGrades", () => {
  it("matches every desktop golden pair", () => {
    for (const pair of golden.mapehPairs) {
      expect(consolidateMapehGrades(pair.a as never, pair.b as never), `${pair.a}+${pair.b}`).toBe(pair.out);
    }
  });

  it("rounds the average of two numeric term grades", () => {
    expect(consolidateMapehGrades(90, 81)).toBe(86);
    expect(consolidateMapehGrades(90, 80)).toBe(85);
  });
});

describe("computeMapehTermResult", () => {
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

  it("computes each part separately and consolidates the term grades", () => {
    const result = computeMapehTermResult(baseLoad(assessments, scores), "L1", "1");
    expect(result.musicArts.initialGrade).toBeCloseTo(golden.mapeh.music.initialGrade);
    expect(result.peHealth.initialGrade).toBeCloseTo(golden.mapeh.pe.initialGrade);
    expect(result.musicArts.termGrade).toBe(golden.mapeh.music.termGrade);
    expect(result.peHealth.termGrade).toBe(golden.mapeh.pe.termGrade);
    expect(result.consolidatedGrade).toBe(golden.mapeh.consolidated);
  });

  it("uses skills weights 20/60/20 for MAPEH", () => {
    const result = computeMapehTermResult(baseLoad(assessments, scores), "L1", "1");
    expect(result.musicArts.ww.ps).toBe(90);
    expect(result.musicArts.pt.ps).toBe(90);
    expect(result.musicArts.examPS).toBe(90);
    expect(result.musicArts.initialGrade).toBe(90);
  });
});
