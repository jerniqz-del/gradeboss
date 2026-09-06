import {
  attendanceKey,
  emptyAttendance,
  type AttendanceCell,
  type AttendanceMark,
  type AttendanceState,
} from "../../models/attendance";
import type { TeachingLoad } from "../../models/teaching-load";
import { dateInRange, isIsoDate } from "./calendar";

export function attendanceOf(load: Pick<TeachingLoad, "attendance">): AttendanceState {
  return normalizeAttendance(load.attendance);
}

export function normalizeAttendance(value?: AttendanceState | null): AttendanceState {
  const source = value || emptyAttendance();
  const sessions = uniqueSorted((source.sessions || []).filter(isIsoDate));
  const noClassDays = (source.noClassDays || [])
    .filter((day) => day && isIsoDate(day.date))
    .map((day) => ({
      date: day.date,
      ...(day.reason?.trim() ? { reason: day.reason.trim().slice(0, 300) } : {}),
    }));
  const marks: AttendanceState["marks"] = {};
  for (const [key, mark] of Object.entries(source.marks || {})) {
    if (isAttendanceMark(mark) && mark !== "present") marks[key] = mark;
  }
  const excuseReasons: AttendanceState["excuseReasons"] = {};
  for (const [key, reason] of Object.entries(source.excuseReasons || {})) {
    const trimmed = String(reason || "").trim().slice(0, 300);
    if (trimmed) excuseReasons[key] = trimmed;
  }
  return { sessions, noClassDays, marks, excuseReasons };
}

export function isAttendanceMark(value: unknown): value is AttendanceMark {
  return value === "present" || value === "absent" || value === "tardy" || value === "excused";
}

export function isNoClassDate(attendance: AttendanceState, date: string): boolean {
  return attendance.noClassDays.some((day) => day.date === date);
}

export function noClassReason(attendance: AttendanceState, date: string): string {
  return attendance.noClassDays.find((day) => day.date === date)?.reason || "";
}

export function isSessionDate(attendance: AttendanceState, date: string): boolean {
  return attendance.sessions.includes(date) && !isNoClassDate(attendance, date);
}

export function sessionDatesInRange(
  attendance: AttendanceState,
  range?: { start?: string; end?: string; month?: string },
): string[] {
  return attendance.sessions
    .filter((date) => !isNoClassDate(attendance, date) && dateInRange(date, range))
    .sort();
}

export function cellStatus(attendance: AttendanceState, learnerId: string, date: string): AttendanceCell {
  if (isNoClassDate(attendance, date)) return "no-class";
  if (!isSessionDate(attendance, date)) return "";
  const mark = attendance.marks[attendanceKey(learnerId, date)];
  return mark || "present";
}

export function excuseReasonFor(attendance: AttendanceState, learnerId: string, date: string): string {
  return attendance.excuseReasons[attendanceKey(learnerId, date)] || "";
}

export function cycleMark(current: AttendanceMark | ""): AttendanceMark {
  if (current === "present" || current === "") return "tardy";
  if (current === "tardy") return "absent";
  if (current === "absent") return "excused";
  return "present";
}

export function setLearnerMark(
  attendance: AttendanceState,
  learnerId: string,
  date: string,
  mark: AttendanceMark,
  excuseReason = "",
): AttendanceState {
  if (isNoClassDate(attendance, date)) return attendance;
  const key = attendanceKey(learnerId, date);
  const next = cloneAttendance(attendance);
  if (!next.sessions.includes(date)) next.sessions = uniqueSorted([...next.sessions, date]);
  if (mark === "present") {
    delete next.marks[key];
    delete next.excuseReasons[key];
  } else {
    next.marks[key] = mark;
    if (mark === "excused" && excuseReason.trim()) {
      next.excuseReasons[key] = excuseReason.trim().slice(0, 300);
    } else {
      delete next.excuseReasons[key];
    }
  }
  return next;
}

export function applyRollCall(
  attendance: AttendanceState,
  date: string,
  marks: Record<string, AttendanceMark>,
  reasons: Record<string, string> = {},
): AttendanceState {
  let next = clearDate(attendance, date);
  next = {
    ...next,
    sessions: uniqueSorted([...next.sessions, date]),
  };
  for (const [learnerId, mark] of Object.entries(marks)) {
    next = setLearnerMark(next, learnerId, date, mark, reasons[learnerId] || "");
  }
  return next;
}

export function setNoClassDay(
  attendance: AttendanceState,
  date: string,
  enabled: boolean,
  reason = "",
): AttendanceState {
  const next = clearDate(attendance, date);
  if (!enabled) return next;
  return {
    ...next,
    noClassDays: [
      ...next.noClassDays.filter((day) => day.date !== date),
      { date, ...(reason.trim() ? { reason: reason.trim().slice(0, 300) } : {}) },
    ].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function updateNoClassReason(attendance: AttendanceState, date: string, reason: string): AttendanceState {
  if (!isNoClassDate(attendance, date)) return attendance;
  return {
    ...attendance,
    noClassDays: attendance.noClassDays.map((day) =>
      day.date === date
        ? { date, ...(reason.trim() ? { reason: reason.trim().slice(0, 300) } : {}) }
        : day,
    ),
  };
}

export function clearDate(attendance: AttendanceState, date: string): AttendanceState {
  const prefix = `|${date}`;
  const marks: AttendanceState["marks"] = {};
  const excuseReasons: AttendanceState["excuseReasons"] = {};
  for (const [key, mark] of Object.entries(attendance.marks)) {
    if (!key.endsWith(prefix)) marks[key] = mark;
  }
  for (const [key, reason] of Object.entries(attendance.excuseReasons)) {
    if (!key.endsWith(prefix)) excuseReasons[key] = reason;
  }
  return {
    sessions: attendance.sessions.filter((item) => item !== date),
    noClassDays: attendance.noClassDays.filter((day) => day.date !== date),
    marks,
    excuseReasons,
  };
}

export function pruneAttendanceForLearner(attendance: AttendanceState, learnerId: string): AttendanceState {
  const prefix = `${learnerId}|`;
  const marks: AttendanceState["marks"] = {};
  const excuseReasons: AttendanceState["excuseReasons"] = {};
  for (const [key, mark] of Object.entries(attendance.marks)) {
    if (!key.startsWith(prefix)) marks[key] = mark;
  }
  for (const [key, reason] of Object.entries(attendance.excuseReasons)) {
    if (!key.startsWith(prefix)) excuseReasons[key] = reason;
  }
  return { ...attendance, marks, excuseReasons };
}

export function attendanceDisplay(status: AttendanceCell): string {
  switch (status) {
    case "present":
      return "/";
    case "absent":
      return "X";
    case "tardy":
      return "T";
    case "excused":
      return "E";
    case "no-class":
      return "NC";
    default:
      return "";
  }
}

export function attendanceLabel(status: AttendanceCell): string {
  switch (status) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "tardy":
      return "Tardy";
    case "excused":
      return "Excused";
    case "no-class":
      return "No class";
    default:
      return "Not taken";
  }
}

function cloneAttendance(attendance: AttendanceState): AttendanceState {
  return {
    sessions: [...attendance.sessions],
    noClassDays: attendance.noClassDays.map((day) => ({ ...day })),
    marks: { ...attendance.marks },
    excuseReasons: { ...attendance.excuseReasons },
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}
