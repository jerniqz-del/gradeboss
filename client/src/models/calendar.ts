/** School calendar models — ported from eclassrecord official-calendar-pack + calendar store. */

export const CALENDAR_STORE_VERSION = 1;
export const OFFICIAL_SOURCE_ID = "deped-do-009-s2026-sy2026-2027-v1";

export type CalendarEventType =
  | "term"
  | "opening"
  | "instruction"
  | "assessment"
  | "exam"
  | "end-of-term"
  | "aral"
  | "report-card"
  | "inset"
  | "wellness"
  | "national-assessment"
  | "break"
  | "eosy"
  | "holiday"
  | "reminder"
  | "milestone"
  | "birthday";

export interface CalendarFilters {
  official: boolean;
  local: boolean;
  birthdays: boolean;
  /** Teaching-load id, or `"all"`. */
  loadId: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string;
  date: string;
  description?: string;
  schoolYear?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourcePage?: string;
  sourceNote?: string;
  verifiedAt?: string;
  immutable?: boolean;
  official?: boolean;
  virtual?: boolean;
  localOnly?: boolean;
  loadId?: string;
  assignmentIds?: string[];
  classes?: string[];
  learnerId?: string;
  learnerName?: string;
  avatarPresetId?: string;
  age?: number;
  observed?: boolean;
}

export interface CalendarStore {
  version: number;
  events: CalendarEvent[];
  filters: CalendarFilters;
}

export function createEmptyCalendarStore(): CalendarStore {
  return {
    version: CALENDAR_STORE_VERSION,
    events: [],
    filters: {
      official: true,
      local: true,
      birthdays: true,
      loadId: "all",
    },
  };
}

export function createLocalEventId(): string {
  return `evt-${crypto.randomUUID()}`;
}
