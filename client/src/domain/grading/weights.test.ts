import { describe, expect, it } from "vitest";
import golden from "./fixtures/eclassrecord-golden.json";
import {
  determineSubjectGroup,
  examinationComponentsForLoad,
  normalizeSpecialProgramWeights,
  weightsFor,
  weightsForLoad,
} from "./weights";

describe("weight presets", () => {
  it("matches desktop presets including SHS variants", () => {
    expect([...weightsFor("CORE_20_50_30")]).toEqual(golden.weights.CORE_20_50_30);
    expect([...weightsFor("SKILLS_20_60_20")]).toEqual(golden.weights.SKILLS_20_60_20);
    expect([...weightsFor("SHS_WORK")]).toEqual(golden.weights.SHS_WORK);
    expect([...weightsFor("SHS_RESEARCH")]).toEqual(golden.weights.SHS_RESEARCH);
    expect([...weightsFor("SHS_FIELD")]).toEqual(golden.weights.SHS_FIELD);
    expect([...weightsFor("SHS_TECHPRO")]).toEqual(golden.weights.SHS_TECHPRO);
    expect([...weightsFor("SHS_ARTS")]).toEqual(golden.weights.SHS_ARTS);
    expect([...weightsFor("NOPE")]).toEqual(golden.weights.unknown);
  });

  it("treats JHS_CORE and KS1 aliases as 20/50/30", () => {
    expect([...weightsFor("JHS_CORE")]).toEqual([20, 50, 30]);
    expect([...weightsFor("KS1_DESCRIPTIVE")]).toEqual([20, 50, 30]);
    expect([...weightsFor("SHS_ARTS_SPORTS")]).toEqual([20, 60, 20]);
  });

  it("accepts special-program weight objects that total 100", () => {
    expect(normalizeSpecialProgramWeights({ writtenWorks: 25, performanceTasks: 50, examination: 25 })).toEqual([
      25, 50, 25,
    ]);
    expect(normalizeSpecialProgramWeights([20, 50, 31])).toBeNull();
    expect(normalizeSpecialProgramWeights([20.5, 49.5, 30])).toBeNull();
  });

  it("uses special-program weights on the load when flagged", () => {
    expect(
      weightsForLoad({
        gradeLevel: "10",
        subjectGroup: "CORE_20_50_30",
        isSpecialProgramSubject: true,
        specialProgramWeights: { writtenWorks: 10, performanceTasks: 70, examination: 20 },
      }),
    ).toEqual([10, 70, 20]);
  });
});

describe("subject group detection", () => {
  it("matches desktop keyword / catalog rules", () => {
    expect(determineSubjectGroup(10, "Mathematics")).toBe(golden.subjectGroups.g10_math);
    expect(determineSubjectGroup(10, "MAPEH")).toBe(golden.subjectGroups.g10_mapeh);
    expect(determineSubjectGroup(10, "Technology and Livelihood Education (TLE)")).toBe(golden.subjectGroups.g10_tle);
    expect(determineSubjectGroup(5, "Science")).toBe(golden.subjectGroups.g5_science);
    expect(determineSubjectGroup(12, "Research 1")).toBe(golden.subjectGroups.g12_research);
    expect(determineSubjectGroup(12, "Work Immersion")).toBe(golden.subjectGroups.g12_work);
    expect(determineSubjectGroup(12, "Creative Production and Presentation")).toBe(golden.subjectGroups.g12_field);
    expect(determineSubjectGroup(12, "General Mathematics")).toBe(golden.subjectGroups.g12_core);
    expect(determineSubjectGroup(12, "General Mathematics", "DO15_TRANSITION", "SHS_ARTS")).toBe(
      golden.subjectGroups.g12_override,
    );
  });
});

describe("SHS examination columns", () => {
  it("hides exams for Research and Work Immersion", () => {
    expect(
      examinationComponentsForLoad({
        gradeLevel: "12",
        subject: "Research 1",
        subjectGroup: "SHS_RESEARCH",
        shsSubjectGroup: "SHS_RESEARCH",
      }),
    ).toEqual(golden.shs.examComponents.research);
    expect(
      examinationComponentsForLoad({
        gradeLevel: "12",
        subject: "Work Immersion",
        subjectGroup: "SHS_WORK",
        shsSubjectGroup: "SHS_WORK",
      }),
    ).toEqual(golden.shs.examComponents.work);
  });

  it("uses TE-only for Field Experience", () => {
    expect(
      examinationComponentsForLoad({
        gradeLevel: "12",
        subject: "Creative Production and Presentation",
        subjectGroup: "SHS_FIELD",
        shsSubjectGroup: "SHS_FIELD",
      }),
    ).toEqual(golden.shs.examComponents.field);
  });

  it("keeps ST1/ST2/TE for JHS", () => {
    expect(
      examinationComponentsForLoad({ gradeLevel: "10", subject: "Mathematics", subjectGroup: "CORE_20_50_30" }),
    ).toEqual(golden.shs.examComponents.jhs);
  });
});
