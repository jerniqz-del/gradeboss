import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { isMapehSubject } from "../../domain/grading";
import { scoreKey } from "../../models/assessment";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { formatWeights, policyLabel } from "../teaching-loads/create-load";
import { ScoreGrid } from "./ScoreGrid";
import { SummaryTable } from "./SummaryTable";

type SheetTab = Term | "summary";

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
          <p>Enter scores by term. The Summary tab shows finals, annual average, and pass/fail.</p>
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
            <SummaryTable load={load} />
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
