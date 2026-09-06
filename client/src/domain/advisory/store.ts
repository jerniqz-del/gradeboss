import type {
  AdvisoryClass,
  AdvisoryLearner,
  AdvisoryStore,
  AdvisorySubject,
} from "../../models/advisory";
import { createRecordId, nowIso } from "../../models/advisory";
import type { Learner } from "../../models/learner";
import { normalizeSubjectKey, standardSubjectsForGrade } from "./subjects";

function stamp(): string {
  return nowIso();
}

export function activeAdvisoryClass(store: AdvisoryStore, schoolYear: string): AdvisoryClass | undefined {
  return store.classes.find((item) => item.schoolYear === schoolYear && item.isActive && !item.isArchived);
}

export function createAdvisoryClass(
  store: AdvisoryStore,
  input: {
    schoolYear: string;
    gradeLevel: string;
    section: string;
    adviserName: string;
    schoolName?: string;
    schoolId?: string;
    district?: string;
    division?: string;
    region?: string;
    isSpecialClass?: boolean;
    specialProgramName?: string;
    specialSubjects?: Array<{ name: string; includeInGeneralAverage: boolean }>;
  },
): AdvisoryStore {
  const schoolYear = input.schoolYear.trim();
  const gradeLevel = input.gradeLevel.trim();
  const section = input.section.trim();
  const adviserName = input.adviserName.trim();
  if (!schoolYear || !gradeLevel || !section || !adviserName) {
    throw new Error("School year, grade level, section, and adviser name are required.");
  }
  if (input.isSpecialClass && !input.specialProgramName?.trim()) {
    throw new Error("Special program name is required for a Special Class.");
  }
  if (store.classes.some((item) => item.schoolYear === schoolYear && item.isActive && !item.isArchived)) {
    throw new Error("Only one active Advisory Class is allowed for a school year.");
  }
  const createdAt = stamp();
  const advisoryClass: AdvisoryClass = {
    id: createRecordId("advisory-class"),
    schoolYear,
    gradeLevel,
    section,
    adviserName,
    schoolName: input.schoolName?.trim() || "",
    schoolId: input.schoolId?.trim() || "",
    district: input.district?.trim() || "",
    division: input.division?.trim() || "",
    region: input.region?.trim() || "",
    isSpecialClass: input.isSpecialClass === true,
    specialProgramName: input.specialProgramName?.trim() || "",
    isActive: true,
    isArchived: false,
    createdAt,
    updatedAt: createdAt,
  };
  const subjects = standardSubjectsForGrade(gradeLevel).map((subjectName, index) =>
    makeSubject(advisoryClass.id, subjectName, index, false, true, createdAt),
  );
  const specials = (input.specialSubjects || [])
    .map((item) => item.name.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (specials.length && !advisoryClass.isSpecialClass) {
    throw new Error("Special-program subjects require a Special Class.");
  }
  specials.forEach((name, index) => {
    const include = input.specialSubjects?.[index]?.includeInGeneralAverage !== false;
    subjects.push(makeSubject(advisoryClass.id, name, subjects.length, true, include, createdAt));
  });
  return {
    ...store,
    classes: [...store.classes, advisoryClass],
    subjects: [...store.subjects, ...subjects],
  };
}

function makeSubject(
  advisoryClassId: string,
  subjectName: string,
  displayOrder: number,
  isSpecial: boolean,
  includeInGeneralAverage: boolean,
  createdAt: string,
): AdvisorySubject {
  return {
    id: createRecordId("advisory-subject"),
    advisoryClassId,
    subjectName,
    normalizedSubjectKey: normalizeSubjectKey(subjectName),
    expectedSourceTeacher: "",
    expectedSourceClass: "",
    expectedSourceClassId: "",
    sourceType: "grade-transfer-file",
    displayOrder,
    isSpecialProgramSubject: isSpecial,
    includeInGeneralAverage,
    isArchived: false,
    createdAt,
    updatedAt: createdAt,
  };
}

export function archiveAdvisoryClass(store: AdvisoryStore, classId: string): AdvisoryStore {
  return {
    ...store,
    classes: store.classes.map((item) =>
      item.id === classId ? { ...item, isActive: false, isArchived: true, updatedAt: stamp() } : item,
    ),
  };
}

export function resetAdvisoryClass(store: AdvisoryStore, classId: string): AdvisoryStore {
  return {
    ...store,
    classes: store.classes.filter((item) => item.id !== classId),
    learners: store.learners.filter((item) => item.advisoryClassId !== classId),
    subjects: store.subjects.filter((item) => item.advisoryClassId !== classId),
    grades: store.grades.filter((item) => item.advisoryClassId !== classId),
    importBatches: store.importBatches.filter((item) => item.advisoryClassId !== classId),
    sourceMappings: store.sourceMappings.filter((item) => item.advisoryClassId !== classId),
  };
}

export function addAdvisoryLearnerFromRoster(
  store: AdvisoryStore,
  advisoryClassId: string,
  learner: Learner,
  source = "class-load",
): AdvisoryStore {
  const advisoryClass = store.classes.find((item) => item.id === advisoryClassId);
  if (!advisoryClass) throw new Error("Advisory Class was not found.");
  if (!learner.lastName.trim() || !learner.firstName.trim()) {
    throw new Error("Learner first name and last name are required.");
  }
  if (learner.lrn && !/^\d{12}$/.test(learner.lrn)) throw new Error("LRN must contain exactly 12 digits.");
  if (learner.lrn && store.learners.some((item) => item.advisoryClassId === advisoryClassId && item.lrn === learner.lrn)) {
    throw new Error("This LRN already belongs to another Advisory learner.");
  }
  const createdAt = stamp();
  const row: AdvisoryLearner = {
    id: createRecordId("advisory-learner"),
    advisoryClassId,
    linkedLearnerId: learner.id,
    lrn: learner.lrn,
    lastName: learner.lastName,
    firstName: learner.firstName,
    middleName: learner.middleName,
    extensionName: learner.extensionName || "",
    sex: learner.sex,
    avatarPresetId: learner.avatarPresetId || "",
    avatarAssignment: learner.avatarAssignment || "auto",
    birthdate: learner.birthdate,
    enrollmentStatus: "active",
    source,
    createdAt,
    updatedAt: createdAt,
  };
  return { ...store, learners: [...store.learners, row] };
}

export function copyLearnersFromLoad(
  store: AdvisoryStore,
  advisoryClassId: string,
  learners: Learner[],
): { store: AdvisoryStore; added: number; skipped: number } {
  let next = store;
  let added = 0;
  let skipped = 0;
  for (const learner of learners) {
    try {
      next = addAdvisoryLearnerFromRoster(next, advisoryClassId, learner);
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  return { store: next, added, skipped };
}

export function upsertAdvisoryLearner(store: AdvisoryStore, learner: AdvisoryLearner): AdvisoryStore {
  if (!learner.lastName.trim() || !learner.firstName.trim()) {
    throw new Error("Learner first name and last name are required.");
  }
  if (learner.lrn && !/^\d{12}$/.test(learner.lrn)) throw new Error("LRN must contain exactly 12 digits.");
  if (
    learner.lrn &&
    store.learners.some(
      (item) => item.id !== learner.id && item.advisoryClassId === learner.advisoryClassId && item.lrn === learner.lrn,
    )
  ) {
    throw new Error("This LRN already belongs to another Advisory learner.");
  }
  const updated = { ...learner, updatedAt: stamp() };
  const index = store.learners.findIndex((item) => item.id === learner.id);
  if (index < 0) return { ...store, learners: [...store.learners, { ...updated, createdAt: updated.updatedAt }] };
  const learners = store.learners.slice();
  learners[index] = { ...store.learners[index], ...updated, createdAt: store.learners[index].createdAt };
  return { ...store, learners };
}

export function removeAdvisoryLearner(store: AdvisoryStore, learnerId: string): AdvisoryStore {
  return {
    ...store,
    learners: store.learners.filter((item) => item.id !== learnerId),
    grades: store.grades.filter((item) => item.advisoryLearnerId !== learnerId),
  };
}

export function updateSpecialSubjects(
  store: AdvisoryStore,
  advisoryClassId: string,
  specialProgramName: string,
  specials: Array<{ name: string; includeInGeneralAverage: boolean }>,
): AdvisoryStore {
  const advisoryClass = store.classes.find((item) => item.id === advisoryClassId);
  if (!advisoryClass) throw new Error("Advisory Class was not found.");
  const named = specials.map((item) => ({ ...item, name: item.name.trim() })).filter((item) => item.name);
  if (named.length > 2) throw new Error("A Special Class can have at most two active special-program subjects.");
  const createdAt = stamp();
  const existing = store.subjects.filter((item) => item.advisoryClassId === advisoryClassId);
  const regular = existing.filter((item) => !item.isSpecialProgramSubject);
  const previousSpecials = existing.filter((item) => item.isSpecialProgramSubject);
  const nextSpecials: AdvisorySubject[] = named.map((item, index) => {
    const key = normalizeSubjectKey(item.name);
    const current = previousSpecials.find((row) => row.normalizedSubjectKey === key);
    if (current) {
      return {
        ...current,
        subjectName: item.name,
        includeInGeneralAverage: item.includeInGeneralAverage,
        isArchived: false,
        displayOrder: regular.length + index,
        updatedAt: createdAt,
      };
    }
    return {
      id: createRecordId("advisory-subject"),
      advisoryClassId,
      subjectName: item.name,
      normalizedSubjectKey: key,
      expectedSourceTeacher: "",
      expectedSourceClass: "",
      expectedSourceClassId: "",
      sourceType: "grade-transfer-file",
      displayOrder: regular.length + index,
      isSpecialProgramSubject: true,
      includeInGeneralAverage: item.includeInGeneralAverage,
      isArchived: false,
      createdAt,
      updatedAt: createdAt,
    };
  });
  const keptIds = new Set(nextSpecials.map((item) => item.id));
  const archived = previousSpecials
    .filter((item) => !keptIds.has(item.id))
    .map((item) => ({ ...item, isArchived: true, updatedAt: createdAt }));
  return {
    ...store,
    classes: store.classes.map((item) =>
      item.id === advisoryClassId
        ? {
            ...item,
            isSpecialClass: named.length > 0,
            specialProgramName: named.length ? specialProgramName.trim() : "",
            updatedAt: createdAt,
          }
        : item,
    ),
    subjects: [...regular, ...nextSpecials, ...archived],
  };
}

export function setSubjectSource(
  store: AdvisoryStore,
  subjectId: string,
  source: { sourceType: AdvisorySubject["sourceType"]; expectedSourceClassId?: string; expectedSourceClass?: string },
): AdvisoryStore {
  return {
    ...store,
    subjects: store.subjects.map((item) =>
      item.id === subjectId
        ? {
            ...item,
            sourceType: source.sourceType,
            expectedSourceClassId: source.expectedSourceClassId || "",
            expectedSourceClass: source.expectedSourceClass || "",
            updatedAt: stamp(),
          }
        : item,
    ),
  };
}
