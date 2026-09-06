/**
 * Calendar merge, filters, and month-grid helpers.
 *
 * Official merge / class filters follow eclassrecord `official-calendar-pack.js`
 * and `dashboard-workplace.js` (`buildUpcoming` filter flags).
 */

import type { CalendarEvent, CalendarEventType, CalendarFilters } from "../../models/calendar";
import type { TeachingLoad } from "../../models/teaching-load";
import { monthDates, monthFromDate, parseIsoDate, todayIso } from "../attendance/calendar";
import { isOfficialEvent, mergeOfficialEvents } from "./official";
import { virtualBirthdays } from "./birthdays";

export const LEGACY_CALENDAR_IDS = new Set([
  "deped-start",
  "deped-q1-exam-1",
  "deped-q1-exam-2",
  "holiday-ninoy",
  "holiday-heroes",
  "deped-q2-exam-1",
  "deped-q2-exam-2",
  "holiday-saints",
  "holiday-souls",
  "holiday-bonifacio",
  "holiday-christmas",
  "holiday-rizal",
  "holiday-newyear",
  "deped-q3-exam-1",
  "deped-q3-exam-2",
  "deped-end",
]);

const ASSESSMENT_TYPES = new Set<CalendarEventType>(["assessment", "exam", "national-assessment"]);
const ACTIVITY_TYPES = new Set<CalendarEventType>([
  "term",
  "opening",
  "instruction",
  "end-of-term",
  "aral",
  "report-card",
  "inset",
  "wellness",
  "break",
  "eosy",
  "reminder",
  "milestone",
]);

export function dateKey(value: string | undefined): string {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match.slice(1).join("-") : "";
}

export function eventTouchesDate(event: CalendarEvent, date: string): boolean {
  const start = dateKey(event.startDate || event.date);
  const end = dateKey(event.endDate || event.date || event.startDate) || start;
  return Boolean(start && end && date >= start && date <= end);
}

export function isRuntimeMockRecord(item: CalendarEvent): boolean {
  const id = String(item.id || "").toLowerCase();
  return (
    LEGACY_CALENDAR_IDS.has(id) ||
    /^(mock|sample|demo|test)(?:[-_:]|$)/.test(id)
  );
}

export function isBirthdayEvent(event: CalendarEvent): boolean {
  return event.type === "birthday" || event.virtual === true;
}

export function composeCalendarEvents(
  stored: CalendarEvent[] | undefined,
  loads: TeachingLoad[],
  options: { schoolYear?: string; loadId?: string } = {},
): CalendarEvent[] {
  const merged = mergeOfficialEvents(stored).filter((item) => !isRuntimeMockRecord(item));
  const birthdays = virtualBirthdays(loads, options);
  return merged.concat(birthdays);
}

export function filterCalendarEvents(
  events: CalendarEvent[],
  filters: CalendarFilters,
  loads: TeachingLoad[] = [],
): CalendarEvent[] {
  const loadId = filters.loadId && filters.loadId !== "all" ? filters.loadId : "";
  const load = loadId ? loads.find((item) => item.id === loadId) : undefined;

  return events.filter((event) => {
    if (isOfficialEvent(event)) {
      if (!filters.official) return false;
    } else if (isBirthdayEvent(event)) {
      if (!filters.birthdays) return false;
    } else if (!filters.local) {
      return false;
    }

    if (!loadId) return true;
    if (isOfficialEvent(event)) return true;
    if (event.loadId && event.loadId !== loadId) return false;
    if (event.assignmentIds && event.assignmentIds.length > 0 && !event.assignmentIds.includes(loadId)) {
      return false;
    }
    if (isBirthdayEvent(event) && load) {
      return (event.assignmentIds || []).includes(load.id);
    }
    return true;
  });
}

export function assessmentEventsForLoads(
  loads: TeachingLoad[],
  filters: CalendarFilters,
): CalendarEvent[] {
  const loadId = filters.loadId && filters.loadId !== "all" ? filters.loadId : "";
  const events: CalendarEvent[] = [];
  for (const load of loads) {
    if (loadId && load.id !== loadId) continue;
    for (const assessment of load.assessments || []) {
      const date = dateKey(assessment.date);
      if (!date) continue;
      const kind: CalendarEventType =
        assessment.component === "TE" || assessment.component === "ST1" || assessment.component === "ST2"
          ? "exam"
          : "assessment";
      events.push({
        id: `assessment-${load.id}-${assessment.id}`,
        title: `${load.gradeLevel}-${load.section} ${assessment.title}`,
        type: kind,
        date,
        startDate: date,
        endDate: date,
        loadId: load.id,
        description: `${load.subject} · Term ${assessment.term}`,
      });
    }
  }
  return events;
}

export interface CalendarDayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export function monthGrid(month: string, events: CalendarEvent[], today = todayIso()): CalendarDayCell[] {
  const dates = monthDates(month);
  const firstWeekday = parseIsoDate(`${month}-01`).getDay();
  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ date: "", day: 0, inMonth: false, isToday: false, events: [] });
  }
  for (const date of dates) {
    cells.push({
      date,
      day: Number(date.slice(8, 10)),
      inMonth: true,
      isToday: date === today,
      events: events.filter((event) => eventTouchesDate(event, date)),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: "", day: 0, inMonth: false, isToday: false, events: [] });
  }
  return cells;
}

export interface CalendarSummary {
  holidays: number;
  assessments: number;
  activities: number;
  birthdays: number;
}

export function summarizeMonth(events: CalendarEvent[], month: string): CalendarSummary {
  const inMonth = events.filter((event) => {
    const start = dateKey(event.startDate || event.date);
    const end = dateKey(event.endDate || event.date || event.startDate) || start;
    return monthFromDate(start) === month || monthFromDate(end) === month || (start <= `${month}-31` && end >= `${month}-01`);
  });
  return {
    holidays: inMonth.filter((event) => event.type === "holiday").length,
    assessments: inMonth.filter((event) => ASSESSMENT_TYPES.has(event.type)).length,
    activities: inMonth.filter((event) => ACTIVITY_TYPES.has(event.type)).length,
    birthdays: inMonth.filter((event) => isBirthdayEvent(event)).length,
  };
}

export function upcomingEvents(events: CalendarEvent[], today = todayIso(), limit = 8): CalendarEvent[] {
  return events
    .filter((event) => {
      const end = dateKey(event.endDate || event.date || event.startDate);
      return end >= today;
    })
    .map((event) => {
      const start = dateKey(event.startDate || event.date);
      const end = dateKey(event.endDate || event.date || event.startDate) || start;
      const ongoing = start < today && end >= today;
      return { ...event, date: ongoing ? today : start };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function visibleEventsForView(
  stored: CalendarEvent[] | undefined,
  loads: TeachingLoad[],
  filters: CalendarFilters,
  schoolYear: string,
): CalendarEvent[] {
  const composed = composeCalendarEvents(stored, loads, {
    schoolYear,
    loadId: filters.loadId,
  });
  const assessments = assessmentEventsForLoads(loads, filters);
  return filterCalendarEvents(composed.concat(assessments), filters, loads);
}

export function eventKindLabel(type: CalendarEventType): string {
  if (type === "holiday") return "Official holiday";
  if (ASSESSMENT_TYPES.has(type)) return "Assessment";
  if (type === "birthday") return "Birthday";
  return "School activity";
}

export function eventPillClass(type: CalendarEventType): string {
  if (type === "holiday") return "holiday";
  if (ASSESSMENT_TYPES.has(type)) return "exam";
  if (type === "birthday") return "birthday";
  return "milestone";
}
