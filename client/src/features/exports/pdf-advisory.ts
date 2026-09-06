import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ADVISORY_TERMS,
  calculateGeneralAverage,
  calculateGeneralTermAverage,
  calculateMapehFinal,
  calculateMapehTermAverage,
  calculateSubjectFinal,
  formatGeneralAverage,
  subjectGroupsForGradeRecord,
} from "../../domain/advisory";
import { officialFullName } from "../../domain/advisory/match";
import type { AdvisoryClass, AdvisoryGrade, AdvisoryStore } from "../../models/advisory";
import { advisoryLearnerAsLearner } from "../../models/advisory";
import { sortDepEdRoster } from "../roster/sort";
import { downloadBlob } from "./download";
import { safeFilenamePart } from "./names";
import { addDepEdHeader } from "./pdf-shared";

export type AdvisoryReportMode = "finals" | "terms";

function groupsOf<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  items.forEach((item, index) => {
    if (index % size === 0) groups.push([]);
    groups[groups.length - 1].push(item);
  });
  return groups;
}

function gradeValue(
  grades: AdvisoryGrade[],
  learnerId: string,
  subjectId: string,
  term: "1" | "2" | "3",
): number | null {
  const row = grades.find(
    (item) => item.advisoryLearnerId === learnerId && item.advisorySubjectId === subjectId && item.term === term,
  );
  return row && Number.isFinite(row.finalGrade) ? row.finalGrade : null;
}

function cell(value: number | null, display?: string): string {
  if (value === null || value === undefined) return "—";
  return display ?? String(value);
}

export function advisoryReportFilename(advisoryClass: AdvisoryClass, mode: AdvisoryReportMode): string {
  const sy = safeFilenamePart(advisoryClass.schoolYear);
  const section = safeFilenamePart(`${advisoryClass.gradeLevel}-${advisoryClass.section}`);
  const detail = mode === "terms" ? "terms-1-3-and-finals" : "final-grades-only";
  return `gradeboss-advisory-SY${sy}-G${section}-${detail}.pdf`;
}

export function buildAdvisoryGradePdfBlob(
  store: AdvisoryStore,
  advisoryClass: AdvisoryClass,
  mode: AdvisoryReportMode,
): Blob {
  const learners = sortDepEdRoster(
    store.learners
      .filter((item) => item.advisoryClassId === advisoryClass.id && item.enrollmentStatus !== "inactive")
      .map(advisoryLearnerAsLearner),
  );
  const subjects = store.subjects.filter((item) => item.advisoryClassId === advisoryClass.id && !item.isArchived);
  const grades = store.grades.filter((item) => item.advisoryClassId === advisoryClass.id);
  const grouped = subjectGroupsForGradeRecord(subjects);
  const includeTerms = mode === "terms";
  const chunks = includeTerms ? groupsOf(grouped, 3) : grouped.length ? [grouped] : [];
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const modeLabel = includeTerms ? "Terms 1–3 and Final Grades" : "Final Grades Only";

  if (!chunks.length) {
    addDepEdHeader(doc, "Learner Grade Record", [
      modeLabel,
      `School Year ${advisoryClass.schoolYear}`,
      `Grade ${advisoryClass.gradeLevel} – ${advisoryClass.section}`,
      `Adviser: ${advisoryClass.adviserName || "—"}`,
    ]);
    doc.setFontSize(10);
    doc.text("No active subjects have been configured for this Advisory Class.", 12, 40);
    return doc.output("blob");
  }

  chunks.forEach((group, index) => {
    if (index > 0) doc.addPage();
    const includeAverage = index === chunks.length - 1;
    addDepEdHeader(doc, "Learner Grade Record", [
      modeLabel,
      `School Year ${advisoryClass.schoolYear} · Grade ${advisoryClass.gradeLevel} – ${advisoryClass.section}`,
      `Adviser: ${advisoryClass.adviserName || "—"}`,
      `Subject group ${index + 1} of ${chunks.length}`,
    ]);

    const headTop: string[] = ["LRN / Official Name"];
    const headBottom: string[] = [""];
    group.forEach((subject) => {
      if (includeTerms) {
        headTop.push(subject.subjectName, "", "", "");
        headBottom.push("T1", "T2", "T3", "Final");
      } else {
        headTop.push(subject.subjectName);
        headBottom.push("Final");
      }
    });
    if (includeAverage) {
      if (includeTerms) {
        headTop.push("General Average", "", "", "");
        headBottom.push("T1", "T2", "T3", "Final");
      } else {
        headTop.push("General Average");
        headBottom.push("Final");
      }
    }

    const body = learners.map((learner) => {
      const row: Array<string | number> = [`${learner.lrn || "No LRN"}\n${officialFullName(learner)}`];
      group.forEach((subject) => {
        if (includeTerms) {
          ADVISORY_TERMS.forEach((term) => {
            const value = subject.derived
              ? calculateMapehTermAverage(grades, learner.id, subjects, term)
              : gradeValue(grades, learner.id, subject.id, term);
            row.push(cell(value));
          });
        }
        const final = subject.derived
          ? calculateMapehFinal(grades, learner.id, subjects)
          : calculateSubjectFinal(grades, learner.id, subject.id);
        row.push(cell(final));
      });
      if (includeAverage) {
        if (includeTerms) {
          ADVISORY_TERMS.forEach((term) => {
            const value = calculateGeneralTermAverage(grades, learner.id, subjects, term);
            row.push(cell(value, formatGeneralAverage(value)));
          });
        }
        const ga = calculateGeneralAverage(grades, learner.id, subjects);
        row.push(cell(ga, formatGeneralAverage(ga)));
      }
      return row;
    });

    autoTable(doc, {
      startY: 32,
      head: includeTerms ? [headTop, headBottom] : [headTop],
      body: body.length ? body : [["No active learners are in this Advisory Class."]],
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 0.8, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold", halign: "center" },
      columnStyles: { 0: { cellWidth: 48, halign: "left", fontStyle: "bold" } },
    });
  });

  return doc.output("blob");
}

export function downloadAdvisoryGradePdf(
  store: AdvisoryStore,
  advisoryClass: AdvisoryClass,
  mode: AdvisoryReportMode,
): void {
  downloadBlob(advisoryReportFilename(advisoryClass, mode), buildAdvisoryGradePdfBlob(store, advisoryClass, mode));
}
