import type { SchoolClass } from "../classes";
import type { Sf1Learner } from "../sf1";
import { defaultSubjectGroup, detectPolicy, parseGradeLevel } from "../domain/policy";
import type { Assessment } from "../models/assessment";
import type { Learner } from "../models/learner";
import type { LegacyGradebook } from "../models/legacy";
import type { TeachingLoad } from "../models/teaching-load";

const LEGACY_DATA_KEY = "gradeboss:data";
const LEGACY_CLASSES_KEY = "gradeboss:classes";

export interface LocalStorageSnapshot {
  legacy: LegacyGradebook;
  schoolClasses: SchoolClass[];
}

export function readLocalStorageSnapshot(): LocalStorageSnapshot {
  let legacy: LegacyGradebook = { students: [], courses: [], grades: [] };
  let schoolClasses: SchoolClass[] = [];

  try {
    const raw = localStorage.getItem(LEGACY_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LegacyGradebook>;
      legacy = {
        students: parsed.students ?? [],
        courses: parsed.courses ?? [],
        grades: parsed.grades ?? [],
      };
    }
  } catch {
    // ignore corrupt legacy data
  }

  try {
    const raw = localStorage.getItem(LEGACY_CLASSES_KEY);
    if (raw) {
      schoolClasses = JSON.parse(raw) as SchoolClass[];
    }
  } catch {
    // ignore corrupt class list
  }

  return { legacy, schoolClasses };
}

function sf1LearnerToLearner(learner: Sf1Learner): Learner {
  return {
    id: crypto.randomUUID(),
    lrn: learner.lrn,
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
    avatarAssignment: "auto",
  };
}

function defaultTermAssessments(term: "1" | "2" | "3"): Assessment[] {
  const defs: Array<[Assessment["component"], string, number]> = [
    ["WW", "Written Work 1", 25],
    ["WW", "Written Work 2", 25],
    ["PT", "Performance Task 1", 50],
    ["ST1", "Summative Test 1", 40],
    ["ST2", "Summative Test 2", 40],
    ["TE", "Term Examination", 50],
  ];
  const month = String(6 + Number(term)).padStart(2, "0");
  return defs.map(([component, title, maxScore], index) => ({
    id: crypto.randomUUID(),
    term,
    component,
    title,
    maxScore,
    date: `2026-${month}-${String(index + 3).padStart(2, "0")}`,
  }));
}

export function schoolClassToTeachingLoad(cls: SchoolClass): TeachingLoad {
  const gradeNum = parseGradeLevel(cls.gradeLevel);
  const now = new Date().toISOString();
  const assessments: Assessment[] = [
    ...defaultTermAssessments("1"),
    ...defaultTermAssessments("2"),
    ...defaultTermAssessments("3"),
  ];

  return {
    id: crypto.randomUUID(),
    gradeLevel: gradeNum ? String(gradeNum) : cls.gradeLevel || "0",
    section: cls.section || "Unassigned",
    subject: "Class Roster (SF1)",
    subjectGroup: defaultSubjectGroup(gradeNum || 7),
    policy: detectPolicy(gradeNum || 7),
    schoolYear: cls.schoolYear || "2026-2027",
    dashboardOrder: 0,
    sourceClassId: cls.id,
    sf1Meta: {
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
    learners: cls.learners.map(sf1LearnerToLearner),
    assessments,
    scores: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function hasLegacyLocalStorageData(snapshot: LocalStorageSnapshot): boolean {
  const { legacy, schoolClasses } = snapshot;
  return (
    legacy.students.length > 0 ||
    legacy.courses.length > 0 ||
    legacy.grades.length > 0 ||
    schoolClasses.length > 0
  );
}

export { LEGACY_DATA_KEY, LEGACY_CLASSES_KEY };
