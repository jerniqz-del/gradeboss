import type { ComponentWeights } from "../../models/types";
import type { WeightTriplet } from "./types";
import { weightsToTriplet } from "./weights";

/**
 * Initial Grade = WW×w0 + PT×w1 + Exam×w2.
 * Weights are percentages (20/50/30 → 0.20 / 0.50 / 0.30).
 */
export function initialGrade(
  writtenWorkPs: number,
  performanceTaskPs: number,
  examPs: number,
  weights: WeightTriplet | ComponentWeights | number[],
): number {
  const triplet = Array.isArray(weights) ? weights : weightsToTriplet(weights as ComponentWeights);
  return (
    (writtenWorkPs * (triplet[0] || 0)) / 100 +
    (performanceTaskPs * (triplet[1] || 0)) / 100 +
    (examPs * (triplet[2] || 0)) / 100
  );
}

/** Desktop `fmt` — display rounding to two decimal places. */
export function formatInitialGrade(ig: number): number {
  if (!Number.isFinite(ig)) return 0;
  return Math.round(ig * 100) / 100;
}
