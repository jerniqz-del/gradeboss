import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { api } from "../../api";
import { listClasses } from "../../classes";
import {
  computeDashboardInsights,
  type DashboardInsights,
  type LoadInsights,
  type PendingTask,
  type StandingRow,
} from "../../domain/grading";
import { workplaceSnapshot, type WorkplaceSnapshot } from "../../domain/workplace";
import { getAdvisoryStore } from "../../storage/repositories/advisory";
import { getCalendarStore } from "../../storage/repositories/calendar";
import {
  addWorkplaceTask,
  getWorkplaceStore,
  removeWorkplaceTask,
  toggleWorkplaceTask,
} from "../../storage/repositories/workplace";
import { getTeacherProfile, saveTeacherProfile } from "../../storage/init";
import { openGradeBossDb } from "../../storage/db";
import { createDefaultProfile } from "../../models/teacher-profile";
import type { Term } from "../../models/types";
import { rememberWorkplaceContext, updateWorkplacePreferences } from "../../storage/repositories/workplace";
import { persistLocalDatabase } from "../../storage/local-profile";
import { notifyWorkspaceChanged } from "../shell/chrome";
import { classOptionLabel, classTitle, countSex, firstName, greetingFor } from "../shell/labels";
import { gradeTone } from "../grading-sheet/grade-tone";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { WorkplacePanel, type WorkplaceNavigate } from "./WorkplacePanel";
import { activeAdvisoryClass } from "../../domain/advisory";
import type { AdvisoryStore } from "../../models/advisory";
import type { TeachingLoad } from "../../models/teaching-load";

