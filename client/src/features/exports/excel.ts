/**
 * Client-side DepEd ECR workbook fill.
 * Port of eclassrecord `src/main/excel-exporter.js`.
 *
 * Official desktop `Templates.xlsx` is ~1.3MB. GradeBoss generates the same
 * cell map (TERM 1–3 + SUMMARY, 50 male / 50 female rows) so the PWA stays
 * small. If `/templates/ecr.xlsx` is present it is used instead (CacheFirst).
 */

import * as XLSX from "xlsx";
import type { Term } from "../../models/types";
import type {
  ExcelClassSheet,
  ExcelExportPayload,
  ExcelScalar,
  ExcelStudentRow,
  ExcelTermHps,
} from "./excel-payload";

const MALE_START = 13;
const FEMALE_START = 64;
const ROSTER_CAP = 50;
const TERM_CLEAR_COLS = [
  "B", "C", "D", "E",
  "F", "G", "H", "I", "J",
  "K", "L", "M",
  "N", "O", "P",
  "Q", "R", "S",
  "T", "U", "V",
  "W", "X", "Y",
  "Z", "AA", "AB",
];
const SUMMARY_CLEAR_COLS = ["B", "C", "D", "E", "H", "P", "V", "Z", "AC"];

export function setCellValue(sheet: XLSX.WorkSheet, cellRef: string, value: ExcelScalar | undefined | null): void {
  if (value === undefined || value === null || value === "") {
    if (sheet[cellRef]) {
      sheet[cellRef].v = "";
      sheet[cellRef].t = "s";
      delete sheet[cellRef].w;
      delete sheet[cellRef].f;
    }
    return;
  }
  if (!sheet[cellRef]) sheet[cellRef] = {};
  const cell = sheet[cellRef] as XLSX.CellObject;
  if (typeof value === "number" && Number.isFinite(value)) {
    cell.t = "n";
    cell.v = value;
    delete cell.w;
    delete cell.f;
  } else {
    cell.t = "s";
    cell.v = String(value);
    delete cell.w;
    delete cell.f;
  }
}

function cloneSheet(sheet: XLSX.WorkSheet): XLSX.WorkSheet {
  return JSON.parse(JSON.stringify(sheet)) as XLSX.WorkSheet;
}

function trimSheet(sheet: XLSX.WorkSheet): void {
  sheet["!ref"] = "A1:AE120";
}

function writeHeaderLabels(sheet: XLSX.WorkSheet, kind: "term" | "summary"): void {
  if (kind === "term") {
    setCellValue(sheet, "A1", "ELECTRONIC CLASS RECORD");
    setCellValue(sheet, "F3", "Region");
    setCellValue(sheet, "Q3", "Division");
    setCellValue(sheet, "F4", "School");
    setCellValue(sheet, "Q4", "School ID");
    setCellValue(sheet, "Y4", "School Year");
    setCellValue(sheet, "B10", "LEARNERS' NAMES");
    setCellValue(sheet, "F10", "Written Works");
    setCellValue(sheet, "N10", "Performance Tasks");
    setCellValue(sheet, "T10", "Quarterly Assessment");
    setCellValue(sheet, "Z10", "Initial Grade");
    setCellValue(sheet, "AA10", "Quarterly Grade");
    setCellValue(sheet, "AB10", "Descriptor");
    setCellValue(sheet, "A11", "HPS");
    setCellValue(sheet, "A12", "MALE");
    setCellValue(sheet, "A63", "FEMALE");
    return;
  }
  setCellValue(sheet, "A1", "ELECTRONIC CLASS RECORD — SUMMARY");
  setCellValue(sheet, "C4", "Region");
  setCellValue(sheet, "O4", "Division");
  setCellValue(sheet, "AA4", "School ID");
  setCellValue(sheet, "C5", "School");
  setCellValue(sheet, "AA5", "School Year");
  setCellValue(sheet, "H8", "Quarter 1");
  setCellValue(sheet, "P8", "Quarter 2");
  setCellValue(sheet, "V8", "Quarter 3");
  setCellValue(sheet, "Z8", "Final Grade");
  setCellValue(sheet, "AC8", "Remarks");
  setCellValue(sheet, "A12", "MALE");
  setCellValue(sheet, "A63", "FEMALE");
}

