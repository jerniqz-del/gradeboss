import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { computeClassAnalysis } from "./analysis";
import { downloadBlob } from "./download";
import { reportFilename } from "./names";
import { addDepEdHeader, lastTableY, schoolMeta } from "./pdf-shared";

function pct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function buildClassAnalysisPdfBlob(
  load: TeachingLoad,
  term: Term | "summary",
  mapePart?: MapePart,
  profile?: TeacherProfile | null,
): Blob {
  const analysis = computeClassAnalysis(load, term, mapePart);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const startY = addDepEdHeader(
    doc,
    `Class Progress Report — ${analysis.termLabel}`,
    schoolMeta(load, profile),
  );
  autoTable(doc, {
    startY,
    head: [["Mean", "Median", "Mode", "SD", "MPS", "Pass rate"]],
    body: [[
      analysis.classStats.mean.toFixed(1),
      analysis.classStats.median.toFixed(1),
      analysis.classStats.mode === null ? "—" : String(analysis.classStats.mode),
      analysis.classStats.stdDev.toFixed(1),
      pct(analysis.classStats.mps),
      pct(analysis.classStats.passRate),
    ]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.5, halign: "center" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 6,
    head: [["Assessment", "Comp", "HPS", "Takers", "Mean", "Median", "SD", "MPS", "Interpretation"]],
    body: analysis.assessments.map((item) => [
      item.title,
      item.component,
      item.hps || "—",
      item.takers,
      item.mean.toFixed(1),
      item.median.toFixed(1),
      item.stdDev.toFixed(1),
      pct(item.mps),
      item.mastery,
    ]),
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 0.8, overflow: "linebreak" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
  });

  autoTable(doc, {
    startY: lastTableY(doc) + 6,
    head: [["Rank", "Learner", "Sex", "WW PS", "PT PS", "Exam PS", "IG", "TG", "Remarks"]],
    body: analysis.learners.map((row) => [
      row.rank,
      row.name,
      row.sex,
      row.wwPs === null ? "—" : pct(row.wwPs),
      row.ptPs === null ? "—" : pct(row.ptPs),
      row.examPs === null ? "—" : pct(row.examPs),
      row.initialGrade === null ? "—" : row.initialGrade.toFixed(1),
      row.termGrade,
      row.remarks,
    ]),
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 0.8, overflow: "linebreak" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { cellWidth: 46 } },
  });
  return doc.output("blob");
}

export function downloadClassAnalysisPdf(
  load: TeachingLoad,
  term: Term | "summary",
  mapePart?: MapePart,
  profile?: TeacherProfile | null,
): void {
  const suffix = term === "summary" ? "class-analysis-summary" : `class-analysis-term-${term}`;
  downloadBlob(reportFilename(load, suffix, "pdf"), buildClassAnalysisPdfBlob(load, term, mapePart, profile));
}
