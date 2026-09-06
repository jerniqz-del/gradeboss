import type { Course, Grade, LegacyGradebook, Student } from "../../models/legacy";
import { ensureStorageReady, getLegacyGradebook, saveLegacyGradebook } from "../init";

async function updateLegacy(mutator: (book: LegacyGradebook) => void): Promise<LegacyGradebook> {
  const db = await ensureStorageReady();
  const book = await getLegacyGradebook(db);
  mutator(book);
  await saveLegacyGradebook(db, book);
  return book;
}

export async function listStudents(): Promise<Student[]> {
  const db = await ensureStorageReady();
  return (await getLegacyGradebook(db)).students;
}

export async function addStudent(student: Student): Promise<Student> {
  await updateLegacy((book) => {
    book.students.push(student);
  });
  return student;
}

export async function deleteStudent(id: string): Promise<void> {
  await updateLegacy((book) => {
    book.students = book.students.filter((s) => s.id !== id);
    book.grades = book.grades.filter((g) => g.studentId !== id);
  });
}

export async function listCourses(): Promise<Course[]> {
  const db = await ensureStorageReady();
  return (await getLegacyGradebook(db)).courses;
}

export async function addCourse(course: Course): Promise<Course> {
  await updateLegacy((book) => {
    book.courses.push(course);
  });
  return course;
}

export async function listGrades(): Promise<Grade[]> {
  const db = await ensureStorageReady();
  return (await getLegacyGradebook(db)).grades;
}

export async function addGrade(grade: Grade): Promise<Grade> {
  await updateLegacy((book) => {
    book.grades.push(grade);
  });
  return grade;
}

export async function getLegacySnapshot(): Promise<LegacyGradebook> {
  const db = await ensureStorageReady();
  return getLegacyGradebook(db);
}

export async function replaceLegacySnapshot(book: LegacyGradebook): Promise<void> {
  const db = await ensureStorageReady();
  await saveLegacyGradebook(db, book);
}
