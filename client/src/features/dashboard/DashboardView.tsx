import { useEffect, useState } from "react";
import { api } from "../../api";
import {
  computeDashboardInsights,
  type DashboardInsights,
  type LoadInsights,
  type PendingTask,
  type StandingRow,
} from "../../domain/grading";
import { completionTone, gradeTone } from "../grading-sheet/grade-tone";
import { LearnerAvatar } from "../roster/LearnerAvatar";

export function DashboardView({
  onOpenSheet,
  onOpenAdvisory,
}: {
  onOpenSheet: (loadId: string) => void;
  onOpenAdvisory?: () => void;
}) {
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const loads = await api.getTeachingLoads();
        setInsights(computeDashboardInsights(loads));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    })();
  }, []);

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

  const cards = [
    { label: "Teaching loads", value: insights.loadCount, hint: insights.loadCount === 1 ? "active subject" : "active subjects" },
    { label: "Learners", value: insights.learnerCount, hint: `${insights.enrollmentCount} enrollments` },
    {
      label: "Completion",
      value: `${insights.overallCompletion}%`,
      hint: `${insights.missingScores} missing scores`,
      accent: completionTone(insights.overallCompletion),
    },
    {
      label: "Class average",
      value: insights.overallAverage === null ? "—" : String(insights.overallAverage),
      hint: insights.failedCount ? `${insights.failedCount} failed` : `${insights.passedCount} passed`,
      accent: insights.overallAverage === null ? undefined : gradeTone(insights.overallAverage),
    },
  ];

  return (
    <section>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>DepEd completion, transmuted standings, and unfinished term work.</p>
      </div>

      {onOpenAdvisory && (
        <div className="card advisory-dash-card">
          <div>
            <h3>Advisory Class</h3>
            <p className="muted">Consolidate finals and import Grade Transfer Files for one section.</p>
          </div>
          <button type="button" className="primary" onClick={onOpenAdvisory}>
            Open Advisory
          </button>
        </div>
      )}

      <div className="cards">
        {cards.map((card) => (
          <div className="card stat" key={card.label}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value" style={{ color: card.accent }}>
              {card.value}
            </span>
            <span className="stat-hint">{card.hint}</span>
          </div>
        ))}
      </div>

      {insights.pending.length > 0 && <PendingTasks tasks={insights.pending} onOpenSheet={onOpenSheet} />}

      <h3 className="dash-section-title">Teaching loads</h3>
      <div className="cards dash-load-cards">
        {insights.loads.map((load) => (
          <LoadCard key={load.loadId} load={load} onOpen={() => onOpenSheet(load.loadId)} />
        ))}
      </div>

      <div className="grid-2">
        <StandingsTable rows={insights.standings} onOpenSheet={onOpenSheet} />
        <SubjectPerformance loads={insights.loads} onOpenSheet={onOpenSheet} />
      </div>
    </section>
  );
}

function LoadCard({ load, onOpen }: { load: LoadInsights; onOpen: () => void }) {
  return (
    <button type="button" className="card class-card dash-load-card" onClick={onOpen}>
      <div className="class-card-top">
        <h3>
          G{load.gradeLevel} {load.section}
        </h3>
        <span className="class-count">{load.completionPercent}%</span>
      </div>
      <p>{load.subject}</p>
      <p className="muted small">{load.schoolYear}</p>
      <div className="dash-load-meta">
        <span>{load.learnerCount} learners</span>
        <span>{load.missingScores} missing</span>
        <span>Avg {load.classAverageDisplay}</span>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${Math.min(100, load.completionPercent)}%`, background: completionTone(load.completionPercent) }}
        />
      </div>
      <div className="sex-chips">
        <span className="chip">{load.passedCount} passed</span>
        <span className="chip">{load.failedCount} failed</span>
        {load.incompleteCount > 0 ? <span className="chip">{load.incompleteCount} pending</span> : null}
      </div>
    </button>
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
