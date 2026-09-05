import * as XLSX from "xlsx";

/**
 * DepEd School Form 1 (SF1) extraction engine.
 *
 * SF1 layout (LIS export, ver 2014.x): metadata labels on the top rows
 * (School ID / Name / Region / Division / District / School Year / Grade Level /
 * Section), a learner header row (LRN, NAME "Last, First, Middle", Sex, Birth
 * Date, Age, ...), learner rows split into MALE then FEMALE blocks, and a footer
 * with totals plus "Prepared by" (adviser) and "Certified Correct" (school head).
 *
 * The parser is layout-tolerant: it locates values by their labels rather than
 * fixed cell coordinates, so it survives minor version/column shifts.
 */

export interface Sf1Learner {
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string;
  sex: "M" | "F" | "";
  birthdate: string;
  age: string;
  religion: string;
  motherTongue: string;
  modality: string;
  remarks: string;
}

export interface Sf1Meta {
  schoolId: string;
  schoolName: string;
  region: string;
  division: string;
  district: string;
  schoolYear: string;
  gradeLevel: string;
  section: string;
  adviser: string;
  schoolHead: string;
}

export interface ParsedSf1 {
  meta: Sf1Meta;
  learners: Sf1Learner[];
  warnings: string[];
}

type Row = string[];

const norm = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();
const low = (v: unknown): string => norm(v).toLowerCase();

function toRows(data: ArrayBuffer | Uint8Array): Row[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const wb = XLSX.read(bytes, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: false, defval: "" });
}

/** Value that follows a label: remainder of the same cell, else next cell right. */
function grabRight(rows: Row[], re: RegExp): string {
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c]);
      if (re.test(cell)) {
        const rem = cell.replace(re, "").trim();
        if (rem) return rem;
        for (let k = c + 1; k < row.length; k++) {
          const v = norm(row[k]);
          if (v) return v;
        }
      }
    }
  }
  return "";
}

/** Whole cell that matches (for labels merged with their value, e.g. "Region V"). */
function grabWhole(rows: Row[], re: RegExp): string {
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c]);
      if (re.test(cell)) return cell;
    }
  }
  return "";
}

/** First non-empty, non-parenthetical cell below a label in the same column. */
function grabBelow(rows: Row[], re: RegExp): string {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (re.test(norm(row[c]))) {
        for (let rr = r + 1; rr < Math.min(rows.length, r + 6); rr++) {
          const v = norm((rows[rr] || [])[c]);
          if (v && !v.startsWith("(")) return v;
        }
      }
    }
  }
  return "";
}

interface HeaderMap {
  lrn: number;
  name: number;
  sex: number;
  birth?: number;
  age?: number;
  religion?: number;
  motherTongue?: number;
  modality?: number;
  remarks?: number;
}

function detectHeader(rows: Row[]): { row: number; map: HeaderMap } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const map: Partial<HeaderMap> = {};
    for (let c = 0; c < row.length; c++) {
      const t = low(row[c]);
      if (!t) continue;
      if ((t === "lrn" || t.includes("learner reference")) && map.lrn == null) map.lrn = c;
      if (t.includes("name") && t.includes("last name") && map.name == null) map.name = c;
      if ((t === "sex" || t.includes("sex") || t.includes("gender")) && map.sex == null) map.sex = c;
      if (t.includes("birth") && map.birth == null) map.birth = c;
      if (t.includes("age") && map.age == null) map.age = c;
      if (t.includes("mother tongue") && map.motherTongue == null) map.motherTongue = c;
      if (t.includes("religion") && map.religion == null) map.religion = c;
      if (t.includes("modality") && map.modality == null) map.modality = c;
      if (t.includes("remarks") && map.remarks == null) map.remarks = c;
    }
    if (map.lrn != null && map.name != null && map.sex != null) {
      return { row: r, map: map as HeaderMap };
    }
  }
  return null;
}

function parseName(raw: unknown): { last: string; first: string; middle: string } {
  const parts = String(raw ?? "")
    .split(",")
    .map((s) => s.trim());
  const last = parts[0] || "";
  const first = parts[1] || "";
  let middle = parts.slice(2).join(", ").trim();
  if (middle === "-") middle = "";
  return { last, first, middle };
}

function normalizeSex(v: unknown): "M" | "F" | "" {
  const c = norm(v).toUpperCase().charAt(0);
  return c === "M" ? "M" : c === "F" ? "F" : "";
}

export function parseSf1(data: ArrayBuffer | Uint8Array): ParsedSf1 {
  const warnings: string[] = [];
  const rows = toRows(data);

  const meta: Sf1Meta = {
    schoolId: grabRight(rows, /^school id/i),
    schoolName: grabRight(rows, /^school name/i),
    region: grabWhole(rows, /^region\b/i),
    division: grabRight(rows, /^division/i),
    district: grabRight(rows, /^district/i),
    schoolYear: grabRight(rows, /^school year/i),
    gradeLevel: grabRight(rows, /^grade level/i),
    section: grabRight(rows, /^section/i),
    adviser: grabBelow(rows, /^prepared by/i),
    schoolHead: grabBelow(rows, /^certified correct/i),
  };

  const learners: Sf1Learner[] = [];
  const header = detectHeader(rows);
  if (!header) {
    warnings.push(
      "Could not find the learner header (LRN / Name / Sex). Is this a School Form 1 export?",
    );
    return { meta, learners, warnings };
  }

  const { map } = header;
  let currentSex: "M" | "F" | "" = "";
  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r];
    const joined = row.join(" ").toUpperCase();
    if (/\bMALE\b/.test(joined) && !/\bFEMALE\b/.test(joined)) currentSex = "M";
    else if (/\bFEMALE\b/.test(joined)) currentSex = "F";

    const digits = norm(row[map.lrn]).replace(/\D/g, "");
    if (!/^\d{10,13}$/.test(digits)) continue;

    const nm = parseName(row[map.name]);
    if (!nm.last || !nm.first) continue;

    learners.push({
      lrn: digits,
      lastName: nm.last,
      firstName: nm.first,
      middleName: nm.middle,
      sex: normalizeSex(row[map.sex]) || currentSex,
      birthdate: map.birth != null ? norm(row[map.birth]) : "",
      age: map.age != null ? norm(row[map.age]) : "",
      religion: map.religion != null ? norm(row[map.religion]) : "",
      motherTongue: map.motherTongue != null ? norm(row[map.motherTongue]) : "",
      modality: map.modality != null ? norm(row[map.modality]) : "",
      remarks: map.remarks != null ? norm(row[map.remarks]) : "",
    });
  }

  if (learners.length === 0) {
    warnings.push("No learners were found. Ensure the file has LRN and Name columns.");
  }
  return { meta, learners, warnings };
}

export function fullName(l: Sf1Learner): string {
  const mid = l.middleName ? ` ${l.middleName}` : "";
  return `${l.lastName}, ${l.firstName}${mid}`.trim();
}
