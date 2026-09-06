import { computeTermResult } from "../../domain/grading";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import { assignRoster } from "./avatars";
import { learnerAlreadyExists, pruneScoresForLearner } from "./learner";
import { sortDepEdRoster } from "./sort";

function learnerHasRecordedGrades(load: TeachingLoad, learnerId: string): boolean {
  const prefix = `${learnerId}|`;
  return Object.entries(load.scores).some(([key, value]) => key.startsWith(prefix) && value !== "");
}

export function getLearnerTermGradeForExport(
  load: TeachingLoad,
  learnerId: string,
  term: Term,
): number | string | null {
  const result = computeTermResult(load, learnerId, term);
  if (result.termGrade === null || result.termGrade === undefined) return null;
  return result.termGrade;
}

/** T/I clone — eclassrecord `createTransferTargetLearner`. */
export function createTransferTargetLearner(
  learner: Learner,
  completedTermGrades: Partial<Record<Term, number>>,
): Learner {
  const transferredInGrades = Object.fromEntries(
    Object.entries(completedTermGrades).filter(([, grade]) => typeof grade === "number"),
  ) as Partial<Record<Term, number>>;
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
    ...(Object.keys(transferredInGrades).length > 0 ? { transferredInGrades } : {}),
  };
}

export function transferableLoads(source: TeachingLoad, all: TeachingLoad[]): TeachingLoad[] {
  return all.filter((item) => item.id !== source.id);
}

export function transferLearnerBetweenLoads(
  source: TeachingLoad,
  target: TeachingLoad,
  learnerId: string,
  term: Term = "1",
): { source: TeachingLoad; target: TeachingLoad } {
  const learner = source.learners.find((item) => item.id === learnerId);
  if (!learner) throw new Error("Learner was not found on the source teaching load.");
  if (learnerAlreadyExists(target.learners, learner)) {
    throw new Error("That learner is already on the target roster.");
  }

  const now = new Date().toISOString();
  const hasRecordedGrades = learnerHasRecordedGrades(source, learner.id);

  if (!hasRecordedGrades) {
    const moved: Learner = { ...learner };
    delete moved.transferredOutTerm;
    delete moved.transferredInGrades;
    return {
      source: {
        ...source,
        learners: source.learners.filter((item) => item.id !== learner.id),
        scores: pruneScoresForLearner(source.scores, learner.id),
        updatedAt: now,
      },
      target: {
        ...target,
        learners: assignRoster(sortDepEdRoster([...target.learners, moved])),
        updatedAt: now,
      },
    };
  }

  const completedTermGrades: Partial<Record<Term, number>> = {};
  const termCount = parseInt(term, 10);
  for (let t = 1; t <= termCount; t++) {
    const grade = getLearnerTermGradeForExport(source, learner.id, String(t) as Term);
    if (typeof grade === "number") completedTermGrades[String(t) as Term] = grade;
  }

  const marked: Learner = { ...learner, transferredOutTerm: term };
  const incoming = createTransferTargetLearner(learner, completedTermGrades);

  return {
    source: {
      ...source,
      learners: source.learners.map((item) => (item.id === learner.id ? marked : item)),
      updatedAt: now,
    },
    target: {
      ...target,
      learners: assignRoster(sortDepEdRoster([...target.learners, incoming])),
      updatedAt: now,
    },
  };
}
