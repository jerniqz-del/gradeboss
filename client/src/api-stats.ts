import type { Grade, LegacyGradebook, Student } from "./models/legacy";

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

export function computeStats(db: LegacyGradebook): Stats {
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

export type { Student };
