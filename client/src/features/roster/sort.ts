import { learnerDisplayName, type Learner } from "../../models/learner";
import { normalizeSex } from "./normalize";

/** M = 1, F = 2, unknown = 3 — eclassrecord `sexRank`. */
export function sexRank(value: unknown): number {
  const resolved = normalizeSex(value);
  if (resolved === "M") return 1;
  if (resolved === "F") return 2;
  return 3;
}

/**
 * DepEd roster order: male block, then female, then Filipino alpha by display name.
 * Port of eclassrecord `sortLearners` / `sortAssignmentLearners`.
 */
export function compareDepEdLearners(a: Learner, b: Learner): number {
  const sx = sexRank(a.sex);
  const sy = sexRank(b.sex);
  if (sx !== sy) return sx - sy;
  return learnerDisplayName(a).toLowerCase().localeCompare(learnerDisplayName(b).toLowerCase(), "fil");
}

export function sortDepEdRoster(learners: Learner[]): Learner[] {
  return [...learners].sort(compareDepEdLearners);
}
