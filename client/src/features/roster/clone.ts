import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { assignRoster } from "./avatars";
import { learnerAlreadyExists } from "./learner";
import { sortDepEdRoster } from "./sort";

export type CloneMode = "merge" | "overwrite";

/** Clone a learner without transfer flags or scores — eclassrecord `performRosterImport`. */
export function cloneLearnerRecord(learner: Learner): Learner {
  return {
    id: crypto.randomUUID(),
    lrn: learner.lrn,
    lastName: learner.lastName,
    firstName: learner.firstName,
    middleName: learner.middleName,
    ...(learner.extensionName ? { extensionName: learner.extensionName } : {}),
    sex: learner.sex,
    birthdate: learner.birthdate,
    age: learner.age,
    religion: learner.religion,
    motherTongue: learner.motherTongue,
    modality: learner.modality,
    remarks: learner.remarks,
    avatarPresetId: learner.avatarPresetId,
    avatarAssignment: learner.avatarAssignment,
  };
}

export function cloneRoster(
  source: Learner[],
  target: Learner[],
  mode: CloneMode = "merge",
): { learners: Learner[]; added: number; skipped: number } {
  if (mode === "overwrite") {
    const learners = assignRoster(sortDepEdRoster(source.map(cloneLearnerRecord)));
    return { learners, added: learners.length, skipped: 0 };
  }

  const next = [...target];
  let added = 0;
  let skipped = 0;
  for (const learner of source) {
    if (learnerAlreadyExists(next, learner)) {
      skipped += 1;
      continue;
    }
    next.push(cloneLearnerRecord(learner));
    added += 1;
  }
  return { learners: assignRoster(sortDepEdRoster(next)), added, skipped };
}

export function cloneRosterOntoLoad(
  source: TeachingLoad,
  target: TeachingLoad,
  mode: CloneMode = "merge",
): TeachingLoad {
  const result = cloneRoster(source.learners, target.learners, mode);
  return {
    ...target,
    learners: result.learners,
    scores: mode === "overwrite" ? {} : target.scores,
    updatedAt: new Date().toISOString(),
  };
}