export function DashboardView({
  onOpenSheet,
  onOpenAdvisory,
  onOpenCalendar,
  onOpenClasses,
  onOpenLoads,
}: {
  onOpenSheet: (loadId: string) => void;
  onOpenAdvisory?: () => void;
  onOpenCalendar?: (date?: string) => void;
  onOpenClasses?: () => void;
  onOpenLoads?: (loadId?: string) => void;
}) {
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [workplace, setWorkplace] = useState<WorkplaceSnapshot | null>(null);
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [advisory, setAdvisory] = useState<AdvisoryStore | null>(null);
  const [teacherName, setTeacherName] = useState("teacher");
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const [nextLoads, nextAdvisory, calendar, workStore, db] = await Promise.all([
      api.getTeachingLoads(),
      getAdvisoryStore(),
      getCalendarStore(),
      getWorkplaceStore(),
      openGradeBossDb(),
    ]);
    const profile = await getTeacherProfile(db);
    setLoads(nextLoads);
    setAdvisory(nextAdvisory);
    setTeacherName(profile?.teacherName || "teacher");
    setInsights(computeDashboardInsights(nextLoads));
    setWorkplace(
      workplaceSnapshot({
        loads: nextLoads,
        schoolYear: profile?.schoolYear || nextLoads[0]?.schoolYear || "2026-2027",
        currentTerm: profile?.currentTerm || "1",
        currentLoadId: profile?.currentTeachingLoadId,
        workplace: workStore,
        advisory: nextAdvisory,
        schoolClasses: listClasses(),
        calendarEvents: calendar.events,
        calendarFilters: calendar.filters,
      }),
    );
    setError(null);
  }, []);

  const persistContext = async (loadId: string, term: Term) => {
    const db = await openGradeBossDb();
    const profile = (await getTeacherProfile(db)) || createDefaultProfile();
    profile.currentTeachingLoadId = loadId;
    profile.currentTerm = term;
    await saveTeacherProfile(db, profile);
    await rememberWorkplaceContext({ assignmentId: loadId, term });
    await persistLocalDatabase();
    notifyWorkspaceChanged();
    await loadDashboard();
  };

  useEffect(() => {
    void loadDashboard().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    });
  }, [loadDashboard]);

  const navigate: WorkplaceNavigate = {
    onOpenSheet,
    onOpenAdvisory,
    onOpenCalendar,
    onOpenClasses,
    onOpenLoads,
  };

  if (error) {
    return (
      <section>
        <div className="page-header">
          <h2>Dashboard</h2>
          <p>DepEd completion and term standings for your teaching loads.</p>
        </div>
        <div className="banner error">{error}</div>
      </section>
    );
  }

  if (!insights) {
    return (
      <section>
        <div className="page-header">
          <h2>Dashboard</h2>
          <p>DepEd completion and term standings for your teaching loads.</p>
        </div>
        <p className="muted">Loading teaching loads…</p>
      </section>
    );
  }

  if (insights.loadCount === 0) {
    return (
      <section>
        <div className="page-header">
          <h2>Dashboard</h2>
          <p>DepEd completion and term standings for your teaching loads.</p>
        </div>
        <div className="card empty-state">
          <p className="muted">Create a teaching load to see completion, class averages, and pending tasks.</p>
        </div>
        {onOpenAdvisory && (
          <div className="card advisory-dash-card">
            <div>
              <h3>Advisory Class</h3>
              <p className="muted">Set up your advisory section even before teaching loads exist.</p>
            </div>
            <button type="button" className="primary" onClick={onOpenAdvisory}>
              Open Advisory
            </button>
          </div>
        )}
      </section>
    );
  }

  const analytics = workplace?.analytics;
  const coverage = analytics?.scoreCoverage;
  const performance = analytics?.componentPerformance;
  const current = loads.find((item) => item.id === workplace?.currentLoadId) || loads[0];
  const advisoryClass = advisory ? activeAdvisoryClass(advisory, workplace?.schoolYear || current?.schoolYear || "2026-2027") : undefined;
  const learnerCount = workplace?.stats.learnerDisplay ?? insights.learnerCount;

  return (
    <section className="dash-ecr">
      <div className="dash-ecr-main">
        <div className="card dash-welcome">
          <div>
            <h2>
              {greetingFor()}, {firstName(teacherName)}.
            </h2>
            <p className="dash-welcome-kicker">
              {workplace?.stats.classes ?? insights.loadCount} classes • {learnerCount} learners
            </p>
          </div>
          <div className="dash-welcome-controls">
            <label>
              Working class
              <select
                value={workplace?.currentLoadId || current?.id || ""}
                onChange={(event) => void persistContext(event.target.value, (workplace?.currentTerm || "1") as Term)}
              >
                {loads.map((load) => (
                  <option key={load.id} value={load.id}>
                    {classOptionLabel(load)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Term
              <select
                value={workplace?.currentTerm || "1"}
                onChange={(event) => void persistContext(workplace?.currentLoadId || current?.id || "", event.target.value as Term)}
              >
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </label>
            <button type="button" className="primary" disabled={!current} onClick={() => current && onOpenSheet(current.id)}>
              Continue grading
            </button>
          </div>
        </div>

        {coverage && analytics && (
          <div className="dash-stat-grid">
            <div className="card stat dash-stat">
              <div>
                <span className="stat-label">Score entry</span>
                <span className="stat-value">{coverage.percent}%</span>
                <span className="stat-hint">
                  {coverage.entered} of {coverage.expected} cells
                </span>
              </div>
              <div className="dash-ring" style={{ "--p": coverage.percent } as CSSProperties} />
            </div>
            <div className="card stat dash-stat dash-stat--green">
              <div>
                <span className="stat-label">HPS ready</span>
                <span className="stat-value">{analytics.hpsPercent}%</span>
                <span className="stat-hint">
                  {analytics.hpsReady} of {analytics.assessments} assessments
                </span>
              </div>
              <div className="dash-ring" style={{ "--p": analytics.hpsPercent, "--ring": "#22c55e" } as CSSProperties} />
            </div>
            <div className="card stat dash-stat dash-stat--orange">
              <div>
                <span className="stat-label">Assessments</span>
                <span className="stat-value">{analytics.assessments}</span>
                <span className="stat-hint">Across {workplace?.stats.classes ?? loads.length} active classes</span>
              </div>
            </div>
            <div className="card stat dash-stat dash-stat--blue">
              <div>
                <span className="stat-label">Learners</span>
                <span className="stat-value">{learnerCount}</span>
                <span className="stat-hint">{workplace?.stats.learnerEntries ?? insights.enrollmentCount} class enrollments</span>
                <label className="include-dup">
                  <input
                    type="checkbox"
                    checked={workplace?.preferences.includeDuplicateLearners !== false}
                    onChange={(event) => {
                      void updateWorkplacePreferences({ includeDuplicateLearners: event.target.checked }).then(() => loadDashboard());
                    }}
                  />
                  Include duplicates
                </label>
              </div>
            </div>
          </div>
        )}

        {coverage && performance && (
          <div className="grid-2">
            <div className="card">
              <h3>Score entry by class</h3>
              {coverage.byClass.length === 0 ? (
                <p className="muted">Add a teaching load to start seeing class progress.</p>
              ) : (
                coverage.byClass.map((row) => (
                  <button type="button" className="dash-class-row" key={row.id} onClick={() => onOpenSheet(row.id)}>
                    <span className="dash-link">
                      <span>
                        {row.label} {row.subject}
                      </span>
                      <span className="muted">{row.percent}%</span>
                    </span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${row.percent}%`, background: "var(--primary)" }} />
                    </div>
                    <span className="muted small">
                      {row.entered} of {row.expected} scores entered
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="card">
              <h3>Overall class performance</h3>
              <p className="muted small">{current ? classTitle(current) : "Working class results"}</p>
              {(
                [
                  ["written", "Written Works", performance.written, "#3b82f6"],
                  ["performance", "Performance Tasks", performance.performance, "#22c55e"],
                  ["quarterly", "SA & TE", performance.quarterly, "#f59e0b"],
                ] as const
              ).map(([key, label, bucket, color]) => (
                <div className="dash-dual" key={key}>
                  <strong>{label}</strong>
                  <div className="bar-meta">
                    <span>Class achievement</span>
                    <span>{bucket.percent === null ? "—" : `${bucket.percent}%`}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${bucket.percent ?? 0}%`, background: color }} />
                  </div>
                  <div className="bar-meta">
                    <span>Entry completion</span>
                    <span>{bucket.coverage}%</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${bucket.coverage}%`, background: "var(--primary)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {workplace && (
          <WorkplacePanel
            attention={workplace.attention}
            upcoming={workplace.upcoming}
            tasks={workplace.tasks}
            onNavigate={navigate}
            onAddTask={async (title, dueDate) => {
              await addWorkplaceTask(title, dueDate);
              await loadDashboard();
            }}
            onToggleTask={async (id) => {
              await toggleWorkplaceTask(id);
              await loadDashboard();
            }}
            onRemoveTask={async (id) => {
              await removeWorkplaceTask(id);
              await loadDashboard();
            }}
          />
        )}

        {insights.pending.length > 0 && <PendingTasks tasks={insights.pending} onOpenSheet={onOpenSheet} />}

        <div className="grid-2">
          <StandingsTable rows={insights.standings} onOpenSheet={onOpenSheet} />
          <SubjectPerformance loads={insights.loads} onOpenSheet={onOpenSheet} />
        </div>
      </div>

      <aside className="dash-rail">
        <div className="dash-rail-head">
          <h3>My Classes &amp; Advisory</h3>
          <span className="muted">{loads.length} classes</span>
        </div>
        <div className="card">
          <h3>Advisory Class</h3>
          {advisoryClass ? (
            <>
              <p>
                Grade {advisoryClass.gradeLevel} — {advisoryClass.section}
              </p>
              <button type="button" className="ghost" onClick={onOpenAdvisory}>
                Open Advisory
              </button>
            </>
          ) : (
            <>
              <p className="muted">Not configured.</p>
              {onOpenAdvisory && (
                <button type="button" className="ghost" onClick={onOpenAdvisory}>
                  Set up advisory
                </button>
              )}
            </>
          )}
        </div>
        {loads.map((load) => {
          const sex = countSex(load.learners);
          const active = load.id === (workplace?.currentLoadId || current?.id);
          return (
            <button
              key={load.id}
              type="button"
              className={`rail-class ${active ? "is-active" : ""}`}
              onClick={() => void persistContext(load.id, (workplace?.currentTerm || "1") as Term)}
            >
              <strong>
                Grade {load.gradeLevel} - {load.section}
              </strong>
              <span className="muted">{load.subject}</span>
              <span className="muted small">
                {load.learners.length} learners M:{sex.male} F:{sex.female}
              </span>
            </button>
          );
        })}
        {onOpenLoads && (
          <button type="button" className="primary" onClick={() => onOpenLoads()}>
            Add Class
          </button>
        )}
        {onOpenClasses && (
          <button type="button" className="ghost" onClick={onOpenClasses}>
            Full View
          </button>
        )}
      </aside>
    </section>
  );
}

function PendingTasks({
  tasks,
  onOpenSheet,
}: {
  tasks: PendingTask[];
  onOpenSheet: (loadId: string) => void;
}) {
  const shown = tasks.slice(0, 8);
  return (
    <div className="card">
      <h3>Pending tasks</h3>
      <ul className="dash-tasks">
        {shown.map((task) => (
          <li key={task.id}>
            <button type="button" className={`dash-task dash-task--${task.severity}`} onClick={() => onOpenSheet(task.loadId)}>
              <span className="dash-task-title">{task.title}</span>
              <span className="muted">{task.detail}</span>
            </button>
          </li>
        ))}
      </ul>
      {tasks.length > shown.length ? (
        <p className="muted small">
          {tasks.length - shown.length} more task{tasks.length - shown.length === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}

function StandingsTable({
  rows,
  onOpenSheet,
}: {
  rows: StandingRow[];
  onOpenSheet: (loadId: string) => void;
}) {
  return (
    <div className="card">
      <h3>Student standings</h3>
      <p className="muted small">Ranked by transmuted annual grade, not raw percentage.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Learner</th>
              <th>Subject</th>
              <th>Final</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted center">
                  No transmuted grades yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <button type="button" className="dash-link" onClick={() => onOpenSheet(row.loadId)}>
                    <LearnerAvatar presetId={row.avatarPresetId} size="xs" />
                    <span>
                      {row.name}
                      <span className="muted small">
                        G{row.gradeLevel} {row.section}
                      </span>
                    </span>
                  </button>
                </td>
                <td>{row.subject}</td>
                <td>
                  {row.annualGrade === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className="badge" style={{ background: gradeTone(row.annualGrade) }}>
                      {row.display || String(row.annualGrade)}
                    </span>
                  )}
                </td>
                <td>
                  {row.passed === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className={row.passed ? "status-badge pass" : "status-badge fail"}>
                      {row.passed ? "Passed" : "Failed"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubjectPerformance({
  loads,
  onOpenSheet,
}: {
  loads: LoadInsights[];
  onOpenSheet: (loadId: string) => void;
}) {
  return (
    <div className="card">
      <h3>Subject performance</h3>
      <p className="muted small">Class average transmuted grade by term.</p>
      {loads.map((load) => (
        <div className="dash-subject" key={load.loadId}>
          <button type="button" className="dash-link" onClick={() => onOpenSheet(load.loadId)}>
            <span>{load.label}</span>
            <span className="muted">Final {load.classAverageDisplay}</span>
          </button>
          <div className="dash-term-bars">
            {load.termAverages.map((term) => {
              const width = term.average === null ? 0 : Math.min(100, Math.max(0, term.average));
              return (
                <div className="dash-term-bar" key={term.term}>
                  <div className="bar-meta">
                    <span>T{term.term}</span>
                    <span className="muted">{term.display}</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${width}%`,
                        background: term.average === null ? "var(--border)" : gradeTone(term.average),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
