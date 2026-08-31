import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, test } from "node:test";
import request from "supertest";
import { createApp } from "./app.js";
import { Store } from "./store.js";

describe("GradeBoss API", () => {
  let app: ReturnType<typeof createApp>;

  before(() => {
    const dir = mkdtempSync(join(tmpdir(), "gradeboss-test-"));
    const store = new Store(join(dir, "db.json"));
    app = createApp(store);
  });

  test("health check responds ok", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });

  test("returns seeded students", async () => {
    const res = await request(app).get("/api/students");
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 5);
  });

  test("computes overall stats from seed data", async () => {
    const res = await request(app).get("/api/stats");
    assert.equal(res.status, 200);
    assert.equal(res.body.totals.students, 5);
    assert.ok(res.body.totals.overallAverage > 0);
    assert.equal(res.body.studentAverages.length, 5);
  });

  test("creates a student", async () => {
    const res = await request(app)
      .post("/api/students")
      .send({ name: "Test Student", gradeLevel: 9, email: "t@school.edu" });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, "Test Student");
    assert.ok(res.body.id);
  });

  test("rejects a student without a name", async () => {
    const res = await request(app).post("/api/students").send({ gradeLevel: 9 });
    assert.equal(res.status, 400);
  });

  test("adds a grade and reflects it in stats", async () => {
    const create = await request(app)
      .post("/api/grades")
      .send({ studentId: "s4", courseId: "c1", assignment: "Makeup Quiz", score: 100, maxScore: 100 });
    assert.equal(create.status, 201);

    const stats = await request(app).get("/api/stats");
    const noah = stats.body.studentAverages.find((s: { id: string }) => s.id === "s4");
    assert.ok(noah.gradeCount >= 2);
  });

  test("rejects a grade for an unknown student", async () => {
    const res = await request(app)
      .post("/api/grades")
      .send({ studentId: "nope", courseId: "c1", score: 50 });
    assert.equal(res.status, 400);
  });
});
