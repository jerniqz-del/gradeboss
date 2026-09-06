import type { Sex, Term } from "./types";

export interface Learner {
  id: string;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName?: string;
  sex: Sex;
  birthdate: string;
  age?: string;
  religion?: string;
  motherTongue?: string;
  modality?: string;
  remarks?: string;
  avatarPresetId?: string;
  avatarAssignment?: "auto" | "manual";
  transferredOutTerm?: Term;
  transferredInGrades?: Partial<Record<Term, number>>;
}

/** "Last, First Jr. M." — port of eclassrecord `formatLearnerName` plus extension. */
export function learnerDisplayName(learner: Learner): string {
  const last = (learner.lastName || "").trim();
  const first = (learner.firstName || "").trim();
  const ext = (learner.extensionName || "").trim();
  const middle = (learner.middleName || "").trim();
  if (last && first) {
    const extPart = ext ? ` ${ext}` : "";
    const midPart = middle ? ` ${middle.charAt(0)}.` : "";
    return `${last}, ${first}${extPart}${midPart}`;
  }
  return [last, first, ext, middle].filter(Boolean).join(" ") || "Unnamed learner";
}
