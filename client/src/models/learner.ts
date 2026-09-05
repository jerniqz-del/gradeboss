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

export function learnerDisplayName(learner: Learner): string {
  const parts = [learner.lastName, learner.firstName, learner.middleName].filter(Boolean);
  if (learner.lastName && learner.firstName) {
    const middle = learner.middleName ? ` ${learner.middleName.charAt(0)}.` : "";
    return `${learner.lastName}, ${learner.firstName}${middle}`;
  }
  return parts.join(" ") || "Unnamed learner";
}
