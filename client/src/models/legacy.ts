/** Pre-Phase-1 flat gradebook types kept for UI compatibility until Phase 3. */

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

export interface LegacyGradebook {
  students: Student[];
  courses: Course[];
  grades: Grade[];
}
