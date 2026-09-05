import { describe, expect, it } from "vitest";
import type { SchoolClass } from "../classes";
import { LEGACY_DATA_KEY, LEGACY_CLASSES_KEY, readLocalStorageSnapshot, schoolClassToTeachingLoad } from "../storage/migrate";
import { ensureStorageReady } from "../storage/init";
import { countTeachingLoads, listTeachingLoads } from "../storage/repositories/teaching-loads";
import { getLegacySnapshot } from "../storage/repositories/legacy-gradebook";
import { getSchemaMeta, openGradeBossDb } from "../storage/db";

describe("storage migration", () => {
  it("seeds sample teaching load on fresh install", async () => {
    await ensureStorageReady();
    const loads = await listTeachingLoads();
    expect(loads.length).toBeGreaterThanOrEqual(1);
    const math = loads.find((l) => l.subject === "Mathematics");
    expect(math).toBeDefined();
    expect(math!.learners.length).toBeGreaterThan(0);
    expect(math!.assessments.some((a: { term: string; component: string }) => a.term === "1" && a.component === "WW")).toBe(true);
    expect(Object.keys(math!.scores).length).toBeGreaterThan(0);

    const legacy = await getLegacySnapshot();
    expect(legacy.students.length).toBeGreaterThan(0);
    expect(legacy.courses.length).toBeGreaterThan(0);

    const db = await openGradeBossDb();
    const meta = await getSchemaMeta(db);
    expect(meta?.migrationSource).toBe("seed");
  });

  it("migrates legacy localStorage gradebook without loss", async () => {
    localStorage.setItem(
      LEGACY_DATA_KEY,
      JSON.stringify({
        students: [{ id: "u1", name: "Test User", gradeLevel: 10, email: "" }],
        courses: [{ id: "u2", name: "Science", teacher: "T", period: 1 }],
        grades: [
          {
            id: "u3",
            studentId: "u1",
            courseId: "u2",
            assignment: "Quiz",
            score: 80,
            maxScore: 100,
            date: "2026-03-01",
          },
        ],
      }),
    );

    await ensureStorageReady();
    const legacy = await getLegacySnapshot();
    expect(legacy.students).toHaveLength(1);
    expect(legacy.students[0].name).toBe("Test User");
    expect(legacy.grades).toHaveLength(1);
    expect(legacy.grades[0].score).toBe(80);
  });

  it("creates teaching loads from SF1 school classes", async () => {
    const cls: SchoolClass = {
      id: "cls-1",
      createdAt: Date.now(),
      source: "sf1.xlsx",
      schoolId: "123",
      schoolName: "Demo NHS",
      region: "IV-A",
      division: "Laguna",
      district: "Calamba",
      schoolYear: "2026-2027",
      gradeLevel: "7",
      section: "Mabini",
      adviser: "Adviser Name",
      schoolHead: "Head Name",
      learners: [
        {
          lrn: "123456789012",
          lastName: "Dela Cruz",
          firstName: "Juan",
          middleName: "Santos",
          sex: "M",
          birthdate: "2012-05-01",
          age: "13",
          religion: "",
          motherTongue: "Tagalog",
          modality: "",
          remarks: "",
        },
      ],
    };

    localStorage.setItem(LEGACY_CLASSES_KEY, JSON.stringify([cls]));
    await ensureStorageReady();

    const loads = await listTeachingLoads();
    const linked = loads.find((l) => l.sourceClassId === "cls-1");
    expect(linked).toBeDefined();
    expect(linked!.section).toBe("Mabini");
    expect(linked!.learners[0].lastName).toBe("Dela Cruz");
    expect(await countTeachingLoads()).toBeGreaterThanOrEqual(1);
  });
});

describe("schoolClassToTeachingLoad", () => {
  it("assigns DO15_TRANSITION policy for grade 7", () => {
    const load = schoolClassToTeachingLoad({
      id: "x",
      createdAt: 1,
      source: "f",
      schoolId: "",
      schoolName: "",
      region: "",
      division: "",
      district: "",
      schoolYear: "2026-2027",
      gradeLevel: "7",
      section: "A",
      adviser: "",
      schoolHead: "",
      learners: [],
    });
    expect(load.policy).toBe("DO15_TRANSITION");
    expect(load.subjectGroup).toBe("JHS_CORE");
  });
});

describe("readLocalStorageSnapshot", () => {
  it("returns empty snapshot when storage is blank", () => {
    const snap = readLocalStorageSnapshot();
    expect(snap.legacy.students).toEqual([]);
    expect(snap.schoolClasses).toEqual([]);
  });
});
