import { describe, expect, it } from "vitest";
import { createDefaultProfile } from "../../models/teacher-profile";
import { GRADE_TRANSFER_FORMAT, GRADE_TRANSFER_SCHEMA_VERSION, createEmptyAdvisoryStore } from "../../models/advisory";
import { createTeachingLoad } from "../../features/teaching-loads/create-load";
import { createLearner } from "../../features/roster/learner";
import { scoreKey } from "../../models/assessment";
import {
  applyConflictDecisionToAll,
  applyGradeTransferImport,
  buildGradeTransferFromLoad,
  planGradeTransferImport,
  setConflictDecision,
  validateGradeTransfer,
} from "./transfer";
import { addAdvisoryLearnerFromRoster, createAdvisoryClass } from "./store";
import { calculateGeneralAverage } from "./average";

function scoredMathLoad() {
  const load = createTeachingLoad({
    gradeLevel: "7",
    section: "Rizal",
    subject: "Mathematics",
    schoolYear: "2026-2027",
  });
  const juan = createLearner({
    lrn: "123456789012",
    lastName: "Cruz",
    firstName: "Juan",
    middleName: "Santos",
    sex: "M",
  });
  const scored = { ...load, learners: [juan] };
  const assessments = scored.assessments.filter((item) => item.term === "1");
  assessments.forEach((item) => {
    item.maxScore = 100;
    scored.scores[scoreKey(juan.id, item.id)] = 90;
  });
  return scored;
}

describe("grade transfer schema v1.0", () => {
  it("exports a valid file and round-trips through the validator", () => {
    const payload = buildGradeTransferFromLoad(scoredMathLoad(), createDefaultProfile(), "1", {
      exportId: "export-1",
      exportedAt: "2026-09-06T01:00:00.000Z",
    });
    expect(payload.format).toBe(GRADE_TRANSFER_FORMAT);
    expect(payload.schemaVersion).toBe(GRADE_TRANSFER_SCHEMA_VERSION);
    expect(payload.learners).toHaveLength(1);
    expect(payload.learners[0].finalGrade).toBeGreaterThanOrEqual(60);
    expect(validateGradeTransfer(payload).isValid).toBe(true);
    expect(validateGradeTransfer(JSON.parse(JSON.stringify(payload))).isValid).toBe(true);
  });

  it("rejects an unknown format or schema", () => {
    expect(validateGradeTransfer({ format: "nope", schemaVersion: "1.0" }).isValid).toBe(false);
    expect(validateGradeTransfer({ format: GRADE_TRANSFER_FORMAT, schemaVersion: "2.0" }).isValid).toBe(false);
  });

  it("imports matching LRN grades and computes the expected General Average", () => {
    let store = createEmptyAdvisoryStore();
    store = createAdvisoryClass(store, {
      schoolYear: "2026-2027",
      gradeLevel: "7",
      section: "Rizal",
      adviserName: "Ada",
    });
    const advisoryClass = store.classes[0];
    const load = scoredMathLoad();
    store = addAdvisoryLearnerFromRoster(store, advisoryClass.id, load.learners[0]);

    const subjects = ["Mathematics", "Filipino", "English", "Science", "Araling Panlipunan", "Values Education", "Technology and Livelihood Education (TLE)", "Music & Arts", "PE & Health"];
    for (const name of subjects) {
      const subject = store.subjects.find((item) => item.subjectName === name);
      const payload = {
        ...buildGradeTransferFromLoad({ ...load, subject: name }, createDefaultProfile(), "1", { exportId: `e-${name}-1` }),
        subject: { name, normalizedKey: name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim() },
      };
      // Reuse the same numeric grade for every subject/term so GA is exact.
      payload.learners[0].finalGrade = 88;
      for (const term of ["1", "2", "3"] as const) {
        const file = { ...payload, exportId: `e-${name}-${term}`, term: { number: Number(term) as 1 | 2 | 3, label: `Term ${term}` } };
        file.subject.normalizedKey = store.subjects.find((item) => item.subjectName === name)!.normalizedSubjectKey;
        const plan = planGradeTransferImport(store, advisoryClass, file, `${name}.json`);
        expect(plan.errors).toEqual([]);
        expect(plan.canImport).toBe(true);
        store = applyGradeTransferImport(store, plan);
        void subject;
      }
    }

    const ga = calculateGeneralAverage(
      store.grades,
      store.learners[0].id,
      store.subjects.filter((item) => item.advisoryClassId === advisoryClass.id),
    );
    expect(ga).toBe(88);
  });

  it("requires an explicit keep-or-replace decision for an existing grade", () => {
    let store = createEmptyAdvisoryStore();
    store = createAdvisoryClass(store, {
      schoolYear: "2026-2027",
      gradeLevel: "7",
      section: "Rizal",
      adviserName: "Ada",
    });
    const advisoryClass = store.classes[0];
    const load = scoredMathLoad();
    store = addAdvisoryLearnerFromRoster(store, advisoryClass.id, load.learners[0]);
    const first = buildGradeTransferFromLoad(load, createDefaultProfile(), "1", { exportId: "first" });
    first.subject.normalizedKey = store.subjects.find((item) => item.subjectName === "Mathematics")!.normalizedSubjectKey;
    store = applyGradeTransferImport(store, planGradeTransferImport(store, advisoryClass, first, "first.json"));

    const second = { ...first, exportId: "second", learners: [{ ...first.learners[0], finalGrade: 92 }] };
    const plan = planGradeTransferImport(store, advisoryClass, second, "second.json");
    expect(plan.canImport).toBe(false);
    expect(plan.conflictCount).toBe(1);

    const keep = setConflictDecision(plan, 0, "keep");
    expect(keep.canImport).toBe(true);
    const kept = applyGradeTransferImport(store, keep);
    expect(kept.grades[0].finalGrade).toBe(first.learners[0].finalGrade);

    const replace = applyConflictDecisionToAll(plan, "replace");
    const replaced = applyGradeTransferImport(store, replace);
    expect(replaced.grades[0].finalGrade).toBe(92);
  });
});
