import { learnerDisplayName, type Learner } from "../../models/learner";
import type { AttendanceState } from "../../models/attendance";
import type { TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";
import { monthDates, monthFromDate } from "./calendar";
import { attendanceDisplay, attendanceOf, cellStatus, isSessionDate } from "./marks";
import { isPresentForSf2 } from "./stats";

function sexOf(learner: Learner): "M" | "F" | "" {
  const value = String(learner.sex || "").trim().toUpperCase();
  if (value.startsWith("M")) return "M";
  if (value.startsWith("F")) return "F";
  return "";
}

function sortSf2Roster(learners: Learner[]): Learner[] {
  return [...learners].sort((a, b) => {
    const rank = (sex: "M" | "F" | "") => (sex === "M" ? 1 : sex === "F" ? 2 : 3);
    const sx = rank(sexOf(a));
    const sy = rank(sexOf(b));
    if (sx !== sy) return sx - sy;
    return learnerDisplayName(a).toLowerCase().localeCompare(learnerDisplayName(b).toLowerCase(), "fil");
  });
}

export interface Sf2SummaryCounts {
  enrollmentMale: number;
  enrollmentFemale: number;
  lateEnrollmentMale: number;
  lateEnrollmentFemale: number;
  dropOutMale: number;
  dropOutFemale: number;
  transferredOutMale: number;
  transferredOutFemale: number;
  transferredInMale: number;
  transferredInFemale: number;
}

export interface Sf2LearnerRow {
  id: string;
  name: string;
  sex: "M" | "F" | "";
  lrn: string;
  marks: Record<string, string>;
  absent: number;
  tardy: number;
}

export interface Sf2DayTotals {
  male: Record<string, number | "">;
  female: Record<string, number | "">;
  all: Record<string, number | "">;
}

export interface Sf2Payload {
  title: string;
  schoolName: string;
  schoolId: string;
  schoolYear: string;
  region: string;
  division: string;
  district: string;
  gradeSection: string;
  month: string;
  monthLabel: string;
  adviser: string;
  schoolHead: string;
  dates: string[];
  learners: Sf2LearnerRow[];
  totals: Sf2DayTotals;
  summary: Sf2SummaryCounts;
  registeredMale: number;
  registeredFemale: number;
}

function countBySex(learners: Learner[], predicate: (learner: Learner) => boolean, sex: "M" | "F"): number {
  return learners.filter((learner) => sexOf(learner) === sex && predicate(learner)).length;
}

function isTransferredIn(learner: Learner): boolean {
  return Boolean(learner.transferredInGrades && Object.keys(learner.transferredInGrades).length);
}

function isTransferredOut(learner: Learner): boolean {
  return Boolean(learner.transferredOutTerm);
}

function isLateEnrollment(learner: Learner): boolean {
  return /late/i.test(learner.remarks || "") || /late/i.test(learner.modality || "");
}

function isDropOut(learner: Learner): boolean {
  return /drop\s*out|dropped/i.test(learner.remarks || "");
}

export function summarizeSf2Inputs(learners: Learner[]): Sf2SummaryCounts {
  return {
    enrollmentMale: countBySex(learners, () => true, "M"),
    enrollmentFemale: countBySex(learners, () => true, "F"),
    lateEnrollmentMale: countBySex(learners, isLateEnrollment, "M"),
    lateEnrollmentFemale: countBySex(learners, isLateEnrollment, "F"),
    dropOutMale: countBySex(learners, isDropOut, "M"),
    dropOutFemale: countBySex(learners, isDropOut, "F"),
    transferredOutMale: countBySex(learners, isTransferredOut, "M"),
    transferredOutFemale: countBySex(learners, isTransferredOut, "F"),
    transferredInMale: countBySex(learners, isTransferredIn, "M"),
    transferredInFemale: countBySex(learners, isTransferredIn, "F"),
  };
}

export function sf2PresentTotalsBySex(
  learners: Learner[],
  attendance: AttendanceState,
  month: string,
): { dates: string[]; totals: Sf2DayTotals } {
  const dates = monthDates(month);
  const totals: Sf2DayTotals = { male: {}, female: {}, all: {} };
  for (const date of dates) {
    if (!isSessionDate(attendance, date)) {
      totals.male[date] = "";
      totals.female[date] = "";
      totals.all[date] = "";
      continue;
    }
    const male = learners.filter((learner) => sexOf(learner) === "M");
    const female = learners.filter((learner) => sexOf(learner) === "F");
    const countPresent = (rows: Learner[]) =>
      rows.reduce((count, learner) => {
        return count + (isPresentForSf2(cellStatus(attendance, learner.id, date)) ? 1 : 0);
      }, 0);
    totals.male[date] = countPresent(male);
    totals.female[date] = countPresent(female);
    totals.all[date] = Number(totals.male[date]) + Number(totals.female[date]);
  }
  return { dates, totals };
}

export function buildSf2LearnerRows(learners: Learner[], attendance: AttendanceState, month: string): Sf2LearnerRow[] {
  const dates = monthDates(month);
  return sortSf2Roster(learners).map((learner) => {
    const marks: Record<string, string> = {};
    let absent = 0;
    let tardy = 0;
    for (const date of dates) {
      const status = cellStatus(attendance, learner.id, date);
      marks[date] = attendanceDisplay(status);
      if (status === "absent") absent += 1;
      if (status === "tardy") tardy += 1;
    }
    return {
      id: learner.id,
      name: learnerDisplayName(learner),
      sex: sexOf(learner),
      lrn: learner.lrn,
      marks,
      absent,
      tardy,
    };
  });
}

export function buildSf2Payload(
  load: TeachingLoad,
  month: string,
  profile?: TeacherProfile,
): Sf2Payload {
  const attendance = attendanceOf(load);
  const learners = load.learners || [];
  const { dates, totals } = sf2PresentTotalsBySex(learners, attendance, month);
  const summary = summarizeSf2Inputs(learners);
  const meta = load.sf1Meta || {};
  const monthDate = `${month}-01`;
  return {
    title: "School Form 2 (SF2) Daily Attendance Report of Learners",
    schoolName: meta.schoolName || profile?.schoolName || "",
    schoolId: meta.schoolId || profile?.schoolId || "",
    schoolYear: load.schoolYear || meta.schoolYear || profile?.schoolYear || "",
    region: meta.region || profile?.region || "",
    division: meta.division || profile?.division || "",
    district: meta.district || profile?.district || "",
    gradeSection: `G${load.gradeLevel} ${load.section}`.trim(),
    month,
    monthLabel: new Date(`${monthDate}T12:00:00`).toLocaleDateString("en-PH", {
      month: "long",
      year: "numeric",
    }),
    adviser: meta.adviser || profile?.teacherName || "",
    schoolHead: meta.schoolHead || "",
    dates,
    learners: buildSf2LearnerRows(learners, attendance, month),
    totals,
    summary,
    registeredMale: summary.enrollmentMale + summary.transferredInMale - summary.transferredOutMale - summary.dropOutMale,
    registeredFemale:
      summary.enrollmentFemale + summary.transferredInFemale - summary.transferredOutFemale - summary.dropOutFemale,
  };
}

export function sf2Filename(load: TeachingLoad, month: string): string {
  const grade = load.gradeLevel || "0";
  const section = (load.section || "section").replace(/\s+/g, "-");
  return `SF2-G${grade}-${section}-${monthFromDate(`${month}-01`)}.pdf`;
}
