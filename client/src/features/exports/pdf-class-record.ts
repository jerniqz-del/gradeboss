import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  computeClassYearResults,
  computeTermResult,
  formatInitialGrade,
  isMapehSubject,
} from "../../domain/grading";
import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { sortDepEdRoster } from "../roster/sort";
import { termAssessments } from "./csv";
import { downloadBlob } from "./download";
import { reportFilename } from "./names";
import { addDepEdHeader, lastTableY, schoolMeta } from "./pdf-shared";

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function addTermTable(
  doc: jsPDF,
  load: TeachingLoad,
  term: Term,
  mapePart: MapePart | undefined,
  profile?: TeacherProfile | null,
): void {
  const partLabel = mapePart === "music_arts" ? " · Music & Arts" : mapePart === "pe_health" ? " · PE & Health" : "";
  const startY = addDepEdHeader(
    doc,
    `Class Record — Term ${term}${partLabel}`,
    schoolMeta(load, profile),
  );
  const columns = termAssessments(load, term, mapePart);
  const head = ["#", "Name", "Sex", ...columns.map((col) => col.title), "WW PS", "PT PS", "Exam PS", "IG", "TG"];
  const hps = ["", "HPS", "", ...columns.map((col) => dash(col.maxScore || "")), "", "", "", "", ""];
  const body: Array<Array<string | number>> = [hps];
  sortDepEdRoster(load.learners).forEach((learner, index) => {
    const result = computeTermResult(load, learner.id, term, mapePart);
    body.push([
      index + 1,
      learnerDisplayName(learner),
      learner.sex,
      ...columns.map((col) => dash(load.scores[scoreKey(learner.id, col.id)])),
      result.hasData ? formatInitialGrade(result.ww.ps) : "",
      result.hasData ? formatInitialGrade(result.pt.ps) : "",
      result.hasData ? formatInitialGrade(result.examPS) : "",
      result.hasData ? formatInitialGrade(result.initialGrade) : "",
      result.termGrade === null ? "" : String(result.termGrade),
    ]);
  });
  autoTable(doc, {
    startY,
    head: [head],
    body,
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 0.6, halign: "center", overflow: "linebreak" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 42, halign: "left" },
      2: { cellWidth: 8 },
    },
    didParseCell(data) {
      const raw = data.row.raw;
      const name = Array.isArray(raw) ? String(raw[1] ?? "") : "";
      if (data.section === "body" && name === "HPS") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [236, 238, 245];
      }
    },
  });
}

function addSummaryTable(doc: jsPDF, load: TeachingLoad, profile?: TeacherProfile | null): void {
  const startY = addDepEdHeader(doc, "Class Record — Summary", schoolMeta(load, profile));
  const byId = new Map(computeClassYearResults(load).map((row) => [row.learnerId, row]));
  const body = sortDepEdRoster(load.learners).map((learner, index) => {
    const year = byId.get(learner.id);
    const status = year?.passed === null ? "" : year?.passed ? "Passed" : "Failed";
    return [
      index + 1,
      learnerDisplayName(learner),
      learner.sex,
      year?.terms[0]?.display || "",
      year?.terms[1]?.display || "",
      year?.terms[2]?.display || "",
      year?.annualDisplay || "",
      status,
      year?.annualDescriptor || "",
    ];
  });
  autoTable(doc, {
    startY,
    head: [["#", "Name", "Sex", "Term 1", "Term 2", "Term 3", "Final", "Status", "Descriptor"]],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1, overflow: "linebreak" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 50 } },
  });
}

export function buildClassRecordPdfBlob(
  load: TeachingLoad,
  options: {
    tab?: Term | "summary" | "full";
    mapePart?: MapePart;
    profile?: TeacherProfile | null;
  } = {},
): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const tab = options.tab || "full";
  const mapeh = isMapehSubject(load.subject);
  const parts: Array<MapePart | undefined> = mapeh
    ? options.mapePart
      ? [options.mapePart]
      : ["music_arts", "pe_health"]
    : [undefined];

  let first = true;
  const addPage = () => {
    if (!first) doc.addPage();
    first = false;
  };

  if (tab === "summary") {
    addSummaryTable(doc, load, options.profile);
  } else if (tab === "1" || tab === "2" || tab === "3") {
    parts.forEach((part, index) => {
      if (index > 0) doc.addPage();
      addTermTable(doc, load, tab, part, options.profile);
    });
  } else {
    (["1", "2", "3"] as Term[]).forEach((term) => {
      parts.forEach((part) => {
        addPage();
        addTermTable(doc, load, term, part, options.profile);
      });
    });
    addPage();
    addSummaryTable(doc, load, options.profile);
  }

  const y = lastTableY(doc, 170) + 8;
  if (y < 200) {
    doc.setFontSize(8);
    doc.text("Generated by GradeBoss. Keep this class record secure.", 8, y);
  }
  return doc.output("blob");
}

export function downloadClassRecordPdf(
  load: TeachingLoad,
  options: { tab?: Term | "summary" | "full"; mapePart?: MapePart; profile?: TeacherProfile | null } = {},
): void {
  const suffix = options.tab === "full" || !options.tab
    ? "class-record"
    : options.tab === "summary"
      ? "class-record-summary"
      : `class-record-term-${options.tab}`;
  downloadBlob(reportFilename(load, suffix, "pdf"), buildClassRecordPdfBlob(load, options));
}
