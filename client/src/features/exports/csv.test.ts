import { describe, expect, it } from "vitest";
import { createSampleTeachingLoad } from "../../storage/seed";
import { buildSummaryCsv, buildTermGridCsv, csvEscape, csvFilename } from "./csv";

describe("csv helpers", () => {
  it("quotes commas and doubled quotes", () => {
    expect(csvEscape("Reyes, Maria")).toBe('"Reyes, Maria"');
    expect(csvEscape('Say "Hi"')).toBe('"Say ""Hi"""');
  });
});

describe("buildTermGridCsv / buildSummaryCsv", () => {
  const load = createSampleTeachingLoad();

  it("writes HPS and transmuted TG for the scored term", () => {
    const csv = buildTermGridCsv(load, "1");
    expect(csv).toContain("Name,Sex");
    expect(csv).toContain("HPS");
    expect(csv).toContain("Santos, Juan D.");
    expect(csv).toContain("Reyes, Maria C.");
    expect(csv).toMatch(/,90\r?\n/);
    expect(csv.split(/\r?\n/).length).toBeGreaterThan(6);
  });

  it("writes annual finals and pass/fail on the summary", () => {
    const csv = buildSummaryCsv(load);
    expect(csv).toContain("Term 1,Term 2,Term 3,Final,Status,Descriptor");
    expect(csv).toContain("Passed");
    expect(csv).toContain("Advancing (Namumukod-tangi)");
    expect(csv).toContain("90");
  });

  it("builds a safe download name", () => {
    expect(csvFilename(load, "term-1")).toBe("gradeboss-10-Rizal-Mathematics-term-1.csv");
  });
});
