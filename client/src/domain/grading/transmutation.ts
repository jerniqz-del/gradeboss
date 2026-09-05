import type { GradingPolicy } from "../../models/types";
import type { GradingOptions, PolicyInput, TermGrade } from "./types";
import { determinePolicy, isKeyStage2Load, isZeroBasedSchoolYear } from "../policy";

/**
 * DO 015, s. 2026 Transition — 41-step adjusted table (SY 2026–2027).
 * Source: eclassrecord `src/renderer/js/grading.js` `adjusted2026`.
 * Rows are [min, max, transmutedGrade]; lookup uses rounded IG >= min.
 */
export const DO15_TRANSITION: ReadonlyArray<readonly [number, number, number]> = [
  [99.5, 100.0, 100],
  [98.32, 99.49, 99],
  [97.14, 98.31, 98],
  [95.96, 97.13, 97],
  [94.78, 95.95, 96],
  [93.6, 94.77, 95],
  [92.42, 93.59, 94],
  [91.24, 92.41, 93],
  [90.06, 91.23, 92],
  [88.88, 90.05, 91],
  [87.7, 88.87, 90],
  [86.52, 87.69, 89],
  [85.34, 86.51, 88],
  [84.16, 85.33, 87],
  [82.98, 84.15, 86],
  [81.8, 82.97, 85],
  [80.62, 81.79, 84],
  [79.44, 80.61, 83],
  [78.26, 79.43, 82],
  [77.08, 78.25, 81],
  [75.9, 77.07, 80],
  [74.72, 75.89, 79],
  [73.54, 74.71, 78],
  [72.36, 73.53, 77],
  [71.18, 72.35, 76],
  [70.0, 71.17, 75],
  [65.34, 69.99, 74],
  [60.67, 65.33, 73],
  [56.01, 60.66, 72],
  [51.34, 56.0, 71],
  [46.67, 51.33, 70],
  [42.01, 46.66, 69],
  [37.34, 42.0, 68],
  [32.68, 37.33, 67],
  [28.01, 32.67, 66],
  [23.35, 28.0, 65],
  [18.68, 23.34, 64],
  [14.01, 18.67, 63],
  [9.35, 14.0, 62],
  [4.68, 9.34, 61],
  [0.0, 4.67, 60],
];

/**
 * Key Stage 2 trimester table (Grades 4–6).
 * Source: eclassrecord `keyStage2Transmutation` — [min, transmutedGrade].
 */
export const KEY_STAGE_2_TRIMESTER: ReadonlyArray<readonly [number, number]> = [
  [99.5, 100],
  [98.32, 99],
  [97.14, 98],
  [95.96, 97],
  [94.78, 96],
  [93.6, 95],
  [92.42, 94],
  [91.24, 93],
  [90.06, 92],
  [88.88, 91],
  [87.7, 90],
  [86.52, 89],
  [85.34, 88],
  [84.16, 87],
  [82.98, 86],
  [81.8, 85],
  [80.62, 84],
  [79.44, 83],
  [78.26, 82],
  [77.08, 81],
  [75.9, 80],
  [74.72, 79],
  [73.54, 78],
  [72.36, 77],
  [71.18, 76],
  [70.0, 75],
  [65.34, 74],
  [60.67, 73],
  [56.01, 72],
  [51.34, 71],
  [46.67, 70],
  [42.01, 69],
  [37.34, 68],
  [32.68, 67],
  [28.01, 66],
  [23.35, 65],
  [18.68, 64],
  [14.01, 63],
  [9.35, 62],
  [4.68, 61],
  [0.0, 60],
];

/**
 * DepEd Order No. 8, s. 2015 Annex — legacy 41-step table.
 * Current eclassrecord `grading.js` no longer selects this automatically;
 * kept so older class records can still be transmuted explicitly.
 * Rows are [min, max, transmutedGrade].
 */
export const DO8_2015: ReadonlyArray<readonly [number, number, number]> = [
  [100.0, 100.0, 100],
  [98.4, 99.99, 99],
  [96.8, 98.39, 98],
  [95.2, 96.79, 97],
  [93.6, 95.19, 96],
  [92.0, 93.59, 95],
  [90.4, 91.99, 94],
  [88.8, 90.39, 93],
  [87.2, 88.79, 92],
  [85.6, 87.19, 91],
  [84.0, 85.59, 90],
  [82.4, 83.99, 89],
  [80.8, 82.39, 88],
  [79.2, 80.79, 87],
  [77.6, 79.19, 86],
  [76.0, 77.59, 85],
  [74.4, 75.99, 84],
  [72.8, 74.39, 83],
  [71.2, 72.79, 82],
  [69.6, 71.19, 81],
  [68.0, 69.59, 80],
  [66.4, 67.99, 79],
  [64.8, 66.39, 78],
  [63.2, 64.79, 77],
  [61.6, 63.19, 76],
  [60.0, 61.59, 75],
  [56.0, 59.99, 74],
  [52.0, 55.99, 73],
  [48.0, 51.99, 72],
  [44.0, 47.99, 71],
  [40.0, 43.99, 70],
  [36.0, 39.99, 69],
  [32.0, 35.99, 68],
  [28.0, 31.99, 67],
  [24.0, 27.99, 66],
  [20.0, 23.99, 65],
  [16.0, 19.99, 64],
  [12.0, 15.99, 63],
  [8.0, 11.99, 62],
  [4.0, 7.99, 61],
  [0.0, 3.99, 60],
];

