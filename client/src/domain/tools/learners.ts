import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";

/** Active (not transferred-out) learners. Port of eclassrecord `activeLearners`. */
export function activeLearners(load: Pick<TeachingLoad, "learners"> | null | undefined): Learner[] {
  return Array.isArray(load?.learners)
    ? load.learners.filter((learner) => learner && !learner.transferredOutTerm)
    : [];
}

export function sexKey(learner: { sex?: string }): "M" | "F" | "U" {
  const sex = String(learner.sex || "").trim().toUpperCase();
  if (sex === "M" || sex === "MALE") return "M";
  if (sex === "F" || sex === "FEMALE") return "F";
  return "U";
}

export function groupSexCounts(members: Array<{ sex?: string }>): { M: number; F: number; U: number } {
  const counts = { M: 0, F: 0, U: 0 };
  members.forEach((learner) => {
    counts[sexKey(learner)] += 1;
  });
  return counts;
}
