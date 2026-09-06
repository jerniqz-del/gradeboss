import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
  attendanceOf,
  buildSf2Payload,
  cellStatus,
  computeClassAttendance,
  cycleMark,
  formatMonthLabel,
  monthValue,
  setLearnerMark,
  shiftMonth,
  todayIso,
  type AttendanceFilters,
} from "../../domain/attendance";
import type { TeachingLoad } from "../../models/teaching-load";
import { createDefaultProfile, type TeacherProfile } from "../../models/teacher-profile";
import { ensureStorageReady, getTeacherProfile } from "../../storage/init";
import { printSf2Report } from "../exports/print";
import { ActiveClassBar } from "../shell/ActiveClassBar";
import { AttendanceGrid } from "./AttendanceGrid";
import { RollCallModal } from "./RollCallModal";
import { Sf2Document } from "./Sf2Document";

export function AttendanceView({
  selectedLoadId,
  onSelectLoad,
}: {
  selectedLoadId: string | null;
  onSelectLoad: (id: string) => void;
}) {
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [load, setLoad] = useState<TeachingLoad | null>(null);
  const [profile, setProfile] = useState<TeacherProfile>(createDefaultProfile);
  const [month, setMonth] = useState(() => monthValue());
  const [filters, setFilters] = useState<AttendanceFilters>({ query: "", sex: "", status: "" });
  const [learnerId, setLearnerId] = useState("");
  const [rangeStart, setRangeStart] = useState(() => `${monthValue()}-01`);
  const [rangeEnd, setRangeEnd] = useState(() => monthEnd(monthValue()));
  const [rollOpen, setRollOpen] = useState(false);
  const [rollDate, setRollDate] = useState(() => todayIso());
  const [showSf2, setShowSf2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfNote, setPdfNote] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    const next = await api.getTeachingLoads();
    setLoads(next);
    return next;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [list, db] = await Promise.all([refreshList(), ensureStorageReady()]);
        const nextProfile = (await getTeacherProfile(db)) || createDefaultProfile();
        setProfile(nextProfile);
        const id = selectedLoadId || list[0]?.id;
        if (id && id !== selectedLoadId) onSelectLoad(id);
        if (id) {
          const found = list.find((item) => item.id === id) || (await api.getTeachingLoad(id));
          setLoad(found ?? null);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open attendance");
      }
    })();
  }, [onSelectLoad, refreshList, selectedLoadId]);

  const persist = async (next: TeachingLoad) => {
    setLoad(next);
    await api.saveTeachingLoad(next);
    setLoads((current) => current.map((item) => (item.id === next.id ? next : item)));
  };

  const attendance = useMemo(() => (load ? attendanceOf(load) : attendanceOf({ attendance: undefined })), [load]);
  const stats = useMemo(
    () => computeClassAttendance(attendance, load?.learners || [], { start: rangeStart, end: rangeEnd }),
    [attendance, load?.learners, rangeEnd, rangeStart],
  );

  const shownStats = useMemo(() => {
    if (!learnerId) return stats.totals;
    return stats.summaries.find((row) => row.learnerId === learnerId) || stats.totals;
  }, [learnerId, stats]);
  const payload = useMemo(
    () => (load ? buildSf2Payload(load, month, profile) : null),
    [load, month, profile],
  );

  const onToggleCell = (learnerId: string, date: string) => {
    if (!load) return;
    const status = cellStatus(attendance, learnerId, date);
    if (status === "no-class") return;
    const nextMark = status === "" ? "present" : cycleMark(status);
    void persist({
      ...load,
      attendance: setLearnerMark(attendance, learnerId, date, nextMark),
    });
  };

  if (loads.length === 0) {
    return (
      <section>
        <div className="page-header">
          <h2>Attendance</h2>
          <p>Create a teaching load with a roster first, then take monthly attendance here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="att-page">
      {error && <div className="banner error no-print">{error}</div>}
      {pdfNote && <div className="banner warn no-print">{pdfNote}</div>}

      <ActiveClassBar loads={loads} selectedId={load?.id || ""} onSelect={onSelectLoad}>
        <label className="ecr-active-label">
          Learner
          <select
            value={learnerId}
            onChange={(event) => {
              const id = event.target.value;
              setLearnerId(id);
              const learner = load?.learners.find((item) => item.id === id);
              setFilters((current) => ({ ...current, query: learner?.lrn || learner?.lastName || "" }));
            }}
          >
            <option value="">Entire class</option>
            {(load?.learners || []).map((learner) => (
              <option key={learner.id} value={learner.id}>
                {learner.lastName}, {learner.firstName}
              </option>
            ))}
          </select>
        </label>
        <label className="ecr-active-label">
          Start date
          <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
        </label>
        <label className="ecr-active-label">
          End date
          <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
        </label>
        <button type="button" className="ghost btn-cyan" onClick={() => printSf2Report()}>
          Print
        </button>
        <button
          type="button"
          className="ghost btn-olive"
          onClick={() => {
            if (!payload || !load) return;
            void (async () => {
              try {
                const { downloadSf2Pdf } = await import("./sf2-pdf");
                downloadSf2Pdf(load, payload);
                setPdfNote(null);
              } catch (err) {
                setPdfNote(err instanceof Error ? err.message : "Could not build the SF2 PDF.");
              }
            })();
          }}
        >
          Download PDF
        </button>
      </ActiveClassBar>

      {load && (
        <>
          <div className="att-summary-row no-print">
            <Stat label="Checked" value={shownStats.checked} />
            <Stat label="Present" value={shownStats.present} tone="present" />
            <Stat label="Tardy" value={shownStats.tardy} tone="tardy" />
            <Stat label="Absent" value={shownStats.absent} tone="absent" />
            <Stat label="Excused" value={shownStats.excused} tone="excused" />
            <Stat label="Absence rate" value={`${shownStats.absenceRate}%`} />
          </div>

          <div className="card att-month-card">
            <div className="att-month-card-head">
              <div>
                <h3>Monthly Attendance</h3>
                <p className="muted small">Weekdays only. Blank cells mean attendance was not taken for that date.</p>
              </div>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setRollDate(todayIso().startsWith(month) ? todayIso() : `${month}-01`);
                  setRollOpen(true);
                }}
              >
                Take Roll Call
              </button>
            </div>
            <div className="att-month-nav">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const next = shiftMonth(month, -1);
                  setMonth(next);
                  setRangeStart(`${next}-01`);
                  setRangeEnd(monthEnd(next));
                }}
                aria-label="Previous month"
              >
                ‹
              </button>
              <strong>{formatMonthLabel(month)}</strong>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const next = shiftMonth(month, 1);
                  setMonth(next);
                  setRangeStart(`${next}-01`);
                  setRangeEnd(monthEnd(next));
                }}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="att-legend no-print" aria-label="Attendance legend">
              <span><b className="att-present">P</b> Present</span>
              <span><b className="att-tardy">T</b> Tardy</span>
              <span><b className="att-absent">X</b> Absent</span>
              <span><b className="att-excused">E</b> Excused</span>
              <span><b className="att-no-class">NC</b> No class</span>
            </div>
            <button type="button" className="ghost" onClick={() => setShowSf2((value) => !value)}>
              {showSf2 ? "Hide SF2 preview" : "Preview SF2"}
            </button>
            <AttendanceGrid
              load={load}
              attendance={attendance}
              month={month}
              filters={filters}
              weekdaysOnly
              onToggleCell={onToggleCell}
            />
          </div>

          {payload && (
            <div className={showSf2 ? "sf2-preview" : "sf2-print print-only"}>
              <Sf2Document payload={payload} />
            </div>
          )}
        </>
      )}

      {rollOpen && load && (
        <RollCallModal
          load={load}
          attendance={attendance}
          date={rollDate}
          onDateChange={setRollDate}
          onClose={() => setRollOpen(false)}
          onSave={(next) => {
            void persist({ ...load, attendance: next });
            setRollOpen(false);
          }}
        />
      )}
    </section>
  );
}

function monthEnd(month: string): string {
  const [year, mo] = month.split("-").map(Number);
  const last = new Date(year, mo, 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "present" | "tardy" | "absent" | "excused" | "no-class";
}) {
  return (
    <div className={`card stat att-stat ${tone ? `att-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
