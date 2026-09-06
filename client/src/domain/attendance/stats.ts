import type { AttendanceCell, AttendanceMark, AttendanceState } from "../../models/attendance";
import { learnerDisplayName, type Learner } from "../../models/learner";
import { dateInRange } from "./calendar";
import { cellStatus, isNoClassDate, sessionDatesInRange } from "./marks";

function sexOf(learner: Learner): "M" | "F" | "" {
  const value = String(learner.sex || "").trim().toUpperCase();
  if (value.startsWith("M")) return "M";
  if (value.startsWith("F")) return "F";
  return "";
}

export interface AttendanceRange {
  start?: string;
  end?: string;
  month?: string;
}

export interface LearnerAttendanceTotals {
  learnerId: string;
  checked: number;
  present: number;
  tardy: number;
  absent: number;
  excused: number;
  absenceRate: number;
}

export interface ClassAttendanceTotals {
  checked: number;
  present: number;
  tardy: number;
  absent: number;
  excused: number;
  absenceRate: number;
  sessionCount: number;
  noClassCount: number;
}

export function computeLearnerAttendance(
  attendance: AttendanceState,
  learnerId: string,
  range?: AttendanceRange,
): LearnerAttendanceTotals {
  const sessions = sessionDatesInRange(attendance, range);
  const totals: LearnerAttendanceTotals = {
    learnerId,
    checked: 0,
    present: 0,
    tardy: 0,
    absent: 0,
    excused: 0,
    absenceRate: 0,
  };
  for (const date of sessions) {
    const status = cellStatus(attendance, learnerId, date);
    totals.checked += 1;
    if (status === "absent") totals.absent += 1;
    else if (status === "tardy") totals.tardy += 1;
    else if (status === "excused") totals.excused += 1;
    else totals.present += 1;
  }
  totals.absenceRate = totals.checked ? Math.round((totals.absent / totals.checked) * 100) : 0;
  return totals;
}

export function computeClassAttendance(
  attendance: AttendanceState,
  learners: Learner[],
  range?: AttendanceRange,
): { summaries: LearnerAttendanceTotals[]; totals: ClassAttendanceTotals } {
  const summaries = learners.map((learner) => computeLearnerAttendance(attendance, learner.id, range));
  const sessionCount = sessionDatesInRange(attendance, range).length;
  const noClassCount = attendance.noClassDays.filter((day) => dateInRange(day.date, range)).length;
  const totals = summaries.reduce<ClassAttendanceTotals>(
    (sum, row) => {
      sum.checked += row.checked;
      sum.present += row.present;
      sum.tardy += row.tardy;
      sum.absent += row.absent;
      sum.excused += row.excused;
      return sum;
    },
    {
      checked: 0,
      present: 0,
      tardy: 0,
      absent: 0,
      excused: 0,
      absenceRate: 0,
      sessionCount,
      noClassCount,
    },
  );
  totals.absenceRate = totals.checked ? Math.round((totals.absent / totals.checked) * 100) : 0;
  return { summaries, totals };
}

/** Tardy counts as present on SF2 daily totals; excused/absent/no-class do not. */
export function isPresentForSf2(status: AttendanceCell): boolean {
  return status === "present" || status === "tardy";
}

export function noClassDatesInRange(attendance: AttendanceState, range?: AttendanceRange): string[] {
  return attendance.noClassDays
    .map((day) => day.date)
    .filter((date) => dateInRange(date, range) && isNoClassDate(attendance, date))
    .sort();
}

export interface AttendanceFilters {
  query?: string;
  sex?: "M" | "F" | "";
  status?: AttendanceMark | "no-class" | "";
}

export function learnerMatchesFilters(
  learner: Learner,
  attendance: AttendanceState,
  range: AttendanceRange | undefined,
  filters: AttendanceFilters,
): boolean {
  const q = (filters.query || "").trim().toLowerCase();
  if (q) {
    const hay = `${learnerDisplayName(learner)} ${learner.lrn}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (filters.sex && sexOf(learner) !== filters.sex) return false;
  if (filters.status) {
    const sessions = sessionDatesInRange(attendance, range);
    const noClass = noClassDatesInRange(attendance, range);
    if (filters.status === "no-class") return noClass.length > 0;
    const hit = sessions.some((date) => cellStatus(attendance, learner.id, date) === filters.status);
    if (!hit) return false;
  }
  return true;
}
