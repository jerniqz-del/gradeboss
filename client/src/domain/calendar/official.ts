/**
 * Official DepEd school calendar pack.
 *
 * Ported from eclassrecord `src/renderer/js/official-calendar-pack.js`
 * (DepEd Order No. 9, s. 2026 — SY 2026–2027). The repo's
 * `data/deped-calendar.json` is a conflicted quarter-based draft; the live
 * desktop source is this pack.
 */

import type { CalendarEvent } from "../../models/calendar";
import { OFFICIAL_SOURCE_ID } from "../../models/calendar";

export const SOURCE_URL = "https://www.deped.gov.ph/wp-content/uploads/DO_s2026_009r.pdf";
export const SOURCE_ID = OFFICIAL_SOURCE_ID;
export const VERIFIED_AT = "2026-08-11";
export const SOURCE_NOTE =
  "DepEd Order No. 9, s. 2026. A scanned Term 3 heading says 2026; the summary table and January-April monthly pages establish 2027.";

export interface OfficialCalendarPack {
  sourceId: string;
  version: number;
  schoolYear: string;
  title: string;
  sourceUrl: string;
  verifiedAt: string;
  totalClassDays: number;
  sourceNote: string;
  events: CalendarEvent[];
}

function event(
  id: string,
  title: string,
  type: CalendarEvent["type"],
  startDate: string,
  endDate = startDate,
  sourcePage = "Annex A",
): CalendarEvent {
  return {
    id: `official-${SOURCE_ID}-${id}`,
    sourceId: SOURCE_ID,
    schoolYear: "2026-2027",
    title,
    sourceUrl: SOURCE_URL,
    sourcePage,
    verifiedAt: VERIFIED_AT,
    type,
    startDate,
    endDate,
    date: startDate,
    sourceNote: SOURCE_NOTE,
    immutable: true,
    official: true,
  };
}

