import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { isMapehSubject } from "../../domain/grading";
import { recordScoreChange, recordScoreDiff } from "../../domain/scores/history";
import {
  applyLoadSnapshot,
  emptyUndoStacks,
  pushUndo,
  redoOnce,
  snapshotLoads,
  undoOnce,
} from "../../domain/scores/undo";
import { scoreKey } from "../../models/assessment";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { SheetExportBar } from "../exports/SheetExportBar";
import { formatWeights, policyLabel } from "../teaching-loads/create-load";
import { QuickGradeModal } from "./QuickGradeModal";
import { ScoreGrid } from "./ScoreGrid";
import { ScoreHistoryModal } from "./ScoreHistoryModal";
import { ScoreTransferModal } from "./ScoreTransferModal";
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
  const [stacks, setStacks] = useState(emptyUndoStacks);
  const [quickOpen, setQuickOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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
          setStacks(emptyUndoStacks());
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

  const persistMany = async (updated: TeachingLoad[]) => {
    await Promise.all(updated.map((item) => api.saveTeachingLoad(item)));
    setLoads((current) => current.map((item) => updated.find((row) => row.id === item.id) || item));
    const current = updated.find((item) => item.id === load?.id);
    if (current) setLoad(current);
  };

  const onScoreChange = (learnerId: string, assessmentId: string, value: number | "", source = "grading-sheet") => {
    if (!load) return;
    const key = scoreKey(learnerId, assessmentId);
    if ((load.scores[key] ?? "") === value) return;
    setStacks((current) => pushUndo(current, snapshotLoads([load])));
    const nextScores = { ...load.scores, [key]: value };
    if (value === "") delete nextScores[key];
    const next: TeachingLoad = { ...load, scores: nextScores };
    void persist(recordScoreChange(next, { learnerId, assessmentId, previousValue: load.scores[key], newValue: value, source }));
  };

  const onHpsChange = (assessmentId: string, maxScore: number) => {
    if (!load) return;
    const current = load.assessments.find((item) => item.id === assessmentId);
    if (!current || current.maxScore === maxScore) return;
    setStacks((currentStacks) => pushUndo(currentStacks, snapshotLoads([load])));
    void persist({
      ...load,
      assessments: load.assessments.map((item) => (item.id === assessmentId ? { ...item, maxScore } : item)),
    });
  };

  const runUndo = async () => {
    if (!load) return;
    const result = undoOnce(stacks, snapshotLoads([load]));
    if (!result) return;
    setStacks(result.stacks);
    const restored = { ...applyLoadSnapshot(load, result.snapshot.loads[0]), scoreHistory: load.scoreHistory };
    await persist(recordScoreDiff(restored, load.scores, restored.scores, "undo"));
  };

  const runRedo = async () => {
    if (!load) return;
    const result = redoOnce(stacks, snapshotLoads([load]));
    if (!result) return;
    setStacks(result.stacks);
    const restored = { ...applyLoadSnapshot(load, result.snapshot.loads[0]), scoreHistory: load.scoreHistory };
    await persist(recordScoreDiff(restored, load.scores, restored.scores, "redo"));
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
          <div className="print-only print-sheet-title">
            <h2>
              G{load.gradeLevel} {load.section} — {load.subject}
            </h2>
            <p>
              {load.schoolYear} · {policyLabel(load.policy)} · {tab === "summary" ? "Summary" : `Term ${tab}`}
            </p>
          </div>

          <div className="sheet-tabs no-print" role="tablist" aria-label="Term">
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

          {tab !== "summary" && (
            <div className="chk-actions no-print">
              <button type="button" className="ghost" disabled={!stacks.undo.length} onClick={() => void runUndo()}>
                Undo
              </button>
              <button type="button" className="ghost" disabled={!stacks.redo.length} onClick={() => void runRedo()}>
                Redo
              </button>
              <button type="button" className="ghost" onClick={() => setQuickOpen(true)}>
                Quick grade
              </button>
              <button type="button" className="ghost" onClick={() => setTransferOpen(true)}>
                Transfer scores
              </button>
              <button type="button" className="ghost" onClick={() => setHistoryOpen(true)}>
                Score history
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
              onScoreChange={(learnerId, assessmentId, value) => onScoreChange(learnerId, assessmentId, value)}
              onHpsChange={onHpsChange}
            />
          )}

          <SheetExportBar load={load} tab={tab} mapePart={activePart} />

          {onManageRoster && load && (
            <div className="card no-print">
              <p className="muted">Add, import, transfer, or clone learners from the roster panel.</p>
              <button type="button" className="primary" onClick={() => onManageRoster(load.id)}>
                Manage roster
              </button>
            </div>
          )}

          {quickOpen && tab !== "summary" && (
            <QuickGradeModal
              load={load}
              term={tab}
              mapePart={activePart}
              onClose={() => setQuickOpen(false)}
              onScoreChange={(learnerId, assessmentId, value) => onScoreChange(learnerId, assessmentId, value, "quick-grade")}
            />
          )}
          {transferOpen && tab !== "summary" && (
            <ScoreTransferModal
              loads={loads}
              current={load}
              term={tab}
              mapePart={activePart}
              onClose={() => setTransferOpen(false)}
              onApply={async (source, target) => {
                setStacks((currentStacks) => pushUndo(currentStacks, snapshotLoads([load, source, target].filter((item, index, all) => all.findIndex((row) => row.id === item.id) === index))));
                await persistMany(source.id === target.id ? [target] : [source, target]);
              }}
            />
          )}
          {historyOpen && tab !== "summary" && <ScoreHistoryModal load={load} term={tab} onClose={() => setHistoryOpen(false)} />}
        </>
      )}
    </section>
  );
}
