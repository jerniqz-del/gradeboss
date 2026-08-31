export type Role = "teacher" | "admin";

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

export interface Database {
  students: Student[];
  courses: Course[];
  grades: Grade[];
}
