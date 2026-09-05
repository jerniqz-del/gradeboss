import { describe, expect, it } from "vitest";
import { parseLearnerCsvPaste } from "./csv";

describe("parseLearnerCsvPaste", () => {
  it("parses LRN, Last, First, Sex rows and skips a header", () => {
    const text = [
      "LRN, Last Name, First Name, Sex",
      "123456789012, Santos, Juan, M",
      "123456789013, Reyes, Maria, F",
    ].join("\n");
    const result = parseLearnerCsvPaste(text);
    expect(result.errors).toEqual([]);
    expect(result.learners).toHaveLength(2);
    expect(result.learners[0].lastName).toBe("Santos");
    expect(result.learners[0].sex).toBe("M");
    expect(result.learners[1].firstName).toBe("Maria");
    expect(result.learners[0].avatarPresetId).toMatch(/^male-avatar-/);
  });

  it("skips duplicates by LRN or last+first name", () => {
    const existing = parseLearnerCsvPaste("123456789012, Santos, Juan, M").learners;
    const result = parseLearnerCsvPaste(
      ["123456789012, Santos, Juan, M", "123456789099, Santos, Juan, M", "123456789014, Cruz, Ana, F"].join("\n"),
      existing,
    );
    expect(result.learners).toHaveLength(1);
    expect(result.skipped).toBe(2);
    expect(result.learners[0].lastName).toBe("Cruz");
  });

  it("accepts Last, First Middle paste without LRN", () => {
    const result = parseLearnerCsvPaste("Dela Cruz, Juan Miguel");
    expect(result.learners).toHaveLength(1);
    expect(result.learners[0].lastName).toBe("Dela Cruz");
    expect(result.learners[0].firstName).toBe("Juan");
    expect(result.learners[0].middleName).toBe("Miguel");
  });
});
