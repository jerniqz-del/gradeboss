import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Sf2Payload } from "../../domain/attendance";
import { sf2Filename } from "../../domain/attendance";
import type { TeachingLoad } from "../../models/teaching-load";
import { downloadBlob } from "../exports/download";

function dayNum(date: string): string {
  return String(Number(date.slice(8)));
}

export function buildSf2PdfBlob(payload: Sf2Payload): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Republic of the Philippines", pageWidth / 2, 10, { align: "center" });
  doc.text("Department of Education", pageWidth / 2, 14, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(payload.title, pageWidth / 2, 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const meta = [
    `School: ${payload.schoolName || "—"}`,
    `School ID: ${payload.schoolId || "—"}`,
    `School Year: ${payload.schoolYear || "—"}`,
    `Month: ${payload.monthLabel}`,
    `Grade/Section: ${payload.gradeSection}`,
    `District: ${payload.district || "—"}`,
    `Division: ${payload.division || "—"}`,
    `Region: ${payload.region || "—"}`,
  ];
  doc.text(meta.join("   "), 8, 26);

  const males = payload.learners.filter((row) => row.sex === "M");
  const females = payload.learners.filter((row) => row.sex === "F");
  const others = payload.learners.filter((row) => row.sex !== "M" && row.sex !== "F");

  const head = ["#", "Name", ...payload.dates.map(dayNum), "ABS", "TDY"];
  const body: Array<Array<string | number>> = [];

  const pushGroup = (
    rows: Sf2Payload["learners"],
    totalLabel: string,
    totals: Record<string, number | "">,
  ) => {
    rows.forEach((row, index) => {
      body.push([
        index + 1,
        row.name,
        ...payload.dates.map((date) => row.marks[date] || ""),
        row.absent || "",
        row.tardy || "",
      ]);
    });
    if (totalLabel) {
      body.push([
        "",
        totalLabel,
        ...payload.dates.map((date) => totals[date] ?? ""),
        "",
        "",
      ]);
    }
  };

  pushGroup(males, "Male | Total per day", payload.totals.male);
  pushGroup(females, "Female | Total per day", payload.totals.female);
  if (others.length) pushGroup(others, "", {});
  body.push([
    "",
    "Combined | Total per day",
    ...payload.dates.map((date) => payload.totals.all[date] ?? ""),
    "",
    "",
  ]);

  autoTable(doc, {
    startY: 30,
    head: [head],
    body,
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 0.6, halign: "center", overflow: "linebreak" },
    headStyles: { fillColor: [40, 44, 70], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 6 },
      1: { cellWidth: 42, halign: "left" },
    },
    didParseCell(data) {
      const raw = data.row.raw;
      const label = Array.isArray(raw) ? String(raw[1] ?? "") : "";
      if (data.section === "body" && /Total per day/.test(label)) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [236, 238, 245];
      }
    },
  });

  const summaryY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 160) + 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 8, summaryY);
  doc.setFont("helvetica", "normal");
  const { summary } = payload;
  const lines = [
    `Enrollment (M/F): ${summary.enrollmentMale} / ${summary.enrollmentFemale}`,
    `Late enrollment (M/F): ${summary.lateEnrollmentMale} / ${summary.lateEnrollmentFemale}`,
    `Transferred in (M/F): ${summary.transferredInMale} / ${summary.transferredInFemale}`,
    `Transferred out (M/F): ${summary.transferredOutMale} / ${summary.transferredOutFemale}`,
    `Dropped out (M/F): ${summary.dropOutMale} / ${summary.dropOutFemale}`,
    `Registered end of month (M/F): ${payload.registeredMale} / ${payload.registeredFemale}`,
  ];
  doc.text(lines.join("    "), 8, summaryY + 5);
  doc.text("I certify that this is a true and correct report of attendance.", 8, summaryY + 12);
  doc.text(`${payload.adviser || "________________"}  Adviser`, 8, summaryY + 20);
  doc.text(`${payload.schoolHead || "________________"}  School Head`, 120, summaryY + 20);

  return doc.output("blob");
}

export function downloadSf2Pdf(load: TeachingLoad, payload: Sf2Payload): void {
  downloadBlob(sf2Filename(load, payload.month), buildSf2PdfBlob(payload));
}
