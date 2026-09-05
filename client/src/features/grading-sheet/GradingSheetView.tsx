import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
  computeMapehTermResult,
  computeTermResult,
  isMapehSubject,
  isPassing,
  transmuteForLoad,
} from "../../domain/grading";
import { scoreKey } from "../../models/assessment";
import { learnerDisplayName } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { sortDepEdRoster } from "../roster/sort";
import { formatWeights, policyLabel } from "../teaching-loads/create-load";
import { ScoreGrid } from "./ScoreGrid";

type SheetTab = Term | "summary";

function gradeTone(grade: number | string | null): string {
  if (grade === null || grade === "T/O") return "var(--muted)";
  if (typeof grade === "string") {
    return ["A", "B", "C"].includes(grade) ? "var(--green)" : "var(--red)";
  }
  if (grade >= 90) return "var(--green)";
  if (grade >= 80) return "var(--blue)";
  if (grade >= 75) return "var(--amber)";
  return "var(--red)";
}

export function GradingSheetView({
  selectedLoadId,
  onSelectLoad,
  onManageRoster,
}: {
  selectedLoadId: string | null;
  onSelectLoad: (id: string) => void;
  onManageRoster?: (id: string) => void;
}) {
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [load, setLoad] = useState<TeachingLoad | null>(null);
  const [tab, setTab] = useState<SheetTab>("1");
  const [mapePart, setMapePart] = useState<MapePart>("music_arts");
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    const next = await api.getTeachingLoads();
    setLoads(next);
    return next;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await refreshList();
        const id = selectedLoadId || list[0]?.id;
        if (id && id !== selectedLoadId) onSelectLoad(id);
        if (id) {
          const found = list.find((item) => item.id === id) || (await api.getTeachingLoad(id));
          setLoad(found ?? null);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open grading sheet");
      }
    })();
  }, [onSelectLoad, refreshList, selectedLoadId]);

  const persist = async (next: TeachingLoad) => {
    setLoad(next);
    await api.saveTeachingLoad(next);
    setLoads((current) => current.map((item) => (item.id === next.id ? next : item)));
  };

  const onScoreChange = (learnerId: string, assessmentId: string, value: number | "") => {
    if (!load) return;
    void persist({
      ...load,
      scores: { ...load.scores, [scoreKey(learnerId, assessmentId)]: value },
    });
  };

  const onHpsChange = (assessmentId: string, maxScore: number) => {
    if (!load) return;
    void persist({
      ...load,
      assessments: load.assessments.map((item) => (item.id === assessmentId ? { ...item, maxScore } : item)),
    });
  };

  const mapeh = load ? isMapehSubject(load.subject) : false;
  const activePart = mapeh ? mapePart : undefined;

  const summaryRows = useMemo(() => {
    if (!load || tab !== "summary") return [];
    return sortDepEdRoster(load.learners).map((learner) => {
      const terms: Term[] = ["1", "2", "3"];
      const igs: number[] = [];
      const termGrades = terms.map((term) => {
        if (mapeh) {
          const result = computeMapehTermResult(load, learner.id, term);
          if (result.musicArts.hasData) igs.push(result.musicArts.initialGrade);
          if (result.peHealth.hasData) igs.push(result.peHealth.initialGrade);
          return result.consolidatedGrade || null;
        }
        const result = computeTermResult(load, learner.id, term);
        if (result.hasData) igs.push(result.initialGrade);
        return result.termGrade;
      });
      const annual =
        igs.length > 0 ? transmuteForLoad(load, igs.reduce((sum, value) => sum + value, 0) / igs.length) : null;
      return { learner, termGrades, annual };
    });
  }, [load, mapeh, tab]);

  if (loads.length === 0) {
    return (
      <section>
        <div className="page-header">
          <h2>Grading sheet</h2>
          <p>Create a teaching load first, then enter term scores here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="sheet-page">
      <div className="page-header">
        <h2>Grading sheet</h2>
        <p>Enter scores by term. PS, IG, and TG update from the DepEd engine as you type.</p>
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="sheet-toolbar">
        <label>
          Teaching load
          <select
            value={load?.id || ""}
            onChange={(e) => onSelectLoad(e.target.value)}
          >
            {loads.map((item) => (
              <option key={item.id} value={item.id}>
                G{item.gradeLevel} {item.section} — {item.subject}
              </option>
            ))}
          </select>
        </label>
        {load && (
          <div className="form-preview">
            <span className="pill">{policyLabel(load.policy)}</span>
            <span className="pill">Weights {formatWeights(load.subjectGroup)}</span>
            <span className="pill">{load.learners.length} learners</span>
          </div>
        )}
      </div>

      {load && (
        <>
          <div className="sheet-tabs" role="tablist" aria-label="Term">
            {(["1", "2", "3", "summary"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "sheet-tab active" : "sheet-tab"}
                onClick={() => setTab(id)}
              >
                {id === "summary" ? "Summary" : `Term ${id}`}
              </button>
            ))}
          </div>

          {mapeh && tab !== "summary" && (
            <div className="sheet-tabs mapeh" role="tablist" aria-label="MAPEH part">
              <button
                type="button"
                className={mapePart === "music_arts" ? "sheet-tab active" : "sheet-tab"}
                onClick={() => setMapePart("music_arts")}
              >
                Music &amp; Arts
              </button>
              <button
                type="button"
                className={mapePart === "pe_health" ? "sheet-tab active" : "sheet-tab"}
                onClick={() => setMapePart("pe_health")}
              >
                PE &amp; Health
              </button>
            </div>
          )}

          {tab === "summary" ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Term 1</th>
                    <th>Term 2</th>
                    <th>Term 3</th>
                    <th>Final</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.learner.id}>
                      <td>
                    {learnerDisplayName(row.learner)}
                    {row.learner.transferredOutTerm ? <span className="pill">T/O</span> : null}
                  </td>
                      {row.termGrades.map((grade, index) => (
                        <td key={index}>{grade === null ? "—" : String(grade)}</td>
                      ))}
                      <td>
                        {row.annual === null ? (
                          "—"
                        ) : (
                          <span className="badge" style={{ background: gradeTone(row.annual) }}>
                            {String(row.annual)}
                          </span>
                        )}
                      </td>
                      <td className={row.annual !== null && isPassing(row.annual) ? "pass" : "muted"}>
                        {row.annual === null ? "—" : isPassing(row.annual) ? "Passed" : "Failed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ScoreGrid
              load={load}
              term={tab}
              mapePart={activePart}
              onScoreChange={onScoreChange}
              onHpsChange={onHpsChange}
            />
          )}

          {onManageRoster && load && (
            <div className="card">
              <p className="muted">Add, import, transfer, or clone learners from the roster panel.</p>
              <button type="button" className="primary" onClick={() => onManageRoster(load.id)}>
                Manage roster
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
