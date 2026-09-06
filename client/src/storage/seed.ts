import { assignRoster, sortDepEdRoster } from "../features/roster";
import type { Assessment } from "../models/assessment";
import type { Learner } from "../models/learner";
import type { LegacyGradebook } from "../models/legacy";
import type { TeachingLoad } from "../models/teaching-load";
import { createDefaultProfile } from "../models/teacher-profile";
import { DEFAULT_WEIGHTS } from "../models/types";

function sampleLearners(): Learner[] {
  const rows: Array<[string, string, string, "M" | "F"]> = [
    ["Reyes", "Maria", "Cruz", "F"],
    ["Santos", "Juan", "Dela", "M"],
    ["Garcia", "Ana", "Lopez", "F"],
    ["Mendoza", "Carlo", "Ramos", "M"],
    ["Aquino", "Ella", "Torres", "F"],
  ];
  return assignRoster(
    sortDepEdRoster(
      rows.map(([lastName, firstName, middleName, sex], i) => ({
        id: `seed-learner-${i + 1}`,
        lrn: `1234567890${String(i + 1).padStart(2, "0")}`,
        lastName,
        firstName,
        middleName,
        sex,
        birthdate: i === 0 ? "2013-09-06" : `201${i}-0${(i % 9) + 1}-15`,
        avatarAssignment: "auto" as const,
      })),
    ),
  );
}

function termAssessments(term: "1" | "2" | "3", prefix: string): Assessment[] {
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
    id: `${prefix}-t${term}-a${index + 1}`,
    term,
    component,
    title,
    maxScore,
    date: `2026-${month}-${String(index + 3).padStart(2, "0")}`,
  }));
}

export function createSampleTeachingLoad(): TeachingLoad {
  const now = new Date().toISOString();
  const learners = sampleLearners();
  const assessments = [
    ...termAssessments("1", "seed-math"),
    ...termAssessments("2", "seed-math"),
    ...termAssessments("3", "seed-math"),
  ];

  const scores: TeachingLoad["scores"] = {};
  for (const learner of learners) {
    for (const assessment of assessments.filter((a) => a.term === "1")) {
      const ratio = 0.72 + (learner.id.charCodeAt(learner.id.length - 1) % 5) * 0.04;
      scores[`${learner.id}|${assessment.id}`] = Math.round(assessment.maxScore * ratio);
    }
  }

  return {
    id: "seed-load-math-g10",
    gradeLevel: "10",
    section: "Rizal",
    subject: "Mathematics",
    subjectGroup: "JHS_CORE",
    policy: "DO15_TRANSITION",
    schoolYear: "2026-2027",
    dashboardOrder: 0,
    learners,
    assessments,
    scores,
    attendance: {
      sessions: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
      noClassDays: [{ date: "2026-09-07", reason: "School activity" }],
      marks: {
        "seed-learner-2|2026-09-02": "absent",
        "seed-learner-1|2026-09-03": "tardy",
        "seed-learner-3|2026-09-04": "excused",
      },
      excuseReasons: {
        "seed-learner-3|2026-09-04": "Medical appointment",
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeedLegacyGradebook(): LegacyGradebook {
  return {
    students: [
      { id: "s1", name: "Ava Thompson", gradeLevel: 10, email: "ava.t@school.edu" },
      { id: "s2", name: "Liam Rodriguez", gradeLevel: 10, email: "liam.r@school.edu" },
      { id: "s3", name: "Sophia Chen", gradeLevel: 11, email: "sophia.c@school.edu" },
      { id: "s4", name: "Noah Patel", gradeLevel: 11, email: "noah.p@school.edu" },
      { id: "s5", name: "Isabella Nguyen", gradeLevel: 12, email: "bella.n@school.edu" },
    ],
    courses: [
      { id: "c1", name: "Algebra II", teacher: "Mr. Feynman", period: 1 },
      { id: "c2", name: "World History", teacher: "Ms. Curie", period: 2 },
      { id: "c3", name: "Biology", teacher: "Dr. Darwin", period: 3 },
    ],
    grades: [
      { id: "g1", studentId: "s1", courseId: "c1", assignment: "Quiz 1", score: 92, maxScore: 100, date: "2026-02-03" },
      { id: "g2", studentId: "s1", courseId: "c2", assignment: "Essay", score: 88, maxScore: 100, date: "2026-02-05" },
      { id: "g3", studentId: "s2", courseId: "c1", assignment: "Quiz 1", score: 74, maxScore: 100, date: "2026-02-03" },
      { id: "g4", studentId: "s2", courseId: "c3", assignment: "Lab Report", score: 95, maxScore: 100, date: "2026-02-07" },
      { id: "g5", studentId: "s3", courseId: "c2", assignment: "Essay", score: 81, maxScore: 100, date: "2026-02-05" },
      { id: "g6", studentId: "s3", courseId: "c3", assignment: "Lab Report", score: 90, maxScore: 100, date: "2026-02-07" },
      { id: "g7", studentId: "s4", courseId: "c1", assignment: "Quiz 1", score: 68, maxScore: 100, date: "2026-02-03" },
      { id: "g8", studentId: "s5", courseId: "c3", assignment: "Lab Report", score: 99, maxScore: 100, date: "2026-02-07" },
      { id: "g9", studentId: "s5", courseId: "c2", assignment: "Essay", score: 94, maxScore: 100, date: "2026-02-05" },
    ],
  };
}

export function createSeedBundle(): {
  profile: ReturnType<typeof createDefaultProfile>;
  teachingLoads: TeachingLoad[];
  legacy: LegacyGradebook;
} {
  const sampleLoad = createSampleTeachingLoad();
  const profile = createDefaultProfile();
  profile.currentTeachingLoadId = sampleLoad.id;
  profile.schoolYear = sampleLoad.schoolYear;
  profile.teacherName = "Sample Teacher";
  profile.schoolName = "Sample National High School";
  return {
    profile,
    teachingLoads: [sampleLoad],
    legacy: createSeedLegacyGradebook(),
  };
}

export { DEFAULT_WEIGHTS };
