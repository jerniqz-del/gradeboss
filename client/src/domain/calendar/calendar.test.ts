import { describe, expect, it } from "vitest";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { birthdayOccurrence, FEBRUARY_29_POLICY, virtualBirthdays } from "./birthdays";
import { composeCalendarEvents, filterCalendarEvents, monthGrid, upcomingEvents } from "./events";
import { mergeOfficialEvents, officialEvents, SOURCE_ID, SOURCE_PACK } from "./official";

function learner(overrides: Partial<Learner> = {}): Learner {
  return {
    id: "l1",
    lrn: "123456789012",
    lastName: "Reyes",
    firstName: "Maria",
    middleName: "Cruz",
    sex: "F",
    birthdate: "2012-02-29",
    ...overrides,
  };
}

function load(overrides: Partial<TeachingLoad> = {}): TeachingLoad {
  return {
    id: "load-1",
    gradeLevel: "7",
    section: "Luna",
    subject: "Mathematics",
    subjectGroup: "JHS_CORE",
    policy: "DO15_TRANSITION",
    schoolYear: "2026-2027",
    dashboardOrder: 1,
    learners: [learner()],
    assessments: [],
    scores: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("official DepEd calendar pack", () => {
  it("covers official SY 2026-2027 term dates and holidays", () => {
    const events = officialEvents();
    expect(SOURCE_PACK.schoolYear).toBe("2026-2027");
    expect(SOURCE_PACK.sourceId).toBe(SOURCE_ID);
    expect(events.find((item) => item.title === "Term 1")?.startDate).toBe("2026-06-08");
    expect(events.find((item) => item.title === "Term 1")?.endDate).toBe("2026-09-15");
    expect(events.find((item) => item.title === "Independence Day")?.date).toBe("2026-06-12");
    expect(events.find((item) => item.title === "Term 3")?.startDate).toBe("2027-01-04");
    expect(events.find((item) => item.title === "Chinese New Year")?.date).toBe("2027-02-06");
    expect(events.every((item) => item.immutable && item.sourceId === SOURCE_ID)).toBe(true);
  });

  it("merges official events without duplicating local ones", () => {
    const stored = [
      {
        id: `official-${SOURCE_ID}-term-1`,
        title: "stale official",
        type: "term" as const,
        date: "2020-01-01",
        startDate: "2020-01-01",
        endDate: "2020-01-01",
        sourceId: SOURCE_ID,
      },
      {
        id: "evt-local",
        title: "PTA meeting",
        type: "reminder" as const,
        date: "2026-07-10",
        startDate: "2026-07-10",
        endDate: "2026-07-10",
      },
    ];
    const merged = mergeOfficialEvents(stored);
    expect(merged.filter((item) => item.id === "evt-local")).toHaveLength(1);
    expect(merged.filter((item) => item.sourceId === SOURCE_ID).length).toBe(officialEvents().length);
    expect(merged.find((item) => item.id === `official-${SOURCE_ID}-term-1`)?.title).toBe("Term 1");
  });
});

describe("birthdayOccurrence — February 29 policy", () => {
  it("observes Feb 29 on Feb 28 in the non-leap school-year year", () => {
    expect(FEBRUARY_29_POLICY).toMatch(/February 28/);
    const occurrence = birthdayOccurrence("2012-02-29", "2026-2027");
    expect(occurrence).toEqual({ date: "2027-02-28", age: 15, observed: true });
  });

  it("keeps Feb 29 in a leap year", () => {
    const occurrence = birthdayOccurrence("2012-02-29", "2027-2028");
    expect(occurrence).toEqual({ date: "2028-02-29", age: 16, observed: false });
  });

  it("uses the first SY year for June–December birthdays", () => {
    expect(birthdayOccurrence("2013-06-15", "2026-2027")).toEqual({
      date: "2026-06-15",
      age: 13,
      observed: false,
    });
  });

  it("builds virtual birthday events and dedupes by LRN", () => {
    const events = virtualBirthdays(
      [
        load(),
        load({
          id: "load-2",
          subject: "English",
          learners: [learner({ id: "l2" })],
        }),
      ],
      { schoolYear: "2026-2027" },
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("birthday");
    expect(events[0].date).toBe("2027-02-28");
    expect(events[0].observed).toBe(true);
    expect(events[0].assignmentIds).toEqual(["load-1", "load-2"]);
    expect(events[0].title).toContain("Reyes");
  });
});

describe("calendar filters and month grid", () => {
  it("hides birthdays when the birthday filter is off", () => {
    const events = composeCalendarEvents([], [load()], { schoolYear: "2026-2027" });
    const hidden = filterCalendarEvents(events, {
      official: true,
      local: true,
      birthdays: false,
      loadId: "all",
    });
    expect(hidden.some((item) => item.type === "birthday")).toBe(false);
    expect(hidden.some((item) => item.type === "holiday")).toBe(true);
  });

  it("scopes birthdays to the selected teaching load", () => {
    const math = load();
    const english = load({
      id: "load-2",
      subject: "English",
      learners: [learner({ id: "l2", lrn: "999999999999", lastName: "Santos", firstName: "Juan", birthdate: "2013-08-01" })],
    });
    const events = composeCalendarEvents([], [math, english], { schoolYear: "2026-2027", loadId: "load-2" });
    const filtered = filterCalendarEvents(
      events,
      { official: true, local: true, birthdays: true, loadId: "load-2" },
      [math, english],
    );
    const birthdays = filtered.filter((item) => item.type === "birthday");
    expect(birthdays).toHaveLength(1);
    expect(birthdays[0].learnerName).toContain("Santos");
  });

  it("marks official dates on the month grid", () => {
    const events = officialEvents();
    const cells = monthGrid("2026-06", events, "2026-06-12");
    const independence = cells.find((cell) => cell.date === "2026-06-12");
    expect(independence?.isToday).toBe(true);
    expect(independence?.events.some((item) => item.title === "Independence Day")).toBe(true);
  });

  it("lists upcoming events from today forward", () => {
    const upcoming = upcomingEvents(officialEvents(), "2027-02-01", 3);
    expect(upcoming[0].date <= upcoming[upcoming.length - 1].endDate).toBe(true);
    expect(upcoming.some((item) => item.title === "Chinese New Year")).toBe(true);
  });

  it("shows ongoing multi-day events as today instead of their start date", () => {
    const upcoming = upcomingEvents(officialEvents(), "2026-09-06", 8);
    const term1 = upcoming.find((item) => item.title === "Term 1");
    expect(term1?.date).toBe("2026-09-06");
    expect(term1?.startDate).toBe("2026-06-08");
    expect(term1?.endDate).toBe("2026-09-15");
  });
});
