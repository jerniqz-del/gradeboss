import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eventKindLabel,
  eventPillClass,
  monthGrid,
  summarizeMonth,
  upcomingEvents,
  visibleEventsForView,
} from "../../domain/calendar";
import { formatMonthLabel, monthValue, shiftMonth, todayIso } from "../../domain/attendance/calendar";
import {
  createEmptyCalendarStore,
  createLocalEventId,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarFilters,
  type CalendarStore,
} from "../../models/calendar";
import type { TeachingLoad } from "../../models/teaching-load";
import { api } from "../../api";
import {
  deleteLocalCalendarEvent,
  getCalendarStore,
  saveCalendarFilters,
  saveLocalCalendarEvent,
} from "../../storage/repositories/calendar";
import { getTeacherProfile } from "../../storage/init";
import { openGradeBossDb } from "../../storage/db";
import { Icon } from "../../Icon";

const LOCAL_TYPES: CalendarEventType[] = ["reminder", "milestone", "holiday"];

export function CalendarView({
  selectedLoadId,
  onSelectLoad,
  initialDate,
}: {
  selectedLoadId?: string | null;
  onSelectLoad?: (id: string) => void;
  initialDate?: string | null;
}) {
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [store, setStore] = useState<CalendarStore>(createEmptyCalendarStore());
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [month, setMonth] = useState(() => (initialDate ? initialDate.slice(0, 7) : monthValue()));
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  const refresh = useCallback(async () => {
    try {
      const [nextLoads, nextStore, db] = await Promise.all([
        api.getTeachingLoads(),
        getCalendarStore(),
        openGradeBossDb(),
      ]);
      const profile = await getTeacherProfile(db);
      setLoads(nextLoads);
      setStore(nextStore);
      setSchoolYear(profile?.schoolYear || nextLoads[0]?.schoolYear || "2026-2027");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filters = store.filters;
  const events = useMemo(
    () => visibleEventsForView(store.events, loads, filters, schoolYear),
    [store.events, loads, filters, schoolYear],
  );
  const cells = useMemo(() => monthGrid(month, events, today), [month, events, today]);
  const summary = useMemo(() => summarizeMonth(events, month), [events, month]);
  const upcoming = useMemo(() => upcomingEvents(events, today, 8), [events, today]);
  const dayEvents = selectedDate ? events.filter((event) => event.startDate <= selectedDate && event.endDate >= selectedDate) : [];

  const updateFilters = async (next: Partial<CalendarFilters>) => {
    const saved = await saveCalendarFilters({ ...filters, ...next });
    setStore(saved);
    if (next.loadId && onSelectLoad && next.loadId !== "all") onSelectLoad(next.loadId);
  };

  return (
    <section className="calendar-page">
      <div className="page-header">
        <h2>Calendar</h2>
        <p>Official DepEd dates, local events, and learner birthdays for {schoolYear}.</p>
      </div>
      {error && <div className="banner error">{error}</div>}

      <div className="calendar-toolbar">
        <div className="calendar-month-nav">
          <button type="button" className="ghost" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <h3>{formatMonthLabel(month)}</h3>
          <button type="button" className="ghost" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
          <button type="button" className="ghost" onClick={() => setMonth(monthValue())}>
            Today
          </button>
        </div>
        <div className="calendar-filters">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.official}
              onChange={(event) => void updateFilters({ official: event.target.checked })}
            />
            Official
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.local}
              onChange={(event) => void updateFilters({ local: event.target.checked })}
            />
            Local
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.birthdays}
              onChange={(event) => void updateFilters({ birthdays: event.target.checked })}
            />
            Birthdays
          </label>
          <label className="calendar-load-filter">
            <span className="muted small">Class</span>
            <select
              value={filters.loadId}
              onChange={(event) => void updateFilters({ loadId: event.target.value })}
            >
              <option value="all">All classes</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  G{load.gradeLevel} {load.section} — {load.subject}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="card calendar-card">
          <div className="calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid" role="grid" aria-label={formatMonthLabel(month)}>
            {cells.map((cell, index) =>
              cell.inMonth ? (
                <button
                  key={cell.date}
                  type="button"
                  className={[
                    "calendar-cell",
                    cell.isToday ? "calendar-cell--today" : "",
                    cell.events.length ? "calendar-cell--events" : "",
                    selectedDate === cell.date ? "calendar-cell--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedDate(cell.date)}
                >
                  <span className="calendar-cell-day">{cell.day}</span>
                  <span className="calendar-cell-pills">
                    {cell.events.slice(0, 3).map((event) => (
                      <span key={event.id} className={`calendar-pill calendar-pill--${eventPillClass(event.type)}`}>
                        {event.title}
                      </span>
                    ))}
                    {cell.events.length > 3 ? <span className="muted small">+{cell.events.length - 3}</span> : null}
                  </span>
                </button>
              ) : (
                <div key={`empty-${index}`} className="calendar-cell calendar-cell--empty" />
              ),
            )}
          </div>
          <footer className="calendar-legend" aria-label="Calendar legend">
            <span className="calendar-pill calendar-pill--holiday">Official holiday</span>
            <span className="calendar-pill calendar-pill--milestone">School activity</span>
            <span className="calendar-pill calendar-pill--exam">Assessment</span>
            <span className="calendar-pill calendar-pill--birthday">Birthday</span>
          </footer>
        </div>

        <aside className="calendar-sidebar">
          <div className="card">
            <h3>Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="muted">No upcoming events in the current filters.</p>
            ) : (
              <ul className="calendar-agenda">
                {upcoming.map((event) => (
                  <li key={event.id} className={`calendar-agenda-item calendar-agenda-item--${eventPillClass(event.type)}`}>
                    <button type="button" className="dash-link" onClick={() => setSelectedDate(event.startDate || event.date)}>
                      <span className="calendar-agenda-date">{event.date || event.startDate}</span>
                      <span className="calendar-agenda-title">{event.title}</span>
                      <span className="muted small">{eventKindLabel(event.type)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card calendar-summary-card">
            <h3>This month</h3>
            <ul className="calendar-summary">
              <li>
                <span>Official holidays</span>
                <strong>{summary.holidays}</strong>
              </li>
              <li>
                <span>Assessments</span>
                <strong>{summary.assessments}</strong>
              </li>
              <li>
                <span>School activities</span>
                <strong>{summary.activities}</strong>
              </li>
              <li>
                <span>Birthdays</span>
                <strong>{summary.birthdays}</strong>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {selectedDate && (
        <DayModal
          date={selectedDate}
          events={dayEvents}
          loads={loads}
          defaultLoadId={filters.loadId !== "all" ? filters.loadId : selectedLoadId || ""}
          onClose={() => setSelectedDate(null)}
          onSaved={async () => {
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function DayModal({
  date,
  events,
  loads,
  defaultLoadId,
  onClose,
  onSaved,
}: {
  date: string;
  events: CalendarEvent[];
  loads: TeachingLoad[];
  defaultLoadId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CalendarEventType>("reminder");
  const [loadId, setLoadId] = useState(defaultLoadId);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await saveLocalCalendarEvent({
        id: createLocalEventId(),
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        date,
        startDate: date,
        endDate: date,
        loadId: loadId || undefined,
      });
      setTitle("");
      setDescription("");
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="att-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="att-modal calendar-day-modal" role="dialog" aria-labelledby="calendar-day-title" onClick={(event) => event.stopPropagation()}>
        <div className="att-modal-head">
          <h3 id="calendar-day-title">Calendar — {date}</h3>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close">
            <Icon name="arrow-left" />
          </button>
        </div>
        <div className="calendar-day-events">
          {events.length === 0 ? <p className="muted">No events on this date yet.</p> : null}
          {events.map((event) => (
            <div key={event.id} className="calendar-day-event">
              <span className={`calendar-pill calendar-pill--${eventPillClass(event.type)}`}>{eventKindLabel(event.type)}</span>
              <strong>{event.title}</strong>
              {event.description ? <span className="muted small">{event.description}</span> : null}
              {event.observed ? <span className="muted small">Observed Feb 28 (non-leap year)</span> : null}
              {!event.immutable && !event.virtual && event.type !== "assessment" && event.type !== "exam" ? (
                <button
                  type="button"
                  className="ghost small"
                  onClick={async () => {
                    await deleteLocalCalendarEvent(event.id);
                    await onSaved();
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <form
          className="calendar-event-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h4>Add local event</h4>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reminder title" required />
          </label>
          <label>
            Notes
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional details" />
          </label>
          <label>
            Type
            <select value={type} onChange={(event) => setType(event.target.value as CalendarEventType)}>
              {LOCAL_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class
            <select value={loadId} onChange={(event) => setLoadId(event.target.value)}>
              <option value="">All classes</option>
              {loads.map((load) => (
                <option key={load.id} value={load.id}>
                  G{load.gradeLevel} {load.section} — {load.subject}
                </option>
              ))}
            </select>
          </label>
          <div className="att-modal-foot">
            <button type="button" className="ghost" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="primary" disabled={saving || !title.trim()}>
              Save event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
