import { describe, expect, it } from "vitest";
import { detectPolicy, determinePolicy, isMapehSubject, isZeroBasedSchoolYear, parseGradeLevel } from "../policy";
import golden from "./fixtures/eclassrecord-golden.json";

describe("determinePolicy", () => {
  it("matches desktop school-year rules", () => {
    expect(determinePolicy(1, "Mathematics", "2026-2027")).toBe(golden.policies.g1_2026);
    expect(determinePolicy(2, "Mathematics", "2026-2027")).toBe(golden.policies.g2_2026);
    expect(determinePolicy(2, "Mathematics", "2027-2028")).toBe(golden.policies.g2_2027);
    expect(determinePolicy(3, "Mathematics", "2026-2027")).toBe(golden.policies.g3_2026);
    expect(determinePolicy(3, "Mathematics", "2027-2028")).toBe(golden.policies.g3_2027);
    expect(determinePolicy(3, "Mathematics", "2028-2029")).toBe(golden.policies.g3_2028);
    expect(determinePolicy(5, "Mathematics", "2026-2027")).toBe(golden.policies.g5_2026);
    expect(determinePolicy(10, "Mathematics", "2026-2027")).toBe(golden.policies.g10_2026);
    expect(determinePolicy(10, "Mathematics", "2027-2028")).toBe(golden.policies.g10_2027);
  });

  it("keeps detectPolicy as a thin wrapper", () => {
    expect(detectPolicy(10, "Mathematics", "2026-2027")).toBe("DO15_TRANSITION");
    expect(detectPolicy(1)).toBe("DO15_DESCRIPTIVE");
  });

  it("treats SY 2027-2028 and later as zero-based", () => {
    expect(isZeroBasedSchoolYear("2027-2028")).toBe(true);
    expect(isZeroBasedSchoolYear("2026-2027")).toBe(false);
    expect(isZeroBasedSchoolYear("")).toBe(false);
  });
});

describe("helpers", () => {
  it("parses grade levels from strings", () => {
    expect(parseGradeLevel("Grade 10")).toBe(10);
    expect(parseGradeLevel(8)).toBe(8);
    expect(parseGradeLevel("Kinder")).toBe(0);
  });

  it("detects MAPEH subject names", () => {
    expect(isMapehSubject("MAPEH")).toBe(true);
    expect(isMapehSubject("Music and Arts")).toBe(true);
    expect(isMapehSubject("Physical Education and Health")).toBe(true);
    expect(isMapehSubject("Mathematics")).toBe(false);
  });
});
