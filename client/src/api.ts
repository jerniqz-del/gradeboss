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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getStudents: () => request<Student[]>("/students"),
  addStudent: (body: Partial<Student>) =>
    request<Student>("/students", { method: "POST", body: JSON.stringify(body) }),
  deleteStudent: (id: string) => request<void>(`/students/${id}`, { method: "DELETE" }),
  getCourses: () => request<Course[]>("/courses"),
  addCourse: (body: Partial<Course>) =>
    request<Course>("/courses", { method: "POST", body: JSON.stringify(body) }),
  getGrades: () => request<Grade[]>("/grades"),
  addGrade: (body: Partial<Grade>) =>
    request<Grade>("/grades", { method: "POST", body: JSON.stringify(body) }),
  getStats: () => request<Stats>("/stats"),
};