function emptySheet(kind: "term" | "summary"): XLSX.WorkSheet {
  const sheet: XLSX.WorkSheet = {};
  writeHeaderLabels(sheet, kind);
  sheet["!ref"] = "A1:AE120";
  sheet["!cols"] = Array.from({ length: 31 }, (_, index) => ({ wch: index === 1 ? 28 : 8 }));
  return sheet;
}

/** Official-layout workbook used when `/templates/ecr.xlsx` is not cached. */
export function createEcrSkeleton(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, emptySheet("term"), "TERM 1");
  XLSX.utils.book_append_sheet(workbook, emptySheet("term"), "TERM 2");
  XLSX.utils.book_append_sheet(workbook, emptySheet("term"), "TERM 3");
  XLSX.utils.book_append_sheet(workbook, emptySheet("summary"), "SUMMARY");
  return workbook;
}

function fillHps(sheet: XLSX.WorkSheet, hps: ExcelTermHps): void {
  for (let i = 0; i < 5; i += 1) {
    setCellValue(sheet, `${XLSX.utils.encode_col(5 + i)}11`, hps.wwHps[i]);
  }
  for (let i = 0; i < 3; i += 1) {
    setCellValue(sheet, `${XLSX.utils.encode_col(13 + i)}11`, hps.ptHps[i]);
  }
  setCellValue(sheet, "T11", hps.sa1Hps);
  setCellValue(sheet, "U11", hps.sa2Hps);
  setCellValue(sheet, "V11", hps.teHps);
}

function fillLearnerTermRow(sheet: XLSX.WorkSheet, row: number, student: ExcelStudentRow | undefined, term: Term, clear: boolean): void {
  if (!student) {
    if (clear) TERM_CLEAR_COLS.forEach((col) => setCellValue(sheet, `${col}${row}`, ""));
    return;
  }
  const scores = student.terms[term];
  setCellValue(sheet, `B${row}`, student.name);
  for (let i = 0; i < 5; i += 1) {
    setCellValue(sheet, `${XLSX.utils.encode_col(5 + i)}${row}`, scores.ww[i]);
  }
  setCellValue(sheet, `K${row}`, scores.wwTotal);
  setCellValue(sheet, `L${row}`, scores.wwPS);
  setCellValue(sheet, `M${row}`, scores.wwWS);
  for (let i = 0; i < 3; i += 1) {
    setCellValue(sheet, `${XLSX.utils.encode_col(13 + i)}${row}`, scores.pt[i]);
  }
  setCellValue(sheet, `Q${row}`, scores.ptTotal);
  setCellValue(sheet, `R${row}`, scores.ptPS);
  setCellValue(sheet, `S${row}`, scores.ptWS);
  setCellValue(sheet, `T${row}`, scores.sa1);
  setCellValue(sheet, `U${row}`, scores.sa2);
  setCellValue(sheet, `V${row}`, scores.te);
  setCellValue(sheet, `W${row}`, scores.saTotal);
  setCellValue(sheet, `X${row}`, scores.saPS);
  setCellValue(sheet, `Y${row}`, scores.saWS);
  setCellValue(sheet, `Z${row}`, scores.initialGrade);
  setCellValue(sheet, `AA${row}`, scores.termGrade);
  setCellValue(sheet, `AB${row}`, scores.desc);
}

function fillLearnerSummaryRow(sheet: XLSX.WorkSheet, row: number, student: ExcelStudentRow | undefined, clear: boolean): void {
  if (!student) {
    if (clear) SUMMARY_CLEAR_COLS.forEach((col) => setCellValue(sheet, `${col}${row}`, ""));
    return;
  }
  setCellValue(sheet, `B${row}`, student.name);
  setCellValue(sheet, `H${row}`, student.final.term1);
  setCellValue(sheet, `P${row}`, student.final.term2);
  setCellValue(sheet, `V${row}`, student.final.term3);
  setCellValue(sheet, `Z${row}`, student.final.finalGrade);
  setCellValue(sheet, `AC${row}`, student.final.remarks);
}

