/** Attendance marks stored per learner per session date. */
export type AttendanceMark = "present" | "absent" | "tardy" | "excused";

/** Resolved cell value shown in the monthly grid and SF2. */
export type AttendanceCell = AttendanceMark | "no-class" | "";

export interface AttendanceNoClassDay {
  date: string;
  reason?: string;
}

/**
 * Attendance attached to a teaching load (eclassrecord assignment).
 * Present is implicit on session dates unless a non-present mark exists.
 */
export interface AttendanceState {
  /** ISO dates (`YYYY-MM-DD`) with roll call / grid attendance taken. */
  sessions: string[];
  noClassDays: AttendanceNoClassDay[];
  /** Key: `${learnerId}|${YYYY-MM-DD}` — only non-present marks need to be stored. */
  marks: Record<string, AttendanceMark>;
  excuseReasons: Record<string, string>;
}

export function emptyAttendance(): AttendanceState {
  return { sessions: [], noClassDays: [], marks: {}, excuseReasons: {} };
}

export function attendanceKey(learnerId: string, date: string): string {
  return `${learnerId}|${date}`;
}

export function parseAttendanceKey(key: string): { learnerId: string; date: string } | null {
  const idx = key.lastIndexOf("|");
  if (idx <= 0 || idx === key.length - 1) return null;
  return { learnerId: key.slice(0, idx), date: key.slice(idx + 1) };
}

export const ATTENDANCE_MARKS: AttendanceMark[] = ["present", "tardy", "absent", "excused"];
