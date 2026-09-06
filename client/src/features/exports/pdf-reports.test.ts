import { describe, expect, it } from "vitest";
import { createEmptyAdvisoryStore } from "../../models/advisory";
import { createDefaultProfile } from "../../models/teacher-profile";
import { createSampleTeachingLoad } from "../../storage/seed";
import { createAdvisoryClass, addAdvisoryLearnerFromRoster } from "../../domain/advisory";
import { computeClassAnalysis } from "./analysis";
import { buildClassAnalysisPdfBlob } from "./pdf-analysis";
import { advisoryReportFilename, buildAdvisoryGradePdfBlob } from "./pdf-advisory";
import { buildClassRecordPdfBlob } from "./pdf-class-record";
import { buildTermCompletionPdfBlob } from "./pdf-completion";
import { buildLearnerCardsPdfBlob } from "./pdf-learner";
import { pdfHeaderBytes } from "./pdf-shared";

async function expectPdf(blob: Blob) {
  expect(blob.type).toContain("pdf");
  expect(blob.size).toBeGreaterThan(500);
  expect(await pdfHeaderBytes(blob)).toBe("%PDF");
}

describe("report PDFs", () => {
  const load = createSampleTeachingLoad();
  const profile = { ...createDefaultProfile(), teacherName: "Ada", schoolName: "Rizal NHS" };

  it("emits a class record PDF for a term and for the full year", async () => {
    await expectPdf(buildClassRecordPdfBlob(load, { tab: "1", profile }));
    await expectPdf(buildClassRecordPdfBlob(load, { tab: "summary", profile }));
    await expectPdf(buildClassRecordPdfBlob(load, { tab: "full", profile }));
  });

  it("emits learner progress cards and a term completion report", async () => {
    await expectPdf(buildLearnerCardsPdfBlob(load, profile));
    await expectPdf(buildTermCompletionPdfBlob(load, profile));
  });

  it("computes class analysis stats that match scored term data", async () => {
    const analysis = computeClassAnalysis(load, "1");
    expect(analysis.termLabel).toBe("Term 1");
    expect(analysis.assessments.length).toBeGreaterThan(0);
    expect(analysis.learners).toHaveLength(load.learners.length);
    expect(analysis.classStats.passRate).toBeGreaterThan(0);
    expect(analysis.assessments.every((item) => item.takers === load.learners.length)).toBe(true);
    await expectPdf(buildClassAnalysisPdfBlob(load, "1", undefined, profile));
  });

  it("emits an advisory grade record PDF", async () => {
    let store = createEmptyAdvisoryStore();
    store = createAdvisoryClass(store, {
      schoolYear: "2026-2027",
      gradeLevel: "7",
      section: "Rizal",
      adviserName: "Ada",
    });
    store = addAdvisoryLearnerFromRoster(store, store.classes[0].id, load.learners[0]);
    const blob = buildAdvisoryGradePdfBlob(store, store.classes[0], "finals");
    await expectPdf(blob);
    expect(advisoryReportFilename(store.classes[0], "finals")).toContain("final-grades-only");
    await expectPdf(buildAdvisoryGradePdfBlob(store, store.classes[0], "terms"));
  });
});
