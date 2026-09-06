import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { computeLoadInsights, computeTermResult, isMapehSubject } from "../../domain/grading";
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

const TERMS: Term[] = ["1", "2", "3"];

function missingCount(load: TeachingLoad, learnerId: string, term: Term, mapePart?: MapePart): { filled: number; expected: number } {
  const columns = termAssessments(load, term, mapePart).filter((item) => item.maxScore > 0);
  let filled = 0;
  for (const col of columns) {
    const value = load.scores[scoreKey(learnerId, col.id)];
    if (typeof value === "number") filled += 1;
  }
  return { filled, expected: columns.length };
}

export function buildTermCompletionPdfBlob(load: TeachingLoad, profile?: TeacherProfile | null): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const insights = computeLoadInsights(load);
  const startY = addDepEdHeader(doc, "Term Completion Report", schoolMeta(load, profile));
  autoTable(doc, {
    startY,
    head: [["Term", "Filled", "Expected", "Missing", "Complete %", "Class average"]],
    body: insights.termCompletions.map((row, index) => [
      `Term ${row.term}`,
      row.filled,
      row.expected,
      row.missing,
      `${row.percent}%`,
      insights.termAverages[index]?.display || "—",
    ]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.4, halign: "center" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
  });

  const mapePart: MapePart | undefined = isMapehSubject(load.subject) ? "music_arts" : undefined;
  const body = sortDepEdRoster(load.learners).map((learner) => {
    const counts = TERMS.map((term) => missingCount(load, learner.id, term, mapePart));
    const year = insights.yearResults.find((row) => row.learnerId === learner.id);
    const t1 = computeTermResult(load, learner.id, "1", mapePart);
    return [
      learnerDisplayName(learner),
      learner.sex,
      `${counts[0].filled}/${counts[0].expected}`,
      `${counts[1].filled}/${counts[1].expected}`,
      `${counts[2].filled}/${counts[2].expected}`,
      t1.termGrade === null ? "—" : String(t1.termGrade),
      year?.annualDisplay || "—",
      year?.passed === null ? "Incomplete" : year?.passed ? "Passed" : "Failed",
    ];
  });

  autoTable(doc, {
    startY: lastTableY(doc, startY) + 8,
    head: [["Learner", "Sex", "T1 scores", "T2 scores", "T3 scores", "T1 TG", "Final", "Status"]],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1, overflow: "linebreak" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 50 } },
  });

  doc.setFontSize(8);
  doc.text(
    `Overall completion ${insights.completionPercent}% · Missing scores ${insights.missingScores} · Class average ${insights.classAverageDisplay || "—"}`,
    8,
    lastTableY(doc) + 8,
  );
  return doc.output("blob");
}

export function downloadTermCompletionPdf(load: TeachingLoad, profile?: TeacherProfile | null): void {
  downloadBlob(reportFilename(load, "term-completion", "pdf"), buildTermCompletionPdfBlob(load, profile));
}
