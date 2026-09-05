import type { Sf1Learner, Sf1Meta, ParsedSf1 } from "../../sf1";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { assignRoster } from "./avatars";
import { samePerson } from "./learner";
import {
  normalizeGradeLevel,
  normalizeLearnerBirthdate,
  normalizeLrn,
  normalizeNamePart,
  normalizeSchoolYear,
  normalizeSection,
  normalizeSex,
} from "./normalize";
import { sortDepEdRoster } from "./sort";

export function sf1LearnerToLearner(learner: Sf1Learner): Learner {
  return {
    id: crypto.randomUUID(),
    lrn: normalizeLrn(learner.lrn),
    lastName: normalizeNamePart(learner.lastName),
    firstName: normalizeNamePart(learner.firstName),
    middleName: normalizeNamePart(learner.middleName),
    sex: normalizeSex(learner.sex),
    birthdate: normalizeLearnerBirthdate(learner.birthdate),
    age: learner.age || undefined,
    religion: learner.religion || undefined,
    motherTongue: learner.motherTongue || undefined,
    modality: learner.modality || undefined,
    remarks: learner.remarks || undefined,
    avatarAssignment: "auto",
  };
}

export function mergeLearnersByLrn(existing: Learner[], incoming: Learner[]): Learner[] {
  const next = [...existing];
  for (const learner of incoming) {
    const index = next.findIndex((item) => samePerson(item, learner));
    if (index >= 0) {
      const prev = next[index];
      next[index] = {
        ...prev,
        lrn: learner.lrn || prev.lrn,
        lastName: learner.lastName,
        firstName: learner.firstName,
        middleName: learner.middleName,
        ...(learner.extensionName !== undefined ? { extensionName: learner.extensionName } : {}),
        sex: learner.sex || prev.sex,
        birthdate: learner.birthdate || prev.birthdate,
        age: learner.age ?? prev.age,
        religion: learner.religion ?? prev.religion,
        motherTongue: learner.motherTongue ?? prev.motherTongue,
        modality: learner.modality ?? prev.modality,
        remarks: learner.remarks ?? prev.remarks,
      };
    } else {
      next.push({ ...learner, id: crypto.randomUUID() });
    }
  }
  return assignRoster(sortDepEdRoster(next));
}

export function loadsMatchSection(load: TeachingLoad, meta: Pick<Sf1Meta, "gradeLevel" | "section" | "schoolYear">): boolean {
  const loadGrade = normalizeGradeLevel(load.gradeLevel);
  const metaGrade = normalizeGradeLevel(meta.gradeLevel);
  const loadSection = normalizeSection(load.section);
  const metaSection = normalizeSection(meta.section);
  const loadYear = normalizeSchoolYear(load.schoolYear);
  const metaYear = normalizeSchoolYear(meta.schoolYear);
  if (!loadSection || !metaSection || loadSection !== metaSection) return false;
  if (loadGrade && metaGrade && loadGrade !== metaGrade) return false;
  if (loadYear && metaYear && loadYear !== metaYear) return false;
  return true;
}

export function findLoadsForSection(
  loads: TeachingLoad[],
  match: Pick<Sf1Meta, "gradeLevel" | "section" | "schoolYear">,
): TeachingLoad[] {
  return loads.filter((load) => loadsMatchSection(load, match));
}

export function isSf1RosterLoad(load: TeachingLoad): boolean {
  return load.subject === "Class Roster (SF1)";
}

export function attachSf1RosterToLoad(
  load: TeachingLoad,
  parsed: ParsedSf1,
  sourceClassId?: string,
): TeachingLoad {
  const incoming = parsed.learners.map(sf1LearnerToLearner);
  return {
    ...load,
    ...(sourceClassId && !load.sourceClassId ? { sourceClassId } : {}),
    sf1Meta: { ...load.sf1Meta, ...parsed.meta },
    learners: mergeLearnersByLrn(load.learners, incoming),
    updatedAt: new Date().toISOString(),
  };
}

export function attachSf1RosterToMatchingLoads(
  loads: TeachingLoad[],
  parsed: ParsedSf1,
  options?: { skipLoadIds?: string[]; sourceClassId?: string },
): TeachingLoad[] {
  const skip = new Set(options?.skipLoadIds ?? []);
  return loads
    .filter((load) => !skip.has(load.id) && !isSf1RosterLoad(load) && loadsMatchSection(load, parsed.meta))
    .map((load) => attachSf1RosterToLoad(load, parsed, options?.sourceClassId));
}
