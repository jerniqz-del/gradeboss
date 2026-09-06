import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseSf1 } from "../../sf1";
import { createTeachingLoad } from "../teaching-loads/create-load";
import { attachSf1RosterToLoad, attachSf1RosterToMatchingLoads, findLoadsForSection } from "./sf1-link";
import { createLearner } from "./learner";

function buildSf1Buffer(): Uint8Array {
  const rows = [
    ["School ID", "300001", "School Name", "Demo National High School"],
    ["School Year", "2026-2027", "Grade Level", "10", "Section", "Rizal"],
    ["LRN", "NAME (Last Name, First Name, Middle Name)", "Sex", "Birth Date", "Age", "Modality", "Remarks"],
    ["MALE"],
    ["123456789012", "Santos, Juan, Dela", "M", "2012-05-01", "14", "In-Person", ""],
    ["FEMALE"],
    ["123456789013", "Reyes, Maria, Cruz", "F", "2012-08-15", "13", "In-Person", ""],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "SF1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayLike<number>);
}

describe("SF1 → teaching load roster", () => {
  it("imports a generated SF1 workbook onto a matching load in DepEd order", () => {
    const parsed = parseSf1(buildSf1Buffer());
    expect(parsed.learners).toHaveLength(2);
    const load = createTeachingLoad({
      gradeLevel: "10",
      section: "Rizal",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    const next = attachSf1RosterToLoad(load, parsed, "cls-1");
    expect(next.learners.map((item) => item.lastName)).toEqual(["Santos", "Reyes"]);
    expect(next.learners[0].sex).toBe("M");
    expect(next.learners[1].sex).toBe("F");
    expect(next.learners[0].lrn).toBe("123456789012");
    expect(next.sourceClassId).toBe("cls-1");
    expect(next.sf1Meta?.schoolName).toBe("Demo National High School");
  });

  it("merges by LRN and keeps the existing learner id", () => {
    const load = createTeachingLoad({
      gradeLevel: "10",
      section: "Rizal",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    const existing = createLearner({
      lrn: "123456789012",
      lastName: "Santos",
      firstName: "Juan",
      sex: "M",
    });
    load.learners = [existing];
    const parsed = parseSf1(buildSf1Buffer());
    const next = attachSf1RosterToLoad(load, parsed);
    expect(next.learners).toHaveLength(2);
    expect(next.learners.find((item) => item.lrn === "123456789012")?.id).toBe(existing.id);
    expect(next.learners.find((item) => item.lrn === "123456789012")?.middleName).toBe("Dela");
  });

  it("applies the roster to other subject loads in the same section", () => {
    const math = createTeachingLoad({
      gradeLevel: "10",
      section: "Rizal",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    const science = createTeachingLoad({
      gradeLevel: "10",
      section: "Rizal",
      subject: "Science",
      schoolYear: "2026-2027",
    });
    const other = createTeachingLoad({
      gradeLevel: "10",
      section: "Bonifacio",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    const parsed = parseSf1(buildSf1Buffer());
    const updated = attachSf1RosterToMatchingLoads([math, science, other], parsed);
    expect(updated).toHaveLength(2);
    expect(updated.every((load) => load.learners.length === 2)).toBe(true);
    expect(findLoadsForSection([math, science, other], parsed.meta).map((item) => item.subject)).toEqual([
      "Mathematics",
      "Science",
    ]);
  });
});
