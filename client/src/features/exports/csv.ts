import { computeClassYearResults, computeTermResult, formatInitialGrade } from "../../domain/grading";
import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { sortDepEdRoster } from "../roster/sort";

export function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`;
}

export function termAssessments(load: TeachingLoad, term: Term, mapePart?: MapePart) {
  return load.assessments.filter((item) => {
    if (item.term !== term) return false;
    if (mapePart) return item.mapePart === mapePart;
    return !item.mapePart;
  });
}

/** Term score grid as CSV — HPS row, then DepEd-ordered learners with PS/IG/TG. */
export function buildTermGridCsv(load: TeachingLoad, term: Term, mapePart?: MapePart): string {
  const columns = termAssessments(load, term, mapePart);
  const header = [
    "#",
    "LRN",
    "Name",
    "Sex",
    ...columns.map((col) => col.title),
    "WW PS",
    "PT PS",
    "Exam PS",
    "IG",
    "TG",
  ];
  const hps = [
    "",
    "",
    "HPS",
    "",
    ...columns.map((col) => col.maxScore || ""),
    "",
    "",
    "",
    "",
    "",
  ];
  const learners = sortDepEdRoster(load.learners);
  const body = learners.map((learner, index) => {
    const result = computeTermResult(load, learner.id, term, mapePart);
    return [
      index + 1,
      learner.lrn,
      learnerDisplayName(learner),
      learner.sex,
      ...columns.map((col) => {
        const value = load.scores[scoreKey(learner.id, col.id)];
        return value === undefined || value === "" ? "" : value;
      }),
      result.hasData ? formatInitialGrade(result.ww.ps) : "",
      result.hasData ? formatInitialGrade(result.pt.ps) : "",
      result.hasData ? formatInitialGrade(result.examPS) : "",
      result.hasData ? formatInitialGrade(result.initialGrade) : "",
      result.termGrade === null ? "" : String(result.termGrade),
    ];
  });
  return toCsv([header, hps, ...body]);
}

/** Summary CSV: term finals, annual, pass/fail. */
export function buildSummaryCsv(load: TeachingLoad): string {
  const header = ["#", "LRN", "Name", "Sex", "Term 1", "Term 2", "Term 3", "Final", "Status", "Descriptor"];
  const byId = new Map(computeClassYearResults(load).map((row) => [row.learnerId, row]));
  const body = sortDepEdRoster(load.learners).map((learner, index) => {
    const year = byId.get(learner.id);
    const status = year?.passed === null ? "" : year?.passed ? "Passed" : "Failed";
    return [
      index + 1,
      learner.lrn,
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
  return toCsv([header, ...body]);
}

export function csvFilename(load: TeachingLoad, suffix: string): string {
  const safe = `${load.gradeLevel}-${load.section}-${load.subject}`
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `gradeboss-${safe}-${suffix}.csv`;
}
