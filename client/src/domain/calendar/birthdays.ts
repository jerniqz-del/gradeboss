/**
 * Learner birthday occurrences for a school year.
 *
 * Ported from eclassrecord `official-calendar-pack.js`:
 * `birthdayOccurrence`, `virtualBirthdays`, `february29Policy`.
 */

import { learnerDisplayName, type Learner } from "../../models/learner";
import type { CalendarEvent } from "../../models/calendar";
import type { TeachingLoad } from "../../models/teaching-load";

export const FEBRUARY_29_POLICY =
  "In non-leap years, February 29 birthdays are displayed and notified on February 28.";

export interface BirthdayOccurrence {
  date: string;
  age: number;
  observed: boolean;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Map a birthdate onto the school year, observing Feb 29 on Feb 28 in non-leap years. */
export function birthdayOccurrence(birthdate: string, schoolYear: string): BirthdayOccurrence | null {
  const match = String(birthdate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const years = String(schoolYear || "").match(/^(\d{4})-(\d{4})$/);
  if (!years) return null;
  const birthYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const year = month >= 6 ? Number(years[1]) : Number(years[2]);
  const observedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(observedDay).padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${date}T00:00:00`))) return null;
  return { date, age: Math.max(0, year - birthYear), observed: observedDay !== day };
}

function normalizedName(learner: Learner): string {
  return [learner.lastName, learner.firstName, learner.middleName]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

function isActiveLearner(learner: Learner): boolean {
  return !learner.transferredOutTerm;
}

/** Virtual birthday events for roster learners. Dedupes by LRN (or name + birthdate). */
export function virtualBirthdays(
  loads: TeachingLoad[],
  options: { schoolYear?: string; loadId?: string } = {},
): CalendarEvent[] {
  const schoolYear = String(options.schoolYear || loads[0]?.schoolYear || "2026-2027");
  const scope = String(options.loadId || "all");
  const seen = new Map<string, CalendarEvent>();

  for (const load of loads) {
    if (String(load.schoolYear || schoolYear) !== schoolYear) continue;
    if (scope !== "all" && String(load.id) !== scope) continue;
    const classLabel = `Grade ${load.gradeLevel || ""} - ${load.section || ""}${
      load.subject ? ` · ${load.subject}` : ""
    }`;
    for (const learner of load.learners || []) {
      if (!learner || !isActiveLearner(learner)) continue;
      const occurrence = birthdayOccurrence(learner.birthdate, schoolYear);
      if (!occurrence) continue;
      const lrn = String(learner.lrn || "").replace(/\D/g, "");
      const key = lrn ? `lrn:${lrn}` : `person:${normalizedName(learner)}|${learner.birthdate}`;
      const existing = seen.get(key);
      if (existing) {
        if (!existing.assignmentIds?.includes(load.id)) existing.assignmentIds?.push(load.id);
        if (!existing.classes?.includes(classLabel)) existing.classes?.push(classLabel);
        continue;
      }
      seen.set(key, {
        id: `birthday-${key.replace(/[^a-z0-9]+/gi, "-")}-${occurrence.date}`,
        virtual: true,
        localOnly: true,
        type: "birthday",
        date: occurrence.date,
        startDate: occurrence.date,
        endDate: occurrence.date,
        title: `${learnerDisplayName(learner)}’s birthday`,
        learnerId: learner.id,
        learnerName: learnerDisplayName(learner),
        avatarPresetId: learner.avatarPresetId,
        age: occurrence.age,
        observed: occurrence.observed,
        assignmentIds: [load.id],
        classes: [classLabel],
        schoolYear,
      });
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || (a.learnerName || "").localeCompare(b.learnerName || "", "fil"),
  );
}
