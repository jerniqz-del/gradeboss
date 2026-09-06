/**
 * DepEd Electronic Class Record Excel payload.
 * Port of eclassrecord `import-export.js` `buildExcelExportPayload` /
 * `compileStudentExcelData` / `compileTermHps`.
 */

import {
  computeTermResult,
  consolidateMapehGrades,
  descriptor,
  formatGradeForDisplay,
  isKeyStage2Load,
  isMapehSubject,
  isPassing,
  transmuteForLoad,
  weightsForLoad,
} from "../../domain/grading";
import type { TermGrade } from "../../domain/grading";
import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";
import type { GradingPolicy, MapePart, Term } from "../../models/types";
import { termAssessments } from "./csv";

export type ExcelScalar = number | string | "";

export interface ExcelTermScores {
  ww: ExcelScalar[];
  wwTotal: ExcelScalar;
  wwPS: ExcelScalar;
  wwWS: ExcelScalar;
  pt: ExcelScalar[];
  ptTotal: ExcelScalar;
  ptPS: ExcelScalar;
  ptWS: ExcelScalar;
  sa1: ExcelScalar;
  sa2: ExcelScalar;
  te: ExcelScalar;
  saTotal: ExcelScalar;
  saPS: ExcelScalar;
  saWS: ExcelScalar;
  initialGrade: ExcelScalar;
  termGrade: ExcelScalar;
  desc: string;
}

export interface ExcelStudentRow {
  name: string;
  terms: Record<Term, ExcelTermScores>;
  final: {
    term1: ExcelScalar;
    term2: ExcelScalar;
    term3: ExcelScalar;
    finalGrade: ExcelScalar;
    remarks: string;
  };
}

export interface ExcelTermHps {
  wwHps: ExcelScalar[];
  ptHps: ExcelScalar[];
  sa1Hps: ExcelScalar;
  sa2Hps: ExcelScalar;
  teHps: ExcelScalar;
}

export interface ExcelConsolidatedRow {
  name: string;
  t1Music: ExcelScalar;
  t1PE: ExcelScalar;
  t1Cons: ExcelScalar;
  t2Music: ExcelScalar;
  t2PE: ExcelScalar;
  t2Cons: ExcelScalar;
  t3Music: ExcelScalar;
  t3PE: ExcelScalar;
  t3Cons: ExcelScalar;
  musicFinal: ExcelScalar;
  peFinal: ExcelScalar;
  finalConsolidated: ExcelScalar;
  remarks: string;
}

export interface ExcelClassSheet {
  schoolName: string;
  schoolId: string;
  region: string;
  division: string;
  schoolYear: string;
  gradeLevel: string;
  section: string;
  subject: string;
  teacherName: string;
  isMapeh: boolean;
  policy: GradingPolicy;
  males: ExcelStudentRow[];
  females: ExcelStudentRow[];
  terms: Record<Term, ExcelTermHps>;
}

export interface ExcelExportPayload extends ExcelClassSheet {
  music_arts?: ExcelClassSheet;
  pe_health?: ExcelClassSheet;
  consolidated?: {
    males: ExcelConsolidatedRow[];
    females: ExcelConsolidatedRow[];
  };
}

const TERMS: Term[] = ["1", "2", "3"];
const EMPTY_TERM: ExcelTermScores = {
  ww: [],
  wwTotal: "",
  wwPS: "",
  wwWS: "",
  pt: [],
  ptTotal: "",
  ptPS: "",
  ptWS: "",
  sa1: "",
  sa2: "",
  te: "",
  saTotal: "",
  saPS: "",
  saWS: "",
  initialGrade: "",
  termGrade: "",
  desc: "",
};

function numericScore(value: number | "" | undefined): ExcelScalar {
  if (value === undefined || value === "") return "";
  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? "" : parsed;
}

function hpsValue(maxScore: number | undefined): ExcelScalar {
  if (maxScore === undefined || maxScore === null) return "";
  const parsed = Number(maxScore);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "";
}

function displayGrade(grade: TermGrade | ExcelScalar | null | undefined, policy: GradingPolicy): ExcelScalar {
  if (grade === null || grade === undefined || grade === "") return "";
  return formatGradeForDisplay(grade as TermGrade, policy);
}

