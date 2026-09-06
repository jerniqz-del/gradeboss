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
import { policyLabel } from "../teaching-loads/create-load";
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
    () => computeClassAttendance(attendance, load?.learners || [], { month }),
    [attendance, load?.learners, month],
  );
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
      <div className="page-header no-print">
        <h2>Attendance</h2>
        <p>Monthly grid, roll call, and School Form 2. Marks stay on this device and work offline.</p>
      </div>

      {error && <div className="banner error no-print">{error}</div>}
      {pdfNote && <div className="banner warn no-print">{pdfNote}</div>}

      <div className="sheet-toolbar no-print">
        <label>
          Teaching load
          <select value={load?.id || ""} onChange={(event) => onSelectLoad(event.target.value)}>
            {loads.map((item) => (
              <option key={item.id} value={item.id}>
                G{item.gradeLevel} {item.section} — {item.subject}
              </option>
            ))}
          </select>
        </label>
        <div className="att-month-nav">
          <button type="button" className="ghost" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label="Previous month">
            ‹
          </button>
          <strong>{formatMonthLabel(month)}</strong>
          <button type="button" className="ghost" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        {load && (
          <div className="form-preview">
            <span className="pill">{policyLabel(load.policy)}</span>
            <span className="pill">{load.learners.length} learners</span>
            <span className="pill">{stats.totals.sessionCount} school days</span>
          </div>
        )}
      </div>

      {load && (
        <>
          <div className="cards att-stats no-print">
            <Stat label="Present" value={stats.totals.present} tone="present" />
            <Stat label="Tardy" value={stats.totals.tardy} tone="tardy" />
            <Stat label="Absent" value={stats.totals.absent} tone="absent" />
            <Stat label="Excused" value={stats.totals.excused} tone="excused" />
            <Stat label="Absence rate" value={`${stats.totals.absenceRate}%`} />
          </div>

          <div className="att-filters no-print">
            <input
              className="roster-search"
              placeholder="Search name or LRN"
              value={filters.query || ""}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            />
            <select
              value={filters.sex || ""}
              onChange={(event) => setFilters((current) => ({ ...current, sex: event.target.value as "" | "M" | "F" }))}
              aria-label="Filter by sex"
            >
              <option value="">All sexes</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <select
              value={filters.status || ""}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as AttendanceFilters["status"],
                }))
              }
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="present">Present</option>
              <option value="tardy">Tardy</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
              <option value="no-class">No class</option>
            </select>
          </div>

          <div className="att-legend no-print" aria-label="Attendance legend">
            <span><b className="att-present">/</b> Present</span>
            <span><b className="att-tardy">T</b> Tardy</span>
            <span><b className="att-absent">X</b> Absent</span>
            <span><b className="att-excused">E</b> Excused</span>
            <span><b className="att-no-class">NC</b> No class</span>
          </div>

          <div className="sheet-export no-print">
            <button
              type="button"
              className="primary"
              onClick={() => {
                setRollDate(todayIso().startsWith(month) ? todayIso() : `${month}-01`);
                setRollOpen(true);
              }}
            >
              Roll call
            </button>
            <button type="button" className="ghost" onClick={() => setShowSf2((value) => !value)}>
              {showSf2 ? "Hide SF2 preview" : "Preview SF2"}
            </button>
            <button
              type="button"
              className="ghost"
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
              Download SF2 PDF
            </button>
            <button type="button" className="ghost" onClick={() => printSf2Report()}>
              Print SF2
            </button>
          </div>

          <AttendanceGrid
            load={load}
            attendance={attendance}
            month={month}
            filters={filters}
            onToggleCell={onToggleCell}
          />

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
