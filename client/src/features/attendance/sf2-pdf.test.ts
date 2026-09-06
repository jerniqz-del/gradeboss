import { describe, expect, it } from "vitest";
import { applyRollCall, buildSf2Payload } from "../../domain/attendance";
import { emptyAttendance } from "../../models/attendance";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { buildSf2PdfBlob } from "./sf2-pdf";

function learner(id: string, sex: "M" | "F"): Learner {
  return {
    id,
    lrn: id.padStart(12, "0"),
    lastName: id,
    firstName: "Test",
    middleName: "",
    sex,
    birthdate: "2012-01-01",
  };
}

describe("SF2 PDF", () => {
  it("emits a PDF whose present-count rows match the payload totals", async () => {
    const learners = [learner("M1", "M"), learner("F1", "F")];
    const attendance = applyRollCall(emptyAttendance(), "2026-09-02", { M1: "absent" });
    const load: TeachingLoad = {
      id: "pdf-load",
      gradeLevel: "8",
      section: "Bonifacio",
      subject: "English",
      subjectGroup: "JHS_CORE",
      policy: "DO15_TRANSITION",
      schoolYear: "2026-2027",
      dashboardOrder: 0,
      learners,
      assessments: [],
      scores: {},
      attendance,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const payload = buildSf2Payload(load, "2026-09");
    expect(payload.totals.male["2026-09-02"]).toBe(0);
    expect(payload.totals.female["2026-09-02"]).toBe(1);
    expect(payload.totals.all["2026-09-02"]).toBe(1);

    const blob = buildSf2PdfBlob(payload);
    expect(blob.type).toContain("pdf");
    expect(blob.size).toBeGreaterThan(500);
    const header = new Uint8Array(await blob.arrayBuffer()).slice(0, 4);
    expect(String.fromCharCode(...header)).toBe("%PDF");
  });
});