/** Desktop `plainFinalRemark`. */
export function plainFinalRemark(load: TeachingLoad, grade: TermGrade | ExcelScalar | null | undefined): string {
  if (grade === null || grade === undefined || grade === "") return "";
  const desc = descriptor(grade as TermGrade);
  if (isKeyStage2Load(load)) return desc;
  return isPassing(grade as TermGrade) ? `Passed - ${desc}` : `For Intervention - ${desc}`;
}

export function compileTermHps(load: TeachingLoad, term: Term, mapePart?: MapePart): ExcelTermHps {
  const items = termAssessments(load, term, mapePart);
  const ww = items.filter((item) => item.component === "WW");
  const pt = items.filter((item) => item.component === "PT");
  const sa1 = items.find((item) => item.component === "ST1");
  const sa2 = items.find((item) => item.component === "ST2");
  const te = items.find((item) => item.component === "TE");
  return {
    wwHps: ww.map((item) => hpsValue(item.maxScore)),
    ptHps: pt.map((item) => hpsValue(item.maxScore)),
    sa1Hps: sa1 ? hpsValue(sa1.maxScore) : "",
    sa2Hps: sa2 ? hpsValue(sa2.maxScore) : "",
    teHps: te ? hpsValue(te.maxScore) : "",
  };
}

export function compileStudentExcelData(
  load: TeachingLoad,
  learnerId: string,
  mapePart?: MapePart,
): ExcelStudentRow {
  const learner = load.learners.find((item) => item.id === learnerId);
  if (!learner) {
    return { name: "", terms: { "1": EMPTY_TERM, "2": EMPTY_TERM, "3": EMPTY_TERM }, final: { term1: "", term2: "", term3: "", finalGrade: "", remarks: "" } };
  }

  const weights = weightsForLoad(load);
  const isDescriptive = load.policy === "DO15_DESCRIPTIVE";
  const transferredOutTerm = learner.transferredOutTerm ? parseInt(learner.transferredOutTerm, 10) : 0;
  const terms = { "1": EMPTY_TERM, "2": EMPTY_TERM, "3": EMPTY_TERM } as Record<Term, ExcelTermScores>;
  let term1: TermGrade | "T/O" | null = null;
  let term2: TermGrade | "T/O" | null = null;
  let term3: TermGrade | "T/O" | null = null;
  let sum = 0;
  let termCount = 0;
  let sumIg = 0;
  let countIg = 0;

  for (const term of TERMS) {
    const termNum = parseInt(term, 10);
    if (transferredOutTerm && termNum > transferredOutTerm) {
      terms[term] = {
        ...EMPTY_TERM,
        initialGrade: "T/O",
        termGrade: "T/O",
        desc: "Transferred Out",
      };
      if (term === "1") term1 = "T/O";
      if (term === "2") term2 = "T/O";
      if (term === "3") term3 = "T/O";
      continue;
    }

    const result = computeTermResult(load, learner.id, term, mapePart);
    const items = termAssessments(load, term, mapePart);
    const ww = items.filter((item) => item.component === "WW");
    const pt = items.filter((item) => item.component === "PT");
    const sa1 = items.find((item) => item.component === "ST1");
    const sa2 = items.find((item) => item.component === "ST2");
    const te = items.find((item) => item.component === "TE");

    terms[term] = {
      ww: ww.map((item) => numericScore(load.scores[scoreKey(learner.id, item.id)])),
      wwTotal: result.ww.hasData ? result.ww.raw : "",
      wwPS: result.ww.hasData ? result.ww.ps : "",
      wwWS: result.ww.hasData ? (result.ww.ps * weights[0]) / 100 : "",
      pt: pt.map((item) => numericScore(load.scores[scoreKey(learner.id, item.id)])),
      ptTotal: result.pt.hasData ? result.pt.raw : "",
      ptPS: result.pt.hasData ? result.pt.ps : "",
      ptWS: result.pt.hasData ? (result.pt.ps * weights[1]) / 100 : "",
      sa1: sa1 ? numericScore(load.scores[scoreKey(learner.id, sa1.id)]) : "",
      sa2: sa2 ? numericScore(load.scores[scoreKey(learner.id, sa2.id)]) : "",
      te: te ? numericScore(load.scores[scoreKey(learner.id, te.id)]) : "",
      saTotal: result.hasData ? result.st1.raw + result.st2.raw + result.te.raw : "",
      saPS: result.hasData ? result.examPS : "",
      saWS: result.hasData ? (result.examPS * weights[2]) / 100 : "",
      initialGrade: result.hasData ? result.initialGrade : "",
      termGrade: result.termGrade !== null ? displayGrade(result.termGrade, load.policy) : "",
      desc: result.termGrade !== null ? descriptor(result.termGrade) : "",
    };

    if (result.termGrade !== null) {
      if (isDescriptive) {
        sumIg += result.initialGrade;
        countIg += 1;
      } else if (typeof result.termGrade === "number") {
        sum += result.termGrade;
        termCount += 1;
      }
      if (term === "1") term1 = result.termGrade;
      if (term === "2") term2 = result.termGrade;
      if (term === "3") term3 = result.termGrade;
    }
  }

  let finalGrade: TermGrade | "T/O" | "" = "";
  if (transferredOutTerm) {
    finalGrade = "T/O";
  } else if (isDescriptive) {
    finalGrade = countIg > 0 ? transmuteForLoad(load, sumIg / countIg) : "";
  } else if (termCount > 0) {
    finalGrade = Math.round(sum / termCount);
  }

  return {
    name: learnerDisplayName(learner),
    terms,
    final: {
      term1: term1 !== null ? displayGrade(term1, load.policy) : "",
      term2: term2 !== null ? displayGrade(term2, load.policy) : "",
      term3: term3 !== null ? displayGrade(term3, load.policy) : "",
      finalGrade: finalGrade !== "" ? displayGrade(finalGrade, load.policy) : "",
      remarks: transferredOutTerm
        ? "Transferred Out"
        : finalGrade !== ""
          ? plainFinalRemark(load, finalGrade)
          : "",
    },
  };
}

