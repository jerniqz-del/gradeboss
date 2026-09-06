import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { computeTermResult } from "../../domain/grading";
import { createDefaultProfile } from "../../models/teacher-profile";
import { createSampleTeachingLoad } from "../../storage/seed";
import { createTeachingLoad } from "../teaching-loads/create-load";
import { createLearner } from "../roster/learner";
import { scoreKey } from "../../models/assessment";
import { buildExcelExportPayload } from "./excel-payload";
import { createEcrSkeleton, fillExcelWorkbook, workbookToBlob } from "./excel";

describe("DepEd ECR Excel export", () => {
  const profile = {
    ...createDefaultProfile(),
    teacherName: "Ada Lovelace",
    schoolName: "Rizal NHS",
    schoolId: "123456",
    region: "IV-A",
    division: "Cavite",
  };

  it("fills TERM 1 male/female names and transmuted grades at official cell refs", () => {
    const load = createSampleTeachingLoad();
    const payload = buildExcelExportPayload(load, profile);
    expect(payload.isMapeh).toBe(false);
    expect(payload.males.length).toBe(2);
    expect(payload.females.length).toBe(3);
    expect(payload.terms["1"].wwHps[0]).toBe(25);

    const workbook = fillExcelWorkbook(payload, createEcrSkeleton());
    const sheet = workbook.Sheets["TERM 1"];
    const firstMale = payload.males[0];
    const firstFemale = payload.females[0];
    expect(sheet.B13.v).toBe(firstMale.name);
    expect(sheet.B64.v).toBe(firstFemale.name);
    expect(sheet.G5.v).toBe("Rizal NHS");
    expect(sheet.T8.v).toBe("Ada Lovelace");
    expect(sheet.F11.v).toBe(25);

    const juan = load.learners.find((item) => item.lastName === "Santos");
    expect(juan).toBeTruthy();
    const result = computeTermResult(load, juan!.id, "1");
    const juanRow = payload.males.find((row) => row.name.includes("Santos"));
    expect(juanRow?.terms["1"].termGrade).toBe(String(result.termGrade));
    expect(sheet.AA13.v).toBe(firstMale.terms["1"].termGrade);
  });

  it("writes a valid xlsx blob", async () => {
    const load = createSampleTeachingLoad();
    const workbook = fillExcelWorkbook(buildExcelExportPayload(load, profile), createEcrSkeleton());
    const blob = workbookToBlob(workbook);
    expect(blob.size).toBeGreaterThan(1000);
    const header = new Uint8Array(await blob.arrayBuffer()).slice(0, 2);
    expect(String.fromCharCode(header[0], header[1])).toBe("PK");
  });

  it("splits MAPEH into Music & Arts, PE & Health, and consolidation sheets", () => {
    const load = createTeachingLoad({
      gradeLevel: "8",
      section: "Bonifacio",
      subject: "MAPEH",
      schoolYear: "2026-2027",
    });
    const learner = createLearner({ lastName: "Reyes", firstName: "Maria", sex: "F" });
    load.learners = [learner];
    for (const assessment of load.assessments.filter((item) => item.term === "1")) {
      assessment.maxScore = 50;
      load.scores[scoreKey(learner.id, assessment.id)] = 45;
    }
    const payload = buildExcelExportPayload(load, profile);
    expect(payload.isMapeh).toBe(true);
    expect(payload.music_arts?.females[0].name).toContain("Reyes");
    expect(payload.consolidated?.females[0].t1Cons).not.toBe("");

    const workbook = fillExcelWorkbook(payload, createEcrSkeleton());
    expect(workbook.SheetNames).toEqual([
      "M&A - TERM 1",
      "M&A - TERM 2",
      "M&A - TERM 3",
      "M&A - SUMMARY",
      "PEH - TERM 1",
      "PEH - TERM 2",
      "PEH - TERM 3",
      "PEH - SUMMARY",
      "MAPEH CONSOLIDATION",
    ]);
    const cons = XLSX.utils.sheet_to_json<Array<string | number>>(workbook.Sheets["MAPEH CONSOLIDATION"], { header: 1 });
    expect(String(cons[0][0])).toContain("MAPEH Consolidated");
    expect(cons.some((row) => row.some((cell) => String(cell).includes("Reyes")))).toBe(true);
  });
});
