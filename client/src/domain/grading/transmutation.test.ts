import { describe, expect, it } from "vitest";
import golden from "./fixtures/eclassrecord-golden.json";
import {
  descriptor,
  formatGradeForDisplay,
  isPassing,
  roundInitialGradeForTable,
  transmute,
  transmuteDescriptive,
  transmuteForLoad,
} from "./transmutation";

describe("DO15_TRANSITION transmutation", () => {
  it("maps IG 99.50 to TG 100", () => {
    expect(transmute(99.5, "DO15_TRANSITION")).toBe(100);
  });

  it("maps every golden boundary IG to the desktop TG", () => {
    for (const [ig, tg] of Object.entries(golden.transmutation.do15Transition)) {
      expect(transmute(Number(ig), "DO15_TRANSITION"), `IG ${ig}`).toBe(tg);
    }
  });

  it("returns 60 for IG below the last band", () => {
    expect(transmute(-1, "DO15_TRANSITION")).toBe(60);
    expect(transmute(0, "DO15_TRANSITION")).toBe(60);
  });

  it("uses two-decimal rounding before table lookup (87.695 → 87.70 → 90)", () => {
    expect(roundInitialGradeForTable(87.695)).toBe(87.7);
    expect(transmute(87.695, "DO15_TRANSITION")).toBe(90);
  });
});

describe("KEY_STAGE_2_TRIMESTER transmutation", () => {
  it("matches desktop KS2 table for golden IGs", () => {
    for (const [ig, tg] of Object.entries(golden.transmutation.keyStage2)) {
      expect(transmute(Number(ig), "KEY_STAGE_2_TRIMESTER"), `IG ${ig}`).toBe(tg);
    }
  });

  it("re-resolves KS2 from grade level even if stored policy is DO15_TRANSITION", () => {
    expect(
      transmuteForLoad({ gradeLevel: "5", subject: "Science", schoolYear: "2026-2027", policy: "DO15_TRANSITION" }, 99.5),
    ).toBe(100);
  });

  it("rounds IG in SY 2027+ for KS2 (zero-based)", () => {
    expect(
      transmuteForLoad({ gradeLevel: "5", subject: "Science", schoolYear: "2027-2028" }, 87.4),
    ).toBe(87);
  });
});

describe("DO15_ZERO transmutation", () => {
  it("is Math.round of IG", () => {
    expect(transmute(87.4, "DO15_ZERO")).toBe(87);
    expect(transmute(87.5, "DO15_ZERO")).toBe(88);
    expect(transmute(99.49, "DO15_ZERO")).toBe(99);
  });

  it("matches desktop golden zeros", () => {
    for (const [ig, tg] of Object.entries(golden.transmutation.do15Zero)) {
      expect(transmuteForLoad({ gradeLevel: "10", subject: "Mathematics", schoolYear: "2027-2028" }, Number(ig))).toBe(tg);
    }
  });
});

describe("DO15_DESCRIPTIVE transmutation", () => {
  it("uses A≥90 B≥80 C≥75 D≥65 E<65", () => {
    expect(transmuteDescriptive(90)).toBe("A");
    expect(transmuteDescriptive(89.99)).toBe("B");
    expect(transmuteDescriptive(80)).toBe("B");
    expect(transmuteDescriptive(75)).toBe("C");
    expect(transmuteDescriptive(74.99)).toBe("D");
    expect(transmuteDescriptive(65)).toBe("D");
    expect(transmuteDescriptive(64.99)).toBe("E");
  });

  it("matches desktop descriptive goldens", () => {
    for (const [ig, tg] of Object.entries(golden.transmutation.descriptive)) {
      expect(transmute(Number(ig), "DO15_DESCRIPTIVE"), `IG ${ig}`).toBe(tg);
    }
  });
});

describe("DO8_2015 legacy table", () => {
  it("maps 100 to 100 and 60.00 to 75", () => {
    expect(transmute(100, "DO8_2015")).toBe(100);
    expect(transmute(60, "DO8_2015")).toBe(75);
    expect(transmute(59.99, "DO8_2015")).toBe(74);
    expect(transmute(0, "DO8_2015")).toBe(60);
  });

  it("maps 84.00 to 90 (first Outstanding band)", () => {
    expect(transmute(84, "DO8_2015")).toBe(90);
    expect(transmute(83.99, "DO8_2015")).toBe(89);
  });
});

describe("pass/fail and descriptors", () => {
  it("treats numeric ≥75 and A/B/C as passing", () => {
    expect(isPassing(75)).toBe(golden.passing[75]);
    expect(isPassing(74)).toBe(golden.passing[74]);
    expect(isPassing("A")).toBe(golden.passing.A);
    expect(isPassing("D")).toBe(golden.passing.D);
    expect(isPassing("")).toBe(golden.passing.empty);
    expect(isPassing("C")).toBe(true);
    expect(isPassing("E")).toBe(false);
    expect(isPassing("T/O")).toBe(false);
  });

  it("describes numeric and letter grades", () => {
    expect(descriptor(92)).toBe("Advancing (Namumukod-tangi)");
    expect(descriptor(80)).toBe("Benchmarking (Napamamalas)");
    expect(descriptor(75)).toBe("Connecting (Natutungo)");
    expect(descriptor(70)).toBe("Developing (Napauunlad)");
    expect(descriptor(60)).toBe("Emerging (Nagsisimula)");
    expect(descriptor("A")).toBe("Advancing (Namumukod-tangi)");
    expect(descriptor("T/O")).toBe("Transferred Out");
    expect(descriptor(null)).toBe("");
  });

  it("optionally shows numerical equivalents for descriptive letters", () => {
    expect(formatGradeForDisplay("B", "DO15_DESCRIPTIVE", true)).toBe("B (80-89)");
    expect(formatGradeForDisplay(88, "DO15_TRANSITION", true)).toBe("88");
  });
});
