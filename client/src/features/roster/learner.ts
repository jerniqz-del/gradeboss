import { pruneAttendanceForLearner } from "../../domain/attendance";
import { emptyAttendance } from "../../models/attendance";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Sex } from "../../models/types";
import { assignNewLearner, assignRoster, setManualPreset } from "./avatars";
import {
  normalizeLearnerBirthdate,
  normalizeLrn,
  normalizeNamePart,
  normalizeSex,
  validateLearnerBirthdate,
  validateLrn,
} from "./normalize";
import { sortDepEdRoster } from "./sort";

export interface LearnerFormValues {
  lrn?: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  extensionName?: string;
  sex?: Sex | string;
  birthdate?: string;
  age?: string;
  religion?: string;
  motherTongue?: string;
  modality?: string;
  remarks?: string;
  avatarPresetId?: string;
  avatarAssignment?: "auto" | "manual";
}

export function validateLearnerForm(values: LearnerFormValues): string[] {
  const errors: string[] = [];
  if (!normalizeNamePart(values.lastName)) errors.push("Last name is required.");
  if (!normalizeNamePart(values.firstName)) errors.push("First name is required.");
  const lrnError = validateLrn(values.lrn);
  if (lrnError) errors.push(lrnError);
  const birthError = validateLearnerBirthdate(values.birthdate);
  if (birthError) errors.push(birthError);
  return errors;
}

function formToFields(values: LearnerFormValues): Omit<Learner, "id"> {
  return {
    lrn: normalizeLrn(values.lrn),
    lastName: normalizeNamePart(values.lastName),
    firstName: normalizeNamePart(values.firstName),
    middleName: normalizeNamePart(values.middleName),
    ...(normalizeNamePart(values.extensionName)
      ? { extensionName: normalizeNamePart(values.extensionName) }
      : {}),
    sex: normalizeSex(values.sex),
    birthdate: normalizeLearnerBirthdate(values.birthdate),
    age: normalizeNamePart(values.age) || undefined,
    religion: normalizeNamePart(values.religion) || undefined,
    motherTongue: normalizeNamePart(values.motherTongue) || undefined,
    modality: normalizeNamePart(values.modality) || undefined,
    remarks: normalizeNamePart(values.remarks) || undefined,
    avatarAssignment: values.avatarAssignment || "auto",
    ...(values.avatarPresetId ? { avatarPresetId: values.avatarPresetId } : {}),
  };
}

export function createLearner(values: LearnerFormValues, roster: Learner[] = []): Learner {
  const base: Learner = {
    id: crypto.randomUUID(),
    ...formToFields(values),
  };
  if (values.avatarAssignment === "manual" && values.avatarPresetId) {
    return setManualPreset(base, values.avatarPresetId);
  }
  return assignNewLearner(base, roster);
}

export function updateLearner(existing: Learner, values: LearnerFormValues, roster: Learner[] = []): Learner {
  const next: Learner = {
    ...existing,
    ...formToFields(values),
  };
  if (values.avatarAssignment === "manual" && values.avatarPresetId) {
    return setManualPreset(next, values.avatarPresetId);
  }
  const sexChanged = normalizeSex(existing.sex) !== next.sex;
  const wasManual = existing.avatarAssignment === "manual";
  if (wasManual && !sexChanged && existing.avatarPresetId) {
    return { ...next, avatarPresetId: existing.avatarPresetId, avatarAssignment: "manual" };
  }
  return assignNewLearner(next, roster.filter((item) => item.id !== existing.id));
}

export function pruneScoresForLearner(
  scores: TeachingLoad["scores"],
  learnerId: string,
): TeachingLoad["scores"] {
  const next: TeachingLoad["scores"] = {};
  const prefix = `${learnerId}|`;
  for (const [key, value] of Object.entries(scores)) {
    if (!key.startsWith(prefix)) next[key] = value;
  }
  return next;
}

export function removeLearner(load: TeachingLoad, learnerId: string): TeachingLoad {
  return {
    ...load,
    learners: load.learners.filter((item) => item.id !== learnerId),
    scores: pruneScoresForLearner(load.scores, learnerId),
    attendance: pruneAttendanceForLearner(load.attendance || emptyAttendance(), learnerId),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertLearner(load: TeachingLoad, learner: Learner): TeachingLoad {
  const exists = load.learners.some((item) => item.id === learner.id);
  const learners = exists
    ? load.learners.map((item) => (item.id === learner.id ? learner : item))
    : [...load.learners, learner];
  return {
    ...load,
    learners: assignRoster(sortDepEdRoster(learners)),
    updatedAt: new Date().toISOString(),
  };
}

export function samePerson(a: Pick<Learner, "lrn" | "lastName" | "firstName">, b: Pick<Learner, "lrn" | "lastName" | "firstName">): boolean {
  const aLrn = normalizeLrn(a.lrn);
  const bLrn = normalizeLrn(b.lrn);
  if (aLrn && bLrn && aLrn === bLrn) return true;
  return (
    normalizeNamePart(a.lastName).toLowerCase() === normalizeNamePart(b.lastName).toLowerCase() &&
    normalizeNamePart(a.firstName).toLowerCase() === normalizeNamePart(b.firstName).toLowerCase() &&
    Boolean(a.lastName) &&
    Boolean(a.firstName)
  );
}

export function learnerAlreadyExists(roster: Learner[], candidate: Pick<Learner, "lrn" | "lastName" | "firstName">): boolean {
  return roster.some((item) => samePerson(item, candidate));
}