function compileStudentConsolidatedExcelData(load: TeachingLoad, learnerId: string): ExcelConsolidatedRow {
  const learner = load.learners.find((item) => item.id === learnerId);
  const name = learner ? learnerDisplayName(learner) : "";
  const isDescriptive = load.policy === "DO15_DESCRIPTIVE";
  const transferredOutTerm = learner?.transferredOutTerm ? parseInt(learner.transferredOutTerm, 10) : 0;

  const termCells = TERMS.map((term) => {
    const termNum = parseInt(term, 10);
    if (transferredOutTerm && termNum > transferredOutTerm) {
      return { music: "T/O" as const, pe: "T/O" as const, cons: "T/O" as ExcelScalar };
    }
    const music = computeTermResult(load, learnerId, term, "music_arts");
    const pe = computeTermResult(load, learnerId, term, "pe_health");
    let cons: ExcelScalar = "";
    if (isDescriptive) {
      let sumIg = 0;
      let countIg = 0;
      if (music.hasData) {
        sumIg += music.initialGrade;
        countIg += 1;
      }
      if (pe.hasData) {
        sumIg += pe.initialGrade;
        countIg += 1;
      }
      if (countIg > 0) cons = displayGrade(transmuteForLoad(load, sumIg / countIg), load.policy);
    } else {
      const merged = consolidateMapehGrades(music.termGrade, pe.termGrade);
      cons = merged === "" ? "" : displayGrade(merged, load.policy);
    }
    return {
      music: music.termGrade !== null ? displayGrade(music.termGrade, load.policy) : "",
      pe: pe.termGrade !== null ? displayGrade(pe.termGrade, load.policy) : "",
      cons,
    };
  });

  let musicFinal: ExcelScalar = "";
  let peFinal: ExcelScalar = "";
  let finalConsolidated: ExcelScalar = "";
  let remarks = "";

  if (transferredOutTerm) {
    musicFinal = "T/O";
    peFinal = "T/O";
    finalConsolidated = "T/O";
    remarks = "Transferred Out";
  } else {
    let sumMusic = 0;
    let countMusic = 0;
    let sumPE = 0;
    let countPE = 0;
    let sumMusicIg = 0;
    let countMusicIg = 0;
    let sumPEIg = 0;
    let countPEIg = 0;
    for (const term of TERMS) {
      const music = computeTermResult(load, learnerId, term, "music_arts");
      const pe = computeTermResult(load, learnerId, term, "pe_health");
      if (isDescriptive) {
        if (music.hasData) {
          sumMusicIg += music.initialGrade;
          countMusicIg += 1;
        }
        if (pe.hasData) {
          sumPEIg += pe.initialGrade;
          countPEIg += 1;
        }
      } else {
        if (typeof music.termGrade === "number") {
          sumMusic += music.termGrade;
          countMusic += 1;
        }
        if (typeof pe.termGrade === "number") {
          sumPE += pe.termGrade;
          countPE += 1;
        }
      }
    }
    if (isDescriptive) {
      if (countMusicIg > 0) musicFinal = displayGrade(transmuteForLoad(load, sumMusicIg / countMusicIg), load.policy);
      if (countPEIg > 0) peFinal = displayGrade(transmuteForLoad(load, sumPEIg / countPEIg), load.policy);
      let sumFinalIg = 0;
      let countFinalIg = 0;
      if (countMusicIg > 0) {
        sumFinalIg += sumMusicIg / countMusicIg;
        countFinalIg += 1;
      }
      if (countPEIg > 0) {
        sumFinalIg += sumPEIg / countPEIg;
        countFinalIg += 1;
      }
      if (countFinalIg > 0) finalConsolidated = displayGrade(transmuteForLoad(load, sumFinalIg / countFinalIg), load.policy);
    } else {
      if (countMusic > 0) musicFinal = Math.round(sumMusic / countMusic);
      if (countPE > 0) peFinal = Math.round(sumPE / countPE);
      const merged = consolidateMapehGrades(
        typeof musicFinal === "number" ? musicFinal : "",
        typeof peFinal === "number" ? peFinal : "",
      );
      finalConsolidated = merged === "" ? "" : displayGrade(merged, load.policy);
    }
    if (finalConsolidated !== "") remarks = plainFinalRemark(load, finalConsolidated);
  }

  return {
    name,
    t1Music: termCells[0].music,
    t1PE: termCells[0].pe,
    t1Cons: termCells[0].cons,
    t2Music: termCells[1].music,
    t2PE: termCells[1].pe,
    t2Cons: termCells[1].cons,
    t3Music: termCells[2].music,
    t3PE: termCells[2].pe,
    t3Cons: termCells[2].cons,
    musicFinal,
    peFinal,
    finalConsolidated,
    remarks,
  };
}

