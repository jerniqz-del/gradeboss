import type { SchoolClass } from "../classes";
import type { Learner } from "../models/learner";
import type { TeachingLoad } from "../models/teaching-load";
import { schoolClassToTeachingLoad } from "./migrate";
import {
  getTeachingLoadBySourceClassId,
  saveTeachingLoad,
  deleteTeachingLoad,
} from "./repositories/teaching-loads";

function mergeLearnersByLrn(existing: Learner[], incoming: Learner[]): Learner[] {
  const byLrn = new Map<string, Learner>();
  for (const learner of existing) {
    const key = learner.lrn || learner.id;
    byLrn.set(key, learner);
  }
  for (const learner of incoming) {
    const key = learner.lrn || learner.id;
    const prev = byLrn.get(key);
    byLrn.set(
      key,
      prev
        ? {
            ...prev,
            lastName: learner.lastName,
            firstName: learner.firstName,
            middleName: learner.middleName,
            sex: learner.sex,
            birthdate: learner.birthdate,
            age: learner.age,
            religion: learner.religion,
            motherTongue: learner.motherTongue,
            modality: learner.modality,
            remarks: learner.remarks,
          }
        : learner,
    );
  }
  return Array.from(byLrn.values());
}

/** Keep SF1 imports linked to a TeachingLoad document in IndexedDB. */
export async function upsertTeachingLoadFromSchoolClass(
  cls: SchoolClass,
): Promise<TeachingLoad> {
  const existing = await getTeachingLoadBySourceClassId(cls.id);
  const converted = schoolClassToTeachingLoad(cls);

  if (existing) {
    return saveTeachingLoad({
      ...existing,
      gradeLevel: converted.gradeLevel,
      section: converted.section,
      schoolYear: converted.schoolYear,
      sf1Meta: converted.sf1Meta,
      learners: mergeLearnersByLrn(existing.learners, converted.learners),
      updatedAt: new Date().toISOString(),
    });
  }

  return saveTeachingLoad(converted);
}

export async function removeTeachingLoadForSchoolClass(classId: string): Promise<void> {
  const existing = await getTeachingLoadBySourceClassId(classId);
  if (existing) {
    await deleteTeachingLoad(existing.id);
  }
}
