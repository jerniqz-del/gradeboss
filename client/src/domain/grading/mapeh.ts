import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import type { GradingOptions, MapehTermResult, TermGrade } from "./types";
import { computeTermResult } from "./term-result";

/**
 * MAPEH consolidated grade = rounded average of the two part term grades.
 * Port of eclassrecord `consolidateMapehGrades`.
 */
export function consolidateMapehGrades(
  musicArts: TermGrade | null | undefined | "",
  peHealth: TermGrade | null | undefined | "",
): TermGrade | "" {
  if (musicArts === "T/O" || peHealth === "T/O") return "T/O";
  if (
    musicArts === null ||
    musicArts === undefined ||
    musicArts === "" ||
    peHealth === null ||
    peHealth === undefined ||
    peHealth === ""
  ) {
    const valid: Array<TermGrade> = [];
    for (const value of [musicArts, peHealth]) {
      if (value === null || value === undefined || value === "") continue;
      valid.push(value);
    }
    if (valid.length === 0) return "";
    const num = parseFloat(String(valid[0]));
    return Number.isNaN(num) ? "" : Math.round(num);
  }
  const valM = parseFloat(String(musicArts));
  const valP = parseFloat(String(peHealth));
  if (Number.isNaN(valM) && Number.isNaN(valP)) return "";
  if (Number.isNaN(valM)) return Math.round(valP);
  if (Number.isNaN(valP)) return Math.round(valM);
  return Math.round((valM + valP) / 2);
}

export function computeMapehTermResult(
  load: TeachingLoad,
  learnerId: string,
  term: Term | string,
  options?: GradingOptions,
): MapehTermResult {
  const musicArts = computeTermResult(load, learnerId, term, "music_arts", options);
  const peHealth = computeTermResult(load, learnerId, term, "pe_health", options);
  return {
    musicArts,
    peHealth,
    consolidatedGrade: consolidateMapehGrades(musicArts.termGrade, peHealth.termGrade),
  };
}
