import { useEffect, useMemo, useState } from "react";
import {
  applyRollCall,
  cellStatus,
  clearDate,
  isNoClassDate,
  noClassReason,
  setNoClassDay,
  shiftIsoDate,
  todayIso,
  weekdayShort,
} from "../../domain/attendance";
import type { AttendanceMark, AttendanceState } from "../../models/attendance";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { sortDepEdRoster } from "../roster/sort";

const STATUSES: Array<{ id: AttendanceMark; label: string }> = [
  { id: "present", label: "Present" },
  { id: "tardy", label: "Tardy" },
  { id: "absent", label: "Absent" },
  { id: "excused", label: "Excused" },
];

function currentRollMarksFromState(load: TeachingLoad, attendance: AttendanceState, date: string): Record<string, AttendanceMark> {
  const marks: Record<string, AttendanceMark> = {};
  if (!attendance.sessions.includes(date) || isNoClassDate(attendance, date)) {
    for (const learner of load.learners) marks[learner.id] = "present";
    return marks;
  }
  for (const learner of load.learners) {
    const status = cellStatus(attendance, learner.id, date);
    marks[learner.id] = status === "tardy" || status === "absent" || status === "excused" ? status : "present";
  }
  return marks;
}

export function RollCallModal({
  load,
  attendance,
  date,
  onDateChange,
  onClose,
  onSave,
}: {
  load: TeachingLoad;
  attendance: AttendanceState;
  date: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
  onSave: (next: AttendanceState) => void;
}) {
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>(() =>
    currentRollMarksFromState(load, attendance, date),
  );
  const [reasons, setReasons] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const learner of load.learners) {
      const key = `${learner.id}|${date}`;
      if (attendance.excuseReasons[key]) next[learner.id] = attendance.excuseReasons[key];
    }
    return next;
  });
  const [noClass, setNoClass] = useState(isNoClassDate(attendance, date));
  const [noClassNote, setNoClassNote] = useState(noClassReason(attendance, date));

  useEffect(() => {
    setMarks(currentRollMarksFromState(load, attendance, date));
    const next: Record<string, string> = {};
    for (const learner of load.learners) {
      const key = `${learner.id}|${date}`;
      if (attendance.excuseReasons[key]) next[learner.id] = attendance.excuseReasons[key];
    }
    setReasons(next);
    setNoClass(isNoClassDate(attendance, date));
    setNoClassNote(noClassReason(attendance, date));
  }, [attendance, date, load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const learners = useMemo(() => sortDepEdRoster(load.learners), [load.learners]);
  const carousel = useMemo(() => {
    const center = date;
    return Array.from({ length: 7 }, (_, i) => shiftIsoDate(center, i - 3));
  }, [date]);

  const counts = learners.reduce(
    (sum, learner) => {
      const status = marks[learner.id] || "present";
      if (status === "tardy") sum.tardy += 1;
      else if (status === "absent") sum.absent += 1;
      else if (status === "excused") sum.excused += 1;
      else sum.present += 1;
      return sum;
    },
    { present: 0, tardy: 0, absent: 0, excused: 0 },
  );

  const save = () => {
    if (noClass) {
      onSave(setNoClassDay(attendance, date, true, noClassNote));
      return;
    }
    onSave(applyRollCall(attendance, date, marks, reasons));
  };

  return (
    <div className="att-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="att-modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roll-call-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="att-modal-head">
          <div>
            <h3 id="roll-call-title">Roll call</h3>
            <p className="muted">{weekdayShort(date)} {date}</p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="att-carousel" role="listbox" aria-label="Attendance date">
          <button type="button" className="ghost att-car-step" onClick={() => onDateChange(shiftIsoDate(date, -1))} aria-label="Previous day">
            ‹
          </button>
          {carousel.map((value) => (
            <button
              key={value}
              type="button"
              role="option"
              aria-selected={value === date}
              className={value === date ? "att-car-day active" : "att-car-day"}
              onClick={() => onDateChange(value)}
            >
              <span>{weekdayShort(value)}</span>
              <strong>{Number(value.slice(8))}</strong>
              {value === todayIso() && <em>Today</em>}
            </button>
          ))}
          <button type="button" className="ghost att-car-step" onClick={() => onDateChange(shiftIsoDate(date, 1))} aria-label="Next day">
            ›
          </button>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={noClass}
            onChange={(event) => setNoClass(event.target.checked)}
          />
          No classes / holiday for this date
        </label>
        <label className={noClass ? "" : "is-hidden"}>
          Reason
          <input
            value={noClassNote}
            onChange={(event) => setNoClassNote(event.target.value)}
            placeholder="School activity, holiday…"
            disabled={!noClass}
          />
        </label>

        {!noClass && (
          <>
            <p className="att-roll-summary" aria-live="polite">
              Present: {counts.present} · Tardy: {counts.tardy} · Absent: {counts.absent} · Excused: {counts.excused}
            </p>
            <div className="att-roll-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const next: Record<string, AttendanceMark> = {};
                  for (const learner of learners) next[learner.id] = "present";
                  setMarks(next);
                  setReasons({});
                }}
              >
                Mark all present
              </button>
            </div>
            <div className="att-roll-list">
              {learners.map((learner) => {
                const status = marks[learner.id] || "present";
                return (
                  <div key={learner.id} className="att-roll-row">
                    <div className="att-roll-who">
                      <LearnerAvatar presetId={learner.avatarPresetId} size="sm" />
                      <span>{learnerDisplayName(learner)}</span>
                    </div>
                    <div className="att-status-group" role="group" aria-label={learnerDisplayName(learner)}>
                      {STATUSES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={status === item.id ? `att-status att-${item.id} active` : `att-status att-${item.id}`}
                          onClick={() => setMarks((current) => ({ ...current, [learner.id]: item.id }))}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    {status === "excused" && (
                      <label className="att-excuse">
                        Reason
                        <input
                          value={reasons[learner.id] || ""}
                          onChange={(event) =>
                            setReasons((current) => ({ ...current, [learner.id]: event.target.value }))
                          }
                          placeholder="Optional excuse note"
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="att-modal-foot">
          <button
            type="button"
            className="ghost danger"
            onClick={() => onSave(clearDate(attendance, date))}
          >
            Clear this date
          </button>
          <button type="button" className="primary" onClick={save}>
            Save roll call
          </button>
        </div>
      </div>
    </div>
  );
}
