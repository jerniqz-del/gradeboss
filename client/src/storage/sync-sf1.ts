import type { SchoolClass } from "../classes";
import {
  attachSf1RosterToMatchingLoads,
  isSf1RosterLoad,
  mergeLearnersByLrn,
} from "../features/roster";
import type { TeachingLoad } from "../models/teaching-load";
import { schoolClassToTeachingLoad } from "./migrate";
import {
  deleteTeachingLoad,
  getTeachingLoadBySourceClassId,
  listTeachingLoads,
  saveTeachingLoad,
} from "./repositories/teaching-loads";

export interface Sf1SyncResult {
  sourceLoad: TeachingLoad;
  updatedLoads: TeachingLoad[];
}

/** Keep SF1 imports linked to a TeachingLoad document and matching subject loads. */
export async function upsertTeachingLoadFromSchoolClass(
  cls: SchoolClass,
): Promise<TeachingLoad> {
  const result = await syncSchoolClassToTeachingLoads(cls);
  return result.sourceLoad;
}

export async function syncSchoolClassToTeachingLoads(cls: SchoolClass): Promise<Sf1SyncResult> {
  const existing = await getTeachingLoadBySourceClassId(cls.id);
  const converted = schoolClassToTeachingLoad(cls);

  let sourceLoad: TeachingLoad;
  if (existing) {
    sourceLoad = await saveTeachingLoad({
      ...existing,
      gradeLevel: converted.gradeLevel,
      section: converted.section,
      schoolYear: converted.schoolYear,
      sf1Meta: converted.sf1Meta,
      learners: mergeLearnersByLrn(existing.learners, converted.learners),
      updatedAt: new Date().toISOString(),
    });
  } else {
    sourceLoad = await saveTeachingLoad(converted);
  }

  const all = await listTeachingLoads();
  const matching = attachSf1RosterToMatchingLoads(all, {
    meta: {
      schoolId: cls.schoolId,
      schoolName: cls.schoolName,
      region: cls.region,
      division: cls.division,
      district: cls.district,
      schoolYear: cls.schoolYear,
      gradeLevel: cls.gradeLevel,
      section: cls.section,
      adviser: cls.adviser,
      schoolHead: cls.schoolHead,
    },
    learners: cls.learners,
    warnings: [],
  }, { skipLoadIds: [sourceLoad.id], sourceClassId: cls.id });

  const updatedLoads: TeachingLoad[] = [];
  for (const load of matching) {
    updatedLoads.push(await saveTeachingLoad(load));
  }

  return { sourceLoad, updatedLoads };
}

export async function removeTeachingLoadForSchoolClass(classId: string): Promise<void> {
  const existing = await getTeachingLoadBySourceClassId(classId);
  if (existing && isSf1RosterLoad(existing)) {
    await deleteTeachingLoad(existing.id);
  }
}
