import { describe, expect, it } from "vitest";
import { emptyAttendance } from "../../models/attendance";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { createSampleTeachingLoad } from "../../storage/seed";
import {
  applyRollCall,
  attendanceDisplay,
  attendanceOf,
  buildSf2Payload,
  cellStatus,
  clearDate,
  computeClassAttendance,
  computeLearnerAttendance,
  cycleMark,
  isPresentForSf2,
  learnerMatchesFilters,
  monthDates,
  monthDayCount,
  pruneAttendanceForLearner,
  setLearnerMark,
  setNoClassDay,
  sf2PresentTotalsBySex,
  shiftMonth,
} from "./index";

function learner(id: string, sex: "M" | "F", last = id, first = "Test"): Learner {
  return {
    id,
    lrn: id.padStart(12, "0"),
    lastName: last,
    firstName: first,
    middleName: "",
    sex,
    birthdate: "2012-01-01",
  };
}

function loadWith(learners: Learner[], attendance: TeachingLoad["attendance"]): TeachingLoad {
  return {
    id: "att-load",
    gradeLevel: "10",
    section: "Rizal",
    subject: "Mathematics",
    subjectGroup: "JHS_CORE",
    policy: "DO15_TRANSITION",
    schoolYear: "2026-2027",
    dashboardOrder: 0,
    learners,
    assessments: [],
    scores: {},
    attendance,
    sf1Meta: { schoolName: "Sample NHS", schoolId: "123456", adviser: "Ms. Cruz" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("attendance calendar", () => {
  it("lists every day in September 2026", () => {
    const dates = monthDates("2026-09");
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-09-01");
    expect(dates[29]).toBe("2026-09-30");
    expect(monthDayCount("2026-02")).toBe(28);
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("attendance marks", () => {
  it("treats unmarked session learners as present", () => {
    const attendance = applyRollCall(emptyAttendance(), "2026-09-01", { L1: "absent" });
    expect(cellStatus(attendance, "L1", "2026-09-01")).toBe("absent");
    expect(cellStatus(attendance, "L2", "2026-09-01")).toBe("present");
    expect(cellStatus(attendance, "L1", "2026-09-02")).toBe("");
  });

  it("cycles present → tardy → absent → excused → present", () => {
    expect(cycleMark("")).toBe("tardy");
    expect(cycleMark("present")).toBe("tardy");
    expect(cycleMark("tardy")).toBe("absent");
    expect(cycleMark("absent")).toBe("excused");
    expect(cycleMark("excused")).toBe("present");
  });

  it("marks a no-class day and clears learner entries", () => {
    let attendance = applyRollCall(emptyAttendance(), "2026-09-08", {
      L1: "absent",
      L2: "excused",
    });
    attendance = setNoClassDay(attendance, "2026-09-08", true, "School activity");
    expect(cellStatus(attendance, "L1", "2026-09-08")).toBe("no-class");
    expect(attendance.sessions).not.toContain("2026-09-08");
    expect(attendance.marks).toEqual({});
  });

  it("clears a date and prunes one learner", () => {
    let attendance = applyRollCall(emptyAttendance(), "2026-09-01", { L1: "absent", L2: "tardy" });
    attendance = pruneAttendanceForLearner(attendance, "L1");
    expect(cellStatus(attendance, "L1", "2026-09-01")).toBe("present");
    expect(cellStatus(attendance, "L2", "2026-09-01")).toBe("tardy");
    attendance = clearDate(attendance, "2026-09-01");
    expect(cellStatus(attendance, "L2", "2026-09-01")).toBe("");
  });

  it("keeps excused reasons only while the mark is excused", () => {
    let attendance = setLearnerMark(emptyAttendance(), "L1", "2026-09-04", "excused", "Medical");
    expect(attendance.excuseReasons["L1|2026-09-04"]).toBe("Medical");
    attendance = setLearnerMark(attendance, "L1", "2026-09-04", "present");
    expect(attendance.excuseReasons["L1|2026-09-04"]).toBeUndefined();
  });
});

describe("attendance statistics", () => {
  const learners = [learner("L1", "M", "Santos", "Juan"), learner("L2", "F", "Reyes", "Maria")];
  const attendance = applyRollCall(
    applyRollCall(emptyAttendance(), "2026-09-01", { L1: "present", L2: "present" }),
    "2026-09-02",
    { L1: "absent", L2: "tardy" },
  );

  it("counts learner buckets and absence rate", () => {
    const juan = computeLearnerAttendance(attendance, "L1", { month: "2026-09" });
    expect(juan).toMatchObject({ checked: 2, present: 1, absent: 1, tardy: 0, absenceRate: 50 });
  });

  it("aggregates class totals", () => {
    const { totals } = computeClassAttendance(attendance, learners, { month: "2026-09" });
    expect(totals.sessionCount).toBe(2);
    expect(totals.present).toBe(2);
    expect(totals.absent).toBe(1);
    expect(totals.tardy).toBe(1);
    expect(totals.checked).toBe(4);
  });

  it("filters learners by status and name", () => {
    expect(learnerMatchesFilters(learners[0], attendance, { month: "2026-09" }, { status: "absent" })).toBe(true);
    expect(learnerMatchesFilters(learners[1], attendance, { month: "2026-09" }, { status: "absent" })).toBe(false);
    expect(learnerMatchesFilters(learners[1], attendance, { month: "2026-09" }, { query: "reyes" })).toBe(true);
  });
});

describe("SF2 present counts", () => {
  const learners = [
    learner("M1", "M", "Santos", "Juan"),
    learner("M2", "M", "Mendoza", "Carlo"),
    learner("F1", "F", "Reyes", "Maria"),
    learner("F2", "F", "Garcia", "Ana"),
    learner("F3", "F", "Aquino", "Ella"),
  ];

  const attendance = setNoClassDay(
    applyRollCall(
      applyRollCall(
        applyRollCall(
          applyRollCall(emptyAttendance(), "2026-09-01", {}),
          "2026-09-02",
          { M1: "absent" },
        ),
        "2026-09-03",
        { F1: "tardy" },
      ),
      "2026-09-04",
      { F2: "excused" },
    ),
    "2026-09-07",
    true,
    "School activity",
  );

  it("counts tardy as present and excused as not present", () => {
    expect(isPresentForSf2("tardy")).toBe(true);
    expect(isPresentForSf2("excused")).toBe(false);
    expect(isPresentForSf2("absent")).toBe(false);
    expect(attendanceDisplay("present")).toBe("/");
    expect(attendanceDisplay("absent")).toBe("X");
  });

  it("matches daily male/female/combined totals to the grid", () => {
    const { totals } = sf2PresentTotalsBySex(learners, attendance, "2026-09");
    expect(totals.male["2026-09-01"]).toBe(2);
    expect(totals.female["2026-09-01"]).toBe(3);
    expect(totals.all["2026-09-01"]).toBe(5);
    expect(totals.male["2026-09-02"]).toBe(1);
    expect(totals.female["2026-09-02"]).toBe(3);
    expect(totals.all["2026-09-02"]).toBe(4);
    expect(totals.all["2026-09-03"]).toBe(5);
    expect(totals.female["2026-09-04"]).toBe(2);
    expect(totals.all["2026-09-04"]).toBe(4);
    expect(totals.all["2026-09-07"]).toBe("");
    expect(totals.all["2026-09-05"]).toBe("");
  });

  it("builds an SF2 payload whose present counts match the grid", () => {
    const payload = buildSf2Payload(loadWith(learners, attendance), "2026-09");
    expect(payload.title).toMatch(/^School Form 2 \(SF2\)/);
    expect(payload.summary.enrollmentMale).toBe(2);
    expect(payload.summary.enrollmentFemale).toBe(3);
    expect(payload.learners).toHaveLength(5);
    expect(payload.learners[0].sex).toBe("M");
    expect(payload.totals.all["2026-09-02"]).toBe(4);
    const ana = payload.learners.find((row) => row.id === "F2");
    expect(ana?.marks["2026-09-04"]).toBe("E");
    expect(payload.learners.find((row) => row.id === "M1")?.marks["2026-09-02"]).toBe("X");
  });
});

describe("seed load attendance", () => {
  it("ships sample September marks that persist with the teaching load", () => {
    const seed = createSampleTeachingLoad();
    const attendance = attendanceOf(seed);
    expect(attendance.sessions.length).toBeGreaterThan(0);
    const { totals } = computeClassAttendance(attendance, seed.learners, { month: "2026-09" });
    expect(totals.checked).toBeGreaterThan(0);
    expect(totals.sessionCount).toBeGreaterThan(0);
  });
});
