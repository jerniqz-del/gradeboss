import { describe, expect, it } from "vitest";
import { createEmptyAdvisoryStore, type AdvisoryImportBatch, type AdvisoryLearner, type AdvisorySubject } from "../../models/advisory";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { buildAttention, pendingSf1Imports } from "./attention";
import { buildComponentPerformance, buildScoreCoverage } from "./analytics";
import { workplaceSnapshot } from "./snapshot";

function learner(id: string, overrides: Partial<Learner> = {}): Learner {
  return {
    id,
    lrn: `lrn-${id}`,
    lastName: "Test",
    firstName: id,
    middleName: "",
    sex: "F",
    birthdate: "2012-01-01",
    ...overrides,
  };
}

function load(overrides: Partial<TeachingLoad> = {}): TeachingLoad {
  return {
    id: "load-1",
    gradeLevel: "7",
    section: "Luna",
    subject: "English",
    subjectGroup: "JHS_CORE",
    policy: "DO15_TRANSITION",
    schoolYear: "2026-2027",
    dashboardOrder: 1,
    learners: [learner("a"), learner("b")],
    assessments: [
      { id: "ww1", term: "1", component: "WW", title: "WW 1", maxScore: 20, date: "2026-06-20" },
      { id: "pt1", term: "1", component: "PT", title: "PT 1", maxScore: 50, date: "2026-07-01" },
      { id: "st1", term: "1", component: "ST1", title: "ST1", maxScore: 40, date: "2026-07-06" },
      { id: "st2", term: "1", component: "ST2", title: "ST2", maxScore: 40, date: "2026-07-28" },
      { id: "te", term: "1", component: "TE", title: "TE", maxScore: 50, date: "2026-08-28" },
    ],
    scores: {
      "a|ww1": 16,
      "b|ww1": 18,
      "a|pt1": 40,
      "b|pt1": 45,
      "a|st1": 30,
      "b|st1": 32,
      "a|st2": 28,
      "b|st2": 36,
      "a|te": 40,
      "b|te": 45,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("workplace attention", () => {
  it("flags missing HPS and incomplete past-due scores", () => {
    const attention = buildAttention({
      loads: [
        load({
          assessments: [
            { id: "ww1", term: "1", component: "WW", title: "WW 1", maxScore: 0, date: "2026-06-20" },
            { id: "pt1", term: "1", component: "PT", title: "PT 1", maxScore: 50, date: "2026-07-01" },
          ],
          scores: { "a|pt1": 40 },
        }),
      ],
      today: "2026-07-02",
      currentTerm: "1",
    });
    expect(attention.some((item) => item.type === "missing-hps")).toBe(true);
    expect(attention.some((item) => item.type === "incomplete-scores" && item.count >= 1)).toBe(true);
  });

  it("includes advisory conflicts and pending SF1 imports", () => {
    const store = createEmptyAdvisoryStore();
    store.classes = [
      {
        id: "adv-1",
        schoolYear: "2026-2027",
        gradeLevel: "7",
        section: "Luna",
        adviserName: "A",
        schoolName: "",
        schoolId: "",
        district: "",
        division: "",
        region: "",
        isSpecialClass: false,
        specialProgramName: "",
        isActive: true,
        isArchived: false,
        createdAt: "",
        updatedAt: "",
      },
    ];
    store.importBatches = [
      {
        id: "batch-1",
        advisoryClassId: "adv-1",
        conflictCount: 2,
        unmatchedCount: 1,
        status: "pending",
      } as AdvisoryImportBatch,
    ];
    store.learners = [{ id: "al-1", advisoryClassId: "adv-1", enrollmentStatus: "active" } as AdvisoryLearner];
    store.subjects = [{ id: "as-1", advisoryClassId: "adv-1", isArchived: false } as AdvisorySubject];

    const snapshot = workplaceSnapshot({
      loads: [load()],
      schoolYear: "2026-2027",
      currentTerm: "1",
      advisory: store,
      schoolClasses: [
        {
          id: "cls-1",
          createdAt: 1,
          source: "sf1.xlsx",
          schoolId: "",
          schoolName: "",
          region: "",
          division: "",
          district: "",
          schoolYear: "2026-2027",
          gradeLevel: "8",
          section: "Rizal",
          adviser: "",
          schoolHead: "",
          learners: [
                  {
                    lrn: "1",
                    lastName: "A",
                    firstName: "B",
                    middleName: "",
                    sex: "M",
                    birthdate: "2012-01-01",
                    age: "",
                    religion: "",
                    motherTongue: "",
                    modality: "",
                    remarks: "",
                  },
                ],
        },
      ],
      now: "2026-06-10",
    });
    expect(snapshot.attention.some((item) => item.type === "advisory-conflicts")).toBe(true);
    expect(snapshot.attention.some((item) => item.type === "pending-import")).toBe(true);
    expect(
      pendingSf1Imports(
        [
          {
            id: "cls-1",
            createdAt: 1,
            source: "sf1.xlsx",
            schoolId: "",
            schoolName: "",
            region: "",
            division: "",
            district: "",
            schoolYear: "2026-2027",
            gradeLevel: "8",
            section: "Rizal",
            adviser: "",
            schoolHead: "",
            learners: [
                  {
                    lrn: "1",
                    lastName: "A",
                    firstName: "B",
                    middleName: "",
                    sex: "M",
                    birthdate: "2012-01-01",
                    age: "",
                    religion: "",
                    motherTongue: "",
                    modality: "",
                    remarks: "",
                  },
                ],
          },
        ],
        [load()],
      ),
    ).toHaveLength(1);
  });
});

describe("workplace analytics", () => {
  it("computes score coverage and WW/PT/exam component percents", () => {
    const sample = load();
    const coverage = buildScoreCoverage([sample], "1");
    expect(coverage.expected).toBe(10);
    expect(coverage.entered).toBe(10);
    expect(coverage.percent).toBe(100);

    const performance = buildComponentPerformance(sample, "1");
    expect(performance.written.percent).toBe(85);
    expect(performance.performance.percent).toBe(85);
    expect(performance.quarterly.percent).toBe(81);
  });
});
