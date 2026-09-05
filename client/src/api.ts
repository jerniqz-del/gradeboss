/**
 * Local-only data layer.
 *
 * GradeBoss is offline-first: all data lives on this device (localStorage).
 * There is no backend and no sign-in. This module keeps the same `api` surface
 * the UI already uses, so components don't need to change.
 */

export interface Student {
  id: string;
  name: string;
  gradeLevel: number;
  email: string;
}

export interface Course {
  id: string;
  name: string;
  teacher: string;
  period: number;
}

export interface Grade {
  id: string;
  studentId: string;
  courseId: string;
  assignment: string;
  score: number;
  maxScore: number;
  date: string;
}

export interface Stats {
  totals: {
    students: number;
    courses: number;
    grades: number;
    overallAverage: number;
  };
  studentAverages: Array<{
    id: string;
    name: string;
    gradeLevel: number;
    average: number;
    letter: string;
    gradeCount: number;
  }>;
  courseAverages: Array<{
    id: string;
    name: string;
    teacher: string;
    average: number;
    letter: string;
    gradeCount: number;
  }>;
}

interface Database {
  students: Student[];
  courses: Course[];
  grades: Grade[];
}

const KEY = "gradeboss:data";

/** Deterministic starter data so a fresh device has something to explore. */
function seedData(): Database {
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

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as Database;
      return {
        students: db.students ?? [],
        courses: db.courses ?? [],
        grades: db.grades ?? [],
      };
    }
  } catch {
    // Corrupt/unavailable storage — fall back to a fresh seed.
  }
  const seeded = seedData();
  save(seeded);
  return seeded;
}

function save(db: Database): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Storage may be unavailable (private mode / quota); best effort.
  }
}

function percentage(g: Grade): number {
  if (g.maxScore <= 0) return 0;
  return (g.score / g.maxScore) * 100;
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function letterGrade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function computeStats(db: Database): Stats {
  const { students, courses, grades } = db;

  const overallAverage = grades.length
    ? round(grades.reduce((sum, g) => sum + percentage(g), 0) / grades.length)
    : 0;

  const studentAverages = students
    .map((student) => {
      const own = grades.filter((g) => g.studentId === student.id);
      const avg = own.length
        ? round(own.reduce((sum, g) => sum + percentage(g), 0) / own.length)
        : 0;
      return {
        id: student.id,
        name: student.name,
        gradeLevel: student.gradeLevel,
        average: avg,
        letter: own.length ? letterGrade(avg) : "-",
        gradeCount: own.length,
      };
    })
    .sort((a, b) => b.average - a.average);

  const courseAverages = courses.map((course) => {
    const own = grades.filter((g) => g.courseId === course.id);
    const avg = own.length
      ? round(own.reduce((sum, g) => sum + percentage(g), 0) / own.length)
      : 0;
    return {
      id: course.id,
      name: course.name,
      teacher: course.teacher,
      average: avg,
      letter: own.length ? letterGrade(avg) : "-",
      gradeCount: own.length,
    };
  });

  return {
    totals: {
      students: students.length,
      courses: courses.length,
      grades: grades.length,
      overallAverage,
    },
    studentAverages,
    courseAverages,
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const api = {
  async getStudents(): Promise<Student[]> {
    return load().students;
  },
  async addStudent(body: Partial<Student>): Promise<Student> {
    const db = load();
    const student: Student = {
      id: crypto.randomUUID(),
      name: str(body.name) || "Unnamed",
      gradeLevel: Number(body.gradeLevel) || 9,
      email: str(body.email),
    };
    db.students.push(student);
    save(db);
    return student;
  },
  async deleteStudent(id: string): Promise<void> {
    const db = load();
    db.students = db.students.filter((s) => s.id !== id);
    save(db);
  },
  async getCourses(): Promise<Course[]> {
    return load().courses;
  },
  async addCourse(body: Partial<Course>): Promise<Course> {
    const db = load();
    const course: Course = {
      id: crypto.randomUUID(),
      name: str(body.name) || "Untitled course",
      teacher: str(body.teacher) || "Unassigned",
      period: Number(body.period) || 1,
    };
    db.courses.push(course);
    save(db);
    return course;
  },
  async getGrades(): Promise<Grade[]> {
    return load().grades;
  },
  async addGrade(body: Partial<Grade>): Promise<Grade> {
    const db = load();
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
    db.grades.push(grade);
    save(db);
    return grade;
  },
  async getStats(): Promise<Stats> {
    return computeStats(load());
  },
};
