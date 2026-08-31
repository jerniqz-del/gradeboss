import type { Database } from "./types.js";

/**
 * Deterministic seed data so a freshly provisioned environment always has a
 * meaningful dataset to demonstrate GradeBoss end-to-end.
 */
export function seedData(): Database {
  const students = [
    { id: "s1", name: "Ava Thompson", gradeLevel: 10, email: "ava.t@school.edu" },
    { id: "s2", name: "Liam Rodriguez", gradeLevel: 10, email: "liam.r@school.edu" },
    { id: "s3", name: "Sophia Chen", gradeLevel: 11, email: "sophia.c@school.edu" },
    { id: "s4", name: "Noah Patel", gradeLevel: 11, email: "noah.p@school.edu" },
    { id: "s5", name: "Isabella Nguyen", gradeLevel: 12, email: "bella.n@school.edu" },
  ];

  const courses = [
    { id: "c1", name: "Algebra II", teacher: "Mr. Feynman", period: 1 },
    { id: "c2", name: "World History", teacher: "Ms. Curie", period: 2 },
    { id: "c3", name: "Biology", teacher: "Dr. Darwin", period: 3 },
  ];

  const grades = [
    { id: "g1", studentId: "s1", courseId: "c1", assignment: "Quiz 1", score: 92, maxScore: 100, date: "2026-02-03" },
    { id: "g2", studentId: "s1", courseId: "c2", assignment: "Essay", score: 88, maxScore: 100, date: "2026-02-05" },
    { id: "g3", studentId: "s2", courseId: "c1", assignment: "Quiz 1", score: 74, maxScore: 100, date: "2026-02-03" },
    { id: "g4", studentId: "s2", courseId: "c3", assignment: "Lab Report", score: 95, maxScore: 100, date: "2026-02-07" },
    { id: "g5", studentId: "s3", courseId: "c2", assignment: "Essay", score: 81, maxScore: 100, date: "2026-02-05" },
    { id: "g6", studentId: "s3", courseId: "c3", assignment: "Lab Report", score: 90, maxScore: 100, date: "2026-02-07" },
    { id: "g7", studentId: "s4", courseId: "c1", assignment: "Quiz 1", score: 68, maxScore: 100, date: "2026-02-03" },
    { id: "g8", studentId: "s5", courseId: "c3", assignment: "Lab Report", score: 99, maxScore: 100, date: "2026-02-07" },
    { id: "g9", studentId: "s5", courseId: "c2", assignment: "Essay", score: 94, maxScore: 100, date: "2026-02-05" },
  ];

  return { students, courses, grades };
}
