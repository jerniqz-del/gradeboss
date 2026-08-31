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

const CACHE_PREFIX = "gradeboss:cache:";

function readCache<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(path: string, data: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + path, JSON.stringify(data));
  } catch {
    // Storage may be unavailable (private mode / quota); caching is best-effort.
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (networkError) {
    // Offline (or the network is unreachable): fall back to the last data we
    // successfully fetched so the app stays usable without a connection.
    if (method === "GET") {
      const cached = readCache<T>(path);
      if (cached !== null) return cached;
    }
    throw networkError;
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T;
  if (method === "GET") writeCache(path, data);
  return data;
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
