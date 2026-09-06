import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  computeLearnerYearResult,
  computeMapehTermResult,
  computeTermResult,
  formatInitialGrade,
  isMapehSubject,
} from "../../domain/grading";
import { learnerDisplayName } from "../../models/learner";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import { sortDepEdRoster } from "../roster/sort";
import { downloadBlob } from "./download";
import { reportFilename } from "./names";
import { addDepEdHeader, schoolMeta } from "./pdf-shared";

const TERMS: Term[] = ["1", "2", "3"];

export function buildLearnerCardsPdfBlob(load: TeachingLoad, profile?: TeacherProfile | null): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const learners = sortDepEdRoster(load.learners);
  if (learners.length === 0) {
    addDepEdHeader(doc, "Learner Progress Cards", schoolMeta(load, profile));
    doc.setFontSize(10);
    doc.text("No learners in this teaching load.", 12, 40);
    return doc.output("blob");
  }

  learners.forEach((learner, index) => {
    if (index > 0) doc.addPage();
    const year = computeLearnerYearResult(load, learner.id);
    const startY = addDepEdHeader(
      doc,
      "Learner Progress Card",
      [
        ...schoolMeta(load, profile),
        `Learner: ${learnerDisplayName(learner)}`,
        `LRN: ${learner.lrn || "—"}`,
        `Sex: ${learner.sex || "—"}`,
      ],
    );

    if (isMapehSubject(load.subject)) {
      const rows = TERMS.map((term) => {
        const mapeh = computeMapehTermResult(load, learner.id, term);
        return [
          `Term ${term}`,
          mapeh.musicArts.termGrade === null ? "—" : String(mapeh.musicArts.termGrade),
          mapeh.peHealth.termGrade === null ? "—" : String(mapeh.peHealth.termGrade),
          mapeh.consolidatedGrade === "" || mapeh.consolidatedGrade === null ? "—" : String(mapeh.consolidatedGrade),
        ];
      });
      autoTable(doc, {
        startY,
        head: [["Term", "Music & Arts", "PE & Health", "Consolidated"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
      });
    } else {
      const rows = TERMS.map((term) => {
        const result = computeTermResult(load, learner.id, term);
        const summary = year.terms.find((item) => item.term === term);
        return [
          `Term ${term}`,
          result.hasData ? String(formatInitialGrade(result.ww.ps)) : "—",
          result.hasData ? String(formatInitialGrade(result.pt.ps)) : "—",
          result.hasData ? String(formatInitialGrade(result.examPS)) : "—",
          result.hasData ? String(formatInitialGrade(result.initialGrade)) : "—",
          summary?.display || "—",
        ];
      });
      autoTable(doc, {
        startY,
        head: [["Term", "WW PS", "PT PS", "Exam PS", "IG", "TG"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 2, halign: "center" },
        headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { halign: "left" } },
      });
    }

    const status = year.passed === null ? "Incomplete" : year.passed ? "Passed" : "Failed";
    autoTable(doc, {
      startY: 170,
      head: [["Final grade", "Descriptor", "Status"]],
      body: [[year.annualDisplay || "—", year.annualDescriptor || "—", status]],
      theme: "grid",
      styles: { fontSize: 11, cellPadding: 3 },
      headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
    });
  });

  return doc.output("blob");
}

export function downloadLearnerCardsPdf(load: TeachingLoad, profile?: TeacherProfile | null): void {
  downloadBlob(reportFilename(load, "learner-cards", "pdf"), buildLearnerCardsPdfBlob(load, profile));
}
