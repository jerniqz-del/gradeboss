import { describe, expect, it } from "vitest";
import type { AdvisoryGrade, AdvisorySubject } from "../../models/advisory";
import { createRecordId, nowIso } from "../../models/advisory";
import {
  calculateGeneralAverage,
  calculateMapehFinal,
  calculateSubjectFinal,
  subjectGroupsForGradeRecord,
} from "./average";

function subject(name: string, include = true): AdvisorySubject {
  const createdAt = nowIso();
  return {
    id: createRecordId("sub"),
    advisoryClassId: "cls",
    subjectName: name,
    normalizedSubjectKey: name.toUpperCase(),
    expectedSourceTeacher: "",
    expectedSourceClass: "",
    expectedSourceClassId: "",
    sourceType: "grade-transfer-file",
    displayOrder: 0,
    isSpecialProgramSubject: false,
    includeInGeneralAverage: include,
    isArchived: false,
    createdAt,
    updatedAt: createdAt,
  };
}

function grade(learnerId: string, subjectId: string, term: "1" | "2" | "3", finalGrade: number): AdvisoryGrade {
  const createdAt = nowIso();
  return {
    id: createRecordId("g"),
    advisoryClassId: "cls",
    advisoryLearnerId: learnerId,
    advisorySubjectId: subjectId,
    schoolYear: "2026-2027",
    learnerLrn: "123456789012",
    subjectName: "",
    normalizedSubjectKey: "",
    gradeLevel: "7",
    section: "Rizal",
    term,
    finalGrade,
    gradeStatus: "final",
    sourceType: "grade-transfer-file",
    sourceClassId: "",
    sourceClassName: "",
    sourceTeacherName: "",
    exportId: "",
    importBatchId: "",
    exportedAt: "",
    importedAt: createdAt,
    validationStatus: "valid",
    conflictStatus: "none",
    remarks: "",
    createdAt,
    updatedAt: createdAt,
  };
}

describe("advisory averages", () => {
  it("computes a subject final as the rounded mean of three terms", () => {
    const math = subject("Mathematics");
    const grades = [
      grade("L1", math.id, "1", 88),
      grade("L1", math.id, "2", 90),
      grade("L1", math.id, "3", 91),
    ];
    expect(calculateSubjectFinal(grades, "L1", math.id)).toBe(90);
  });

  it("returns null for a subject final until all three terms exist", () => {
    const math = subject("Mathematics");
    expect(calculateSubjectFinal([grade("L1", math.id, "1", 88)], "L1", math.id)).toBeNull();
  });

  it("counts MAPEH once in the General Average", () => {
    const fil = subject("Filipino");
    const eng = subject("English");
    const music = subject("Music & Arts");
    const pe = subject("PE & Health");
    const journalism = subject("Campus Journalism", false);
    const grades = [
      ...(["1", "2", "3"] as const).flatMap((term) => [
        grade("L1", fil.id, term, 80),
        grade("L1", eng.id, term, 90),
        grade("L1", music.id, term, 70),
        grade("L1", pe.id, term, 90),
        grade("L1", journalism.id, term, 99),
      ]),
    ];
    // Subject finals: FIL 80, ENG 90, MAPEH = round(mean of term avgs of 80) = 80
    expect(calculateMapehFinal(grades, "L1", [fil, eng, music, pe])).toBe(80);
    expect(calculateGeneralAverage(grades, "L1", [fil, eng, music, pe, journalism])).toBe(83.33);
  });

  it("inserts a derived MAPEH Average column before the MAPEH parts", () => {
    const fil = subject("Filipino");
    const music = subject("Music & Arts");
    const pe = subject("PE & Health");
    fil.displayOrder = 0;
    music.displayOrder = 1;
    pe.displayOrder = 2;
    const groups = subjectGroupsForGradeRecord([fil, music, pe]);
    expect(groups[0].subjectName).toBe("Filipino");
    expect(groups[1].subjectName).toBe("MAPEH Average");
    expect(groups[1].derived).toBe(true);
    expect(groups.map((item) => item.subjectName)).toEqual([
      "Filipino",
      "MAPEH Average",
      "Music & Arts",
      "PE & Health",
    ]);
  });
});