export function populateTermSheet(
  sheet: XLSX.WorkSheet,
  data: ExcelClassSheet,
  term: Term,
  subTitleSubject?: string,
): void {
  setCellValue(sheet, "G4", data.region);
  setCellValue(sheet, "R4", data.division);
  setCellValue(sheet, "G5", data.schoolName);
  setCellValue(sheet, "R5", data.schoolId);
  setCellValue(sheet, "Z5", data.schoolYear);
  setCellValue(sheet, "K7", `Grade ${data.gradeLevel} - ${data.section}`);
  setCellValue(sheet, "T7", subTitleSubject || data.subject);
  setCellValue(sheet, "T8", data.teacherName);
  fillHps(sheet, data.terms[term]);
  for (let idx = 0; idx < ROSTER_CAP; idx += 1) {
    fillLearnerTermRow(sheet, MALE_START + idx, data.males[idx], term, true);
    fillLearnerTermRow(sheet, FEMALE_START + idx, data.females[idx], term, true);
  }
  if (data.policy === "DO15_DESCRIPTIVE") {
    setCellValue(sheet, "B115", "Original basis of grade was descriptive (DO 15, s. 2026).");
  }
}

export function populateSummarySheet(sheet: XLSX.WorkSheet, data: ExcelClassSheet, subTitleSubject?: string): void {
  setCellValue(sheet, "D5", data.region);
  setCellValue(sheet, "P5", data.division);
  setCellValue(sheet, "AB5", data.schoolId);
  setCellValue(sheet, "D6", data.schoolName);
  setCellValue(sheet, "AB6", data.schoolYear);
  setCellValue(sheet, "N9", `Grade ${data.gradeLevel} - ${data.section}`);
  setCellValue(sheet, "Z9", subTitleSubject || data.subject);
  setCellValue(sheet, "Z10", data.teacherName);
  for (let idx = 0; idx < ROSTER_CAP; idx += 1) {
    fillLearnerSummaryRow(sheet, MALE_START + idx, data.males[idx], true);
    fillLearnerSummaryRow(sheet, FEMALE_START + idx, data.females[idx], true);
  }
  if (data.policy === "DO15_DESCRIPTIVE") {
    setCellValue(sheet, "B115", "Original basis of grade was descriptive (DO 15, s. 2026).");
  }
}

function overflowRows(payload: ExcelExportPayload): string[][] {
  const extraMales = payload.males.slice(ROSTER_CAP);
  const extraFemales = payload.females.slice(ROSTER_CAP);
  if (!extraMales.length && !extraFemales.length) return [];
  const rows: string[][] = [
    ["OVERFLOW — learners beyond the official 50-per-sex ECR grid"],
    ["Sex", "Name", "T1", "T2", "T3", "Final"],
  ];
  extraMales.forEach((row) => rows.push(["M", row.name, String(row.final.term1), String(row.final.term2), String(row.final.term3), String(row.final.finalGrade)]));
  extraFemales.forEach((row) => rows.push(["F", row.name, String(row.final.term1), String(row.final.term2), String(row.final.term3), String(row.final.finalGrade)]));
  return rows;
}

