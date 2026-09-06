import { useMemo } from "react";
import {
  attendanceLabel,
  cellStatus,
  isNoClassDate,
  isSessionDate,
  isWeekend,
  learnerMatchesFilters,
  monthDates,
  weekdayLetter,
  type AttendanceFilters,
} from "../../domain/attendance";
import type { AttendanceState } from "../../models/attendance";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { learnerNameCaps } from "../shell/labels";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { sortDepEdRoster } from "../roster/sort";

export function AttendanceGrid({
  load,
  attendance,
  month,
  filters,
  weekdaysOnly = false,
  onToggleCell,
}: {
  load: TeachingLoad;
  attendance: AttendanceState;
  month: string;
  filters: AttendanceFilters;
  weekdaysOnly?: boolean;
  onToggleCell: (learnerId: string, date: string) => void;
}) {
  const dates = useMemo(
    () => monthDates(month).filter((date) => (weekdaysOnly ? !isWeekend(date) : true)),
    [month, weekdaysOnly],
  );
  const learners = useMemo(() => {
    return sortDepEdRoster(load.learners).filter((learner) =>
      learnerMatchesFilters(learner, attendance, { month }, filters),
    );
  }, [attendance, filters, load.learners, month]);

  return (
    <div className="sheet-scroll att-scroll">
      <table className="sheet-table att-table">
        <thead>
          <tr>
            <th className="sheet-sticky">No.</th>
            <th className="sheet-sticky att-name-head">Learner</th>
            <th>Sex</th>
            {dates.map((date) => (
              <th
                key={date}
                className={[
                  "att-day",
                  isWeekend(date) ? "is-weekend" : "",
                  isNoClassDate(attendance, date) ? "is-noclass" : "",
                  isSessionDate(attendance, date) ? "is-session" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="att-dow">{weekdayLetter(date)}</span>
                <span>{Number(date.slice(8))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {learners.map((learner, index) => (
            <tr key={learner.id}>
              <td className="sheet-sticky">{index + 1}</td>
              <th className="sheet-sticky att-name" scope="row">
                <LearnerAvatar presetId={learner.avatarPresetId} size="xs" />
                <span className="sheet-name">{learnerNameCaps(learnerDisplayName(learner))}</span>
              </th>
              <td>{learner.sex || "—"}</td>
              {dates.map((date) => {
                const status = cellStatus(attendance, learner.id, date);
                const disabled = status === "no-class";
                return (
                  <td key={date} className={isWeekend(date) ? "is-weekend" : undefined}>
                    <button
                      type="button"
                      className={`att-cell att-${status || "empty"}`}
                      disabled={disabled}
                      aria-label={`${learnerDisplayName(learner)} ${date}: ${attendanceLabel(status)}`}
                      onClick={() => onToggleCell(learner.id, date)}
                    >
                      {status === "present" ? "/" : status === "absent" ? "X" : status === "tardy" ? "T" : status === "excused" ? "E" : status === "no-class" ? "NC" : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
          {learners.length === 0 && (
            <tr>
              <td className="muted center" colSpan={dates.length + 1}>
                No learners match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