function classSheet(load: TeachingLoad, profile: TeacherProfile, mapePart?: MapePart): ExcelClassSheet {
  const males = load.learners.filter((item) => item.sex === "M");
  const females = load.learners.filter((item) => item.sex === "F");
  return {
    schoolName: profile.schoolName || "",
    schoolId: profile.schoolId || "",
    region: profile.region || "",
    division: profile.division || "",
    schoolYear: load.schoolYear || profile.schoolYear || "",
    gradeLevel: load.gradeLevel,
    section: load.section,
    subject: load.subject,
    teacherName: profile.teacherName || "",
    isMapeh: isMapehSubject(load.subject),
    policy: load.policy,
    males: males.map((learner) => compileStudentExcelData(load, learner.id, mapePart)),
    females: females.map((learner) => compileStudentExcelData(load, learner.id, mapePart)),
    terms: {
      "1": compileTermHps(load, "1", mapePart),
      "2": compileTermHps(load, "2", mapePart),
      "3": compileTermHps(load, "3", mapePart),
    },
  };
}

/** Compile the SheetJS payload used by `excel-exporter.js`. */
export function buildExcelExportPayload(load: TeachingLoad, profile: TeacherProfile): ExcelExportPayload {
  const base = classSheet(load, profile);
  if (!base.isMapeh) return base;
  return {
    ...base,
    music_arts: classSheet(load, profile, "music_arts"),
    pe_health: classSheet(load, profile, "pe_health"),
    consolidated: {
      males: load.learners.filter((item) => item.sex === "M").map((learner) => compileStudentConsolidatedExcelData(load, learner.id)),
      females: load.learners.filter((item) => item.sex === "F").map((learner) => compileStudentConsolidatedExcelData(load, learner.id)),
    },
  };
}
