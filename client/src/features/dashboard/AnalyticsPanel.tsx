import type { WorkplaceAnalytics } from "../../domain/workplace";

export function AnalyticsPanel({
  analytics,
  currentTerm,
  onOpenSheet,
}: {
  analytics: WorkplaceAnalytics;
  currentTerm: string;
  onOpenSheet: (loadId: string) => void;
}) {
  const coverage = analytics.scoreCoverage;
  const performance = analytics.componentPerformance;
  return (
    <div className="workplace-analytics">
      <div className="cards">
        <div className="card stat">
          <span className="stat-label">Score entry</span>
          <span className="stat-value">{coverage.percent}%</span>
          <span className="stat-hint">
            {coverage.entered} of {coverage.expected} cells · Term {currentTerm}
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">HPS ready</span>
          <span className="stat-value">{analytics.hpsPercent}%</span>
          <span className="stat-hint">
            {analytics.hpsReady} of {analytics.assessments} assessments
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Component mix</span>
          <span className="stat-value">{analytics.assessments}</span>
          <span className="stat-hint">
            WW {analytics.mix.written} · PT {analytics.mix.performance} · Exam {analytics.mix.quarterly}
          </span>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Score entry by class</h3>
          <p className="muted small">All active classes · Term {currentTerm}</p>
          {coverage.byClass.length === 0 ? (
            <p className="muted">Add a teaching load to start seeing class progress.</p>
          ) : (
            coverage.byClass.map((row) => (
              <button type="button" className="dash-subject" key={row.id} onClick={() => onOpenSheet(row.id)}>
                <span className="dash-link">
                  <span>
                    {row.label} {row.subject}
                  </span>
                  <span className="muted">{row.percent}%</span>
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${row.percent}%` }} />
                </div>
                <span className="muted small">
                  {row.entered} of {row.expected} scores entered
                </span>
              </button>
            ))
          )}
        </div>
        <div className="card">
          <h3>Component performance</h3>
          <p className="muted small">Working class results · Term {currentTerm}</p>
          {(
            [
              ["written", "Written Work", performance.written],
              ["performance", "Performance Task", performance.performance],
              ["quarterly", "Examination", performance.quarterly],
            ] as const
          ).map(([key, label, bucket]) => (
            <div className="dash-term-bar" key={key}>
              <div className="bar-meta">
                <span>{label}</span>
                <span className="muted">{bucket.percent === null ? "—" : `${bucket.percent}%`}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${bucket.percent ?? 0}%` }} />
              </div>
              <span className="muted small">{bucket.coverage}% of scores entered</span>
            </div>
          ))}
          {analytics.emptyCategories.length > 0 ? (
            <p className="muted small">Missing categories: {analytics.emptyCategories.join(", ")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
