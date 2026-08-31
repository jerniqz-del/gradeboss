import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Express } from "express";
import { Store } from "./store.js";
import type { Course, Grade, Student } from "./types.js";

function percentage(grade: Grade): number {
  if (grade.maxScore <= 0) return 0;
  return (grade.score / grade.maxScore) * 100;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function letterGrade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

export function createApp(store: Store): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "gradeboss", time: new Date().toISOString() });
  });

  app.get("/api/students", (_req, res) => {
    res.json(store.getAll().students);
  });

  app.post("/api/students", (req, res) => {
    const { name, gradeLevel, email } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const student: Student = {
      id: randomUUID(),
      name: name.trim(),
      gradeLevel: Number(gradeLevel) || 9,
      email: typeof email === "string" ? email.trim() : "",
    };
    store.add("students", student);
    res.status(201).json(student);
  });

  app.delete("/api/students/:id", (req, res) => {
    const removed = store.remove("students", req.params.id);
    if (!removed) return res.status(404).json({ error: "student not found" });
    res.status(204).end();
  });

  app.get("/api/courses", (_req, res) => {
    res.json(store.getAll().courses);
  });

  app.post("/api/courses", (req, res) => {
    const { name, teacher, period } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const course: Course = {
      id: randomUUID(),
      name: name.trim(),
      teacher: typeof teacher === "string" ? teacher.trim() : "Unassigned",
      period: Number(period) || 1,
    };
    store.add("courses", course);
    res.status(201).json(course);
  });

  app.get("/api/grades", (_req, res) => {
    res.json(store.getAll().grades);
  });

  app.post("/api/grades", (req, res) => {
    const { studentId, courseId, assignment, score, maxScore } = req.body ?? {};
    const db = store.getAll();
    if (!db.students.some((s) => s.id === studentId)) {
      return res.status(400).json({ error: "unknown studentId" });
    }
    if (!db.courses.some((c) => c.id === courseId)) {
      return res.status(400).json({ error: "unknown courseId" });
    }
    const numericScore = Number(score);
    const numericMax = Number(maxScore) || 100;
    if (Number.isNaN(numericScore) || numericScore < 0) {
      return res.status(400).json({ error: "score must be a non-negative number" });
    }
    const grade: Grade = {
      id: randomUUID(),
      studentId,
      courseId,
      assignment: typeof assignment === "string" && assignment.trim() ? assignment.trim() : "Assignment",
      score: numericScore,
      maxScore: numericMax,
      date: new Date().toISOString().slice(0, 10),
    };
    store.add("grades", grade);
    res.status(201).json(grade);
  });

  app.get("/api/stats", (_req, res) => {
    const { students, courses, grades } = store.getAll();

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

    res.json({
      totals: {
        students: students.length,
        courses: courses.length,
        grades: grades.length,
        overallAverage,
      },
      studentAverages,
      courseAverages,
    });
  });

  return app;
}
