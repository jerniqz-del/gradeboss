import { jsPDF } from "jspdf";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";

export function lastTableY(doc: jsPDF, fallback = 30): number {
  return ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || fallback);
}

export function addDepEdHeader(
  doc: jsPDF,
  title: string,
  meta: string[],
  y = 10,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Republic of the Philippines", pageWidth / 2, y, { align: "center" });
  doc.text("Department of Education", pageWidth / 2, y + 4, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, pageWidth / 2, y + 10, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const line = meta.filter(Boolean).join("   ");
  if (line) doc.text(line, 8, y + 16);
  return y + 20;
}

export function schoolMeta(load: TeachingLoad, profile?: TeacherProfile | null): string[] {
  return [
    `School: ${profile?.schoolName || load.sf1Meta?.schoolName || "—"}`,
    `School ID: ${profile?.schoolId || load.sf1Meta?.schoolId || "—"}`,
    `School Year: ${load.schoolYear || profile?.schoolYear || "—"}`,
    `Grade/Section: G${load.gradeLevel} ${load.section}`,
    `Subject: ${load.subject}`,
    profile?.teacherName ? `Teacher: ${profile.teacherName}` : "",
  ];
}

export async function pdfHeaderBytes(blob: Blob): Promise<string> {
  const header = new Uint8Array(await blob.arrayBuffer()).slice(0, 4);
  return String.fromCharCode(...header);
}
