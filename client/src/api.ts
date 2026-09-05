/**
 * Local-only data layer backed by IndexedDB (Phase 1).
 *
 * Legacy Student/Course/Grade APIs remain for existing UI compatibility.
 * Teaching loads use the DepEd-ready schema (see `models/` and `storage/`).
 */

import type { Student, Course, Grade } from "./models/legacy";
import type { TeachingLoad } from "./models/teaching-load";
import {
  addCourse as repoAddCourse,
  addGrade as repoAddGrade,
  addStudent as repoAddStudent,
  deleteStudent as repoDeleteStudent,
  getLegacySnapshot,
  listCourses,
  listGrades,
  listStudents,
  listTeachingLoads,
  getTeachingLoad,
  saveTeachingLoad,
  deleteTeachingLoad,
} from "./storage";

export type { Student, Course, Grade, TeachingLoad };
export type { Stats } from "./api-stats";

import { computeStats } from "./api-stats";

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const api = {
  async getStudents(): Promise<Student[]> {
    return listStudents();
  },
  async addStudent(body: Partial<Student>): Promise<Student> {
    const student: Student = {
      id: crypto.randomUUID(),
      name: str(body.name) || "Unnamed",
      gradeLevel: Number(body.gradeLevel) || 9,
      email: str(body.email),
    };
    return repoAddStudent(student);
  },
  async deleteStudent(id: string): Promise<void> {
    await repoDeleteStudent(id);
  },
  async getCourses(): Promise<Course[]> {
    return listCourses();
  },
  async addCourse(body: Partial<Course>): Promise<Course> {
    const course: Course = {
      id: crypto.randomUUID(),
      name: str(body.name) || "Untitled course",
      teacher: str(body.teacher) || "Unassigned",
      period: Number(body.period) || 1,
    };
    return repoAddCourse(course);
  },
  async getGrades(): Promise<Grade[]> {
    return listGrades();
  },
  async addGrade(body: Partial<Grade>): Promise<Grade> {
    const numericScore = Number(body.score);
    const grade: Grade = {
      id: crypto.randomUUID(),
      studentId: str(body.studentId),
      courseId: str(body.courseId),
      assignment: str(body.assignment) || "Assignment",
      score: Number.isNaN(numericScore) || numericScore < 0 ? 0 : numericScore,
      maxScore: Number(body.maxScore) || 100,
      date: new Date().toISOString().slice(0, 10),
    };
    return repoAddGrade(grade);
  },
  async getStats() {
    const snapshot = await getLegacySnapshot();
    return computeStats(snapshot);
  },

  /** DepEd teaching loads (IndexedDB). */
  async getTeachingLoads(): Promise<TeachingLoad[]> {
    return listTeachingLoads();
  },
  async getTeachingLoad(id: string): Promise<TeachingLoad | undefined> {
    return getTeachingLoad(id);
  },
  async saveTeachingLoad(load: TeachingLoad): Promise<TeachingLoad> {
    return saveTeachingLoad(load);
  },
  async deleteTeachingLoad(id: string): Promise<void> {
    return deleteTeachingLoad(id);
  },
};
