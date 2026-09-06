import { useState } from "react";
import { computeClassAnalysis } from "../exports/analysis";
import { isMapehSubject } from "../../domain/grading";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";

const BINS = ["0–19%", "20–39%", "40–59%", "60–79%", "80–100%"];

export function AnalysisPanel({ load }: { load: TeachingLoad }) {
  const mapeh = isMapehSubject(load.subject);
  const [term, setTerm] = useState<Term | "summary">("1");
  const [mapePart, setMapePart] = useState<MapePart>("music_arts");
  const analysis = computeClassAnalysis(load, term, mapeh ? mapePart : undefined);

  return (
    <div className="tools-panel">
      <div className="sheet-tabs" role="tablist" aria-label="Term">
        {(["1", "2", "3", "summary"] as const).map((id) => (
          <button key={id} type="button" className={term === id ? "sheet-tab active" : "sheet-tab"} onClick={() => setTerm(id)}>
            {id === "summary" ? "Summary" : `Term ${id}`}
          </button>
        ))}
      </div>
      {mapeh && (
        <div className="sheet-tabs mapeh" role="tablist" aria-label="MAPEH part">
          <button type="button" className={mapePart === "music_arts" ? "sheet-tab active" : "sheet-tab"} onClick={() => setMapePart("music_arts")}>
            Music &amp; Arts
          </button>
          <button type="button" className={mapePart === "pe_health" ? "sheet-tab active" : "sheet-tab"} onClick={() => setMapePart("pe_health")}>
            PE &amp; Health
          </button>
        </div>
      )}
      <div className="simulator-summary">
        <div>
          <span className="muted">Mean TG</span>
          <strong>{analysis.classStats.mean}</strong>
        </div>
        <div>
          <span className="muted">Pass rate</span>
          <strong>{analysis.classStats.passRate}%</strong>
        </div>
        <div>
          <span className="muted">MPS</span>
          <strong>{analysis.classStats.mps}</strong>
        </div>
        <div>
          <span className="muted">Std. dev.</span>
          <strong>{analysis.classStats.stdDev}</strong>
        </div>
      </div>
      <div className="analysis-scroll">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>MPS</th>
              <th>Mean</th>
              <th>Mastery</th>
              <th>Separation</th>
            </tr>
          </thead>
          <tbody>
            {analysis.assessments.map((item) => (
              <tr key={`${item.component}-${item.title}`}>
                <td>
                  {item.title}
                  <div className="dist-bars" aria-hidden="true">
                    {item.distribution.map((count, index) => (
                      <span
                        key={BINS[index]}
                        title={`${BINS[index]}: ${count}`}
                        style={{ height: `${item.takers ? Math.max(8, (count / item.takers) * 36) : 8}px` }}
                      />
                    ))}
                  </div>
                </td>
                <td>{item.mps}</td>
                <td>{item.mean}</td>
                <td>{item.mastery}</td>
                <td>{item.discriminationLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="analysis-scroll">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Learner</th>
              <th>WW</th>
              <th>PT</th>
              <th>Exam</th>
              <th>TG</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {analysis.learners.map((row) => (
              <tr key={`${row.rank}-${row.name}`}>
                <td>{row.rank || "—"}</td>
                <td>{row.name}</td>
                <td>{row.wwPs ?? "—"}</td>
                <td>{row.ptPs ?? "—"}</td>
                <td>{row.examPs ?? "—"}</td>
                <td>{row.termGrade}</td>
                <td>{row.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