/** Round IG to 2 decimal places the same way as desktop `roundInitialGradeForTable`. */
export function roundInitialGradeForTable(ig: number): number {
  const numeric = Number(ig);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

/** Grades 1–3 descriptive letters (desktop `transmuteDescriptive`). */
export function transmuteDescriptive(ig: number): "A" | "B" | "C" | "D" | "E" {
  if (ig >= 90) return "A";
  if (ig >= 80) return "B";
  if (ig >= 75) return "C";
  if (ig >= 65) return "D";
  return "E";
}

function lookupMinTable(roundedIg: number, table: ReadonlyArray<readonly [number, ...number[]]>, gradeIndex: number): number {
  for (const row of table) {
    if (roundedIg >= row[0]) return row[gradeIndex] as number;
  }
  return 60;
}

/**
 * Transmute an initial grade with an explicit policy (no school-year re-resolve).
 * Phase 3 score-grid cells that already know the policy can call this directly.
 */
export function transmute(ig: number, policy: GradingPolicy): TermGrade {
  if (policy === "DO15_DESCRIPTIVE") return transmuteDescriptive(ig);
  if (policy === "DO15_ZERO") return Math.round(ig);
  const roundedIg = roundInitialGradeForTable(ig);
  if (policy === "KEY_STAGE_2_TRIMESTER") {
    return lookupMinTable(roundedIg, KEY_STAGE_2_TRIMESTER, 1);
  }
  if (policy === "DO8_2015") {
    return lookupMinTable(roundedIg, DO8_2015, 2);
  }
  return lookupMinTable(roundedIg, DO15_TRANSITION, 2);
}

/**
 * Desktop-faithful transmutation: re-resolves policy from grade + school year
 * so a stale stored policy cannot produce the wrong TG
 * (`grading.js` `transmute`).
 */
export function transmuteForLoad(load: PolicyInput, ig: number, options?: GradingOptions): TermGrade {
  const schoolYear = load.schoolYear || "";
  const policy = determinePolicy(load.gradeLevel, load.subject, schoolYear);
  const zeroBased = isZeroBasedSchoolYear(schoolYear) || policy === "DO15_ZERO";

  if (isKeyStage2Load(load, options)) {
    return zeroBased ? Math.round(ig) : transmute(ig, "KEY_STAGE_2_TRIMESTER");
  }
  if (policy === "DO15_DESCRIPTIVE") return transmuteDescriptive(ig);
  if (zeroBased) return Math.round(ig);
  if (load.policy === "DO8_2015") return transmute(ig, "DO8_2015");
  return transmute(ig, "DO15_TRANSITION");
}

export function descriptor(grade: TermGrade | null | undefined | ""): string {
  if (grade === null || grade === undefined || grade === "") return "";
  const g = String(grade).toUpperCase();
  if (g === "T/O" || g === "TRANSFERRED OUT") return "Transferred Out";
  if (g === "A") return "Advancing (Namumukod-tangi)";
  if (g === "B") return "Benchmarking (Napamamalas)";
  if (g === "C") return "Connecting (Natutungo)";
  if (g === "D") return "Developing (Napauunlad)";
  if (g === "E") return "Emerging (Nagsisimula)";

  const num = parseFloat(String(grade));
  if (Number.isNaN(num)) return String(grade);
  if (num >= 90) return "Advancing (Namumukod-tangi)";
  if (num >= 80) return "Benchmarking (Napamamalas)";
  if (num >= 75) return "Connecting (Natutungo)";
  if (num >= 65) return "Developing (Napauunlad)";
  return "Emerging (Nagsisimula)";
}

export function termDescription(grade: TermGrade | null | undefined): string {
  if (grade === null || grade === undefined) return "";
  return descriptor(grade);
}

/** Numeric ≥ 75 pass; descriptive A/B/C pass (desktop `isPassing`). */
export function isPassing(grade: TermGrade | null | undefined | ""): boolean {
  if (grade === null || grade === undefined || grade === "") return false;
  const g = String(grade).toUpperCase();
  if (["A", "B", "C"].includes(g)) return true;
  if (["D", "E"].includes(g)) return false;
  const num = parseFloat(String(grade));
  return !Number.isNaN(num) && num >= 75;
}

export function formatGradeForDisplay(
  grade: TermGrade | null | undefined | "",
  policy: GradingPolicy,
  showNumericalEquivalents = false,
): string {
  if (grade === null || grade === undefined || grade === "") return "";
  if (policy === "DO15_DESCRIPTIVE" && showNumericalEquivalents) {
    const g = String(grade).toUpperCase();
    const rangeMap: Record<string, string> = {
      A: "90-100",
      B: "80-89",
      C: "75-79",
      D: "65-74",
      E: "0-64",
    };
    if (rangeMap[g]) return `${g} (${rangeMap[g]})`;
  }
  return String(grade);
}