function consolidatedSheet(payload: ExcelExportPayload): XLSX.WorkSheet {
  const rows: Array<Array<ExcelScalar>> = [
    ["MAPEH Consolidated Grades Summary"],
    [],
    [`School Name: ${payload.schoolName || ""}`, `School ID: ${payload.schoolId || ""}`, `School Year: ${payload.schoolYear || ""}`],
    [`Grade & Section: Grade ${payload.gradeLevel} - ${payload.section}`, `Subject: ${payload.subject}`, `Teacher: ${payload.teacherName || ""}`],
    [],
    [
      "No.", "Learners Name", "Sex",
      "T1 Music & Arts", "T1 PE & Health", "T1 Consolidated",
      "T2 Music & Arts", "T2 PE & Health", "T2 Consolidated",
      "T3 Music & Arts", "T3 PE & Health", "T3 Consolidated",
      "Music & Arts Final", "PE & Health Final", "MAPEH Final Grade", "Remarks/Descriptor",
    ],
  ];
  payload.consolidated?.males.forEach((student, idx) => {
    rows.push([
      idx + 1, student.name, "M",
      student.t1Music, student.t1PE, student.t1Cons,
      student.t2Music, student.t2PE, student.t2Cons,
      student.t3Music, student.t3PE, student.t3Cons,
      student.musicFinal, student.peFinal, student.finalConsolidated, student.remarks,
    ]);
  });
  rows.push([]);
  payload.consolidated?.females.forEach((student, idx) => {
    rows.push([
      idx + 1, student.name, "F",
      student.t1Music, student.t1PE, student.t1Cons,
      student.t2Music, student.t2PE, student.t2Cons,
      student.t3Music, student.t3PE, student.t3Cons,
      student.musicFinal, student.peFinal, student.finalConsolidated, student.remarks,
    ]);
  });
  if (payload.policy === "DO15_DESCRIPTIVE") {
    rows.push([]);
    rows.push(["", "Original basis of grade was descriptive (DO 15, s. 2026)."]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 5 }, { wch: 30 }, { wch: 5 },
    { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
  ];
  return sheet;
}

export function fillExcelWorkbook(payload: ExcelExportPayload, template = createEcrSkeleton()): XLSX.WorkBook {
  Object.values(template.Sheets).forEach((sheet) => {
    if (sheet) trimSheet(sheet);
  });

  if (!payload.isMapeh) {
    populateTermSheet(template.Sheets["TERM 1"], payload, "1");
    populateTermSheet(template.Sheets["TERM 2"], payload, "2");
    populateTermSheet(template.Sheets["TERM 3"], payload, "3");
    populateSummarySheet(template.Sheets["SUMMARY"], payload);
  } else {
    const music = payload.music_arts || payload;
    const pe = payload.pe_health || payload;
    const ma1 = cloneSheet(template.Sheets["TERM 1"]);
    const ma2 = cloneSheet(template.Sheets["TERM 2"]);
    const ma3 = cloneSheet(template.Sheets["TERM 3"]);
    const maSum = cloneSheet(template.Sheets["SUMMARY"]);
    const pe1 = cloneSheet(template.Sheets["TERM 1"]);
    const pe2 = cloneSheet(template.Sheets["TERM 2"]);
    const pe3 = cloneSheet(template.Sheets["TERM 3"]);
    const peSum = cloneSheet(template.Sheets["SUMMARY"]);
    const subtitleMa = `${payload.subject} - Music & Arts`;
    const subtitlePe = `${payload.subject} - PE & Health`;
    populateTermSheet(ma1, music, "1", subtitleMa);
    populateTermSheet(ma2, music, "2", subtitleMa);
    populateTermSheet(ma3, music, "3", subtitleMa);
    populateSummarySheet(maSum, music, subtitleMa);
    populateTermSheet(pe1, pe, "1", subtitlePe);
    populateTermSheet(pe2, pe, "2", subtitlePe);
    populateTermSheet(pe3, pe, "3", subtitlePe);
    populateSummarySheet(peSum, pe, subtitlePe);
    template.Sheets = {
      "M&A - TERM 1": ma1,
      "M&A - TERM 2": ma2,
      "M&A - TERM 3": ma3,
      "M&A - SUMMARY": maSum,
      "PEH - TERM 1": pe1,
      "PEH - TERM 2": pe2,
      "PEH - TERM 3": pe3,
      "PEH - SUMMARY": peSum,
      "MAPEH CONSOLIDATION": consolidatedSheet(payload),
    };
    template.SheetNames = [
      "M&A - TERM 1", "M&A - TERM 2", "M&A - TERM 3", "M&A - SUMMARY",
      "PEH - TERM 1", "PEH - TERM 2", "PEH - TERM 3", "PEH - SUMMARY",
      "MAPEH CONSOLIDATION",
    ];
  }

  const overflow = overflowRows(payload);
  if (overflow.length) {
    const sheet = XLSX.utils.aoa_to_sheet(overflow);
    template.Sheets.OVERFLOW = sheet;
    template.SheetNames.push("OVERFLOW");
  }
  return template;
}

export async function loadEcrTemplate(): Promise<XLSX.WorkBook> {
  try {
    const response = await fetch("/templates/ecr.xlsx");
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      Object.values(workbook.Sheets).forEach((sheet) => {
        if (sheet) trimSheet(sheet);
      });
      return workbook;
    }
  } catch {
    /* Missing template or offline first-run — use the generated skeleton. */
  }
  return createEcrSkeleton();
}

export function workbookToBlob(workbook: XLSX.WorkBook): Blob {
  const binary = XLSX.write(workbook, { bookType: "xlsx", type: "binary" }) as string;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return new Blob([bytes.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