/** Official SY 2026–2027 events from `official-calendar-pack.js`. */
export const OFFICIAL_EVENTS: CalendarEvent[] = [
  event("term-1", "Term 1", "term", "2026-06-08", "2026-09-15"),
  event("opening-1", "Term 1 Opening Block", "opening", "2026-06-08", "2026-06-11"),
  event("instruction-1", "Term 1 Instructional Block", "instruction", "2026-06-15", "2026-09-01"),
  event("summative-1a", "Term 1 First Teacher-made Summative Test", "assessment", "2026-07-06"),
  event("summative-1b", "Term 1 Second Teacher-made Summative Test", "assessment", "2026-07-28"),
  event("exam-1", "Term 1 Examination", "exam", "2026-08-28", "2026-09-01"),
  event("eot-1", "Term 1 End-of-Term Block", "end-of-term", "2026-09-02", "2026-09-15"),
  event("aral-1", "Term 1 ARAL, grades, forms and activities", "aral", "2026-09-02", "2026-09-08"),
  event("reports-1", "Term 1 Report-card Distribution / PTA Meeting", "report-card", "2026-09-09"),
  event("inset-1", "Term 1 INSET", "inset", "2026-09-10", "2026-09-11"),
  event("learner-wellness-1", "Term 1 Learner Wellness Break", "wellness", "2026-09-10", "2026-09-15"),
  event("teacher-wellness-1", "Term 1 Teacher Wellness Break", "wellness", "2026-09-14", "2026-09-15"),
  event("term-2", "Term 2", "term", "2026-09-16", "2026-12-18"),
  event("instruction-2", "Term 2 Instructional Block", "instruction", "2026-09-16", "2026-12-04"),
  event("summative-2a", "Term 2 First Teacher-made Summative Test", "assessment", "2026-10-07"),
  event("nat-10", "National Achievement Test — Grade 10", "national-assessment", "2026-10-05", "2026-10-09"),
  event("summative-2b", "Term 2 Second Teacher-made Summative Test", "assessment", "2026-10-29"),
  event("exam-2", "Term 2 Examination", "exam", "2026-12-03", "2026-12-04"),
  event("eot-2", "Term 2 End-of-Term Block", "end-of-term", "2026-12-07", "2026-12-18"),
  event("reports-2", "Term 2 Report-card Distribution / PTA Meeting", "report-card", "2026-12-15"),
  event("inset-2", "Term 2 INSET and Learner Wellness Break", "inset", "2026-12-17", "2026-12-18"),
  event("year-end", "Year-end Break", "break", "2026-12-19", "2026-12-31"),
  event("term-3", "Term 3", "term", "2027-01-04", "2027-04-08"),
  event("instruction-3", "Term 3 Instructional Block", "instruction", "2027-01-04", "2027-03-23"),
  event("summative-3a", "Term 3 First Teacher-made Summative Test", "assessment", "2027-01-25"),
  event("summative-3b", "Term 3 Second Teacher-made Summative Test", "assessment", "2027-02-16"),
  event("exam-3-graduating", "Term 3 Examination — Moving-up / Graduating", "exam", "2027-03-15", "2027-03-16"),
  event("exam-3-other", "Term 3 Examination — Other Grade Levels", "exam", "2027-03-22", "2027-03-23"),
  event("eot-3", "Term 3 End-of-Term Block", "end-of-term", "2027-03-24", "2027-04-08"),
  event("inset-3", "Term 3 INSET", "inset", "2027-04-02", "2027-04-05"),
  event("eosy-rites", "End-of-School-Year Rites", "eosy", "2027-04-06", "2027-04-07"),
  event("reports-3", "Term 3 Report-card Distribution / PTA Meeting", "report-card", "2027-04-08"),
  event("eosy-break", "End-of-School-Year Break", "break", "2027-04-09", "2027-05-09"),
  event("independence", "Independence Day", "holiday", "2026-06-12"),
  event("ninoy-aquino", "Ninoy Aquino Day", "holiday", "2026-08-21"),
  event("national-heroes", "National Heroes Day", "holiday", "2026-08-31"),
  event("all-saints", "All Saints’ Day", "holiday", "2026-11-01"),
  event("all-souls", "All Souls’ Day", "holiday", "2026-11-02"),
  event("bonifacio", "Bonifacio Day", "holiday", "2026-11-30"),
  event("immaculate-conception", "Feast of the Immaculate Conception", "holiday", "2026-12-08"),
  event("chinese-new-year", "Chinese New Year", "holiday", "2027-02-06"),
  event("maundy-thursday", "Maundy Thursday", "holiday", "2027-03-25"),
  event("good-friday", "Good Friday", "holiday", "2027-03-26"),
  event("black-saturday", "Black Saturday", "holiday", "2027-03-27"),
];

export const SOURCE_PACK: OfficialCalendarPack = {
  sourceId: SOURCE_ID,
  version: 1,
  schoolYear: "2026-2027",
  title: "DepEd Order No. 9, s. 2026 — Official School Calendar",
  sourceUrl: SOURCE_URL,
  verifiedAt: VERIFIED_AT,
  totalClassDays: 201,
  sourceNote: SOURCE_NOTE,
  events: OFFICIAL_EVENTS,
};

export function officialEvents(): CalendarEvent[] {
  return structuredClone(OFFICIAL_EVENTS);
}

/** Merge official pack with stored local events. Official ids always win. */
export function mergeOfficialEvents(stored: CalendarEvent[] | undefined): CalendarEvent[] {
  const officialPrefix = `official-${SOURCE_ID}-`;
  const local = (Array.isArray(stored) ? stored : []).filter(
    (item) => item?.sourceId !== SOURCE_ID && !String(item?.id || "").startsWith(officialPrefix),
  );
  return local.concat(officialEvents());
}

export function isOfficialEvent(eventItem: CalendarEvent): boolean {
  return Boolean(
    eventItem.immutable ||
      eventItem.official ||
      eventItem.sourceId ||
      String(eventItem.id || "").startsWith("official-"),
  );
}

export function toOfficialCalendarJson(): OfficialCalendarPack {
  return structuredClone(SOURCE_PACK);
}
