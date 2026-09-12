import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { isMapehSubject } from "../../domain/grading";
import { recordScoreChange } from "../../domain/scores/history";
import { scoreKey } from "../../models/assessment";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { printGradingSheet } from "../exports/print";
import { SheetExportBar } from "../exports/SheetExportBar";
import { downloadClassRecordPdf } from "../exports/pdf-class-record";
import { createDefaultProfile } from "../../models/teacher-profile";
import { ensureStorageReady, getTeacherProfile } from "../../storage/init";
import { ActiveClassBar } from "../shell/ActiveClassBar";
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
    const nextScores = { ...load.scores, [key]: value };
    if (value === "") delete nextScores[key];
    const next: TeachingLoad = { ...load, scores: nextScores };
    void persist(recordScoreChange(next, { learnerId, assessmentId, previousValue: load.scores[key], newValue: value, source }));
  };

  const onHpsChange = (assessmentId: string, maxScore: number) => {
    if (!load) return;
    const current = load.assessments.find((item) => item.id === assessmentId);
    if (!current || current.maxScore === maxScore) return;
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
      {error && <div className="banner error">{error}</div>}

      <ActiveClassBar
        loads={loads}
        selectedId={load?.id || ""}
        onSelect={onSelectLoad}
        controls={load ? (
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
        ) : null}
      >
        <button type="button" className="ghost" onClick={() => window.dispatchEvent(new Event("gradeboss:open-changelog"))}>
          Activity Log
        </button>
        <button type="button" className="ghost btn-cyan" onClick={() => printGradingSheet()}>
          Print
        </button>
        {load && (
          <button
            type="button"
            className="ghost btn-olive"
            onClick={() => {
              void (async () => {
                const db = await ensureStorageReady();
                const profile = (await getTeacherProfile(db)) || createDefaultProfile();
                downloadClassRecordPdf(load, { tab, mapePart: activePart, profile });
              })();
            }}
          >
            Download PDF
          </button>
        )}
      </ActiveClassBar>

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
            <div className="sheet-record-bar no-print">
              <div>
                <h3>Class Record — Term {tab}</h3>
                <p className="muted small">
                  {policyLabel(load.policy)} · Weights {formatWeights(load.subjectGroup)} · Saved locally
                </p>
              </div>
              <div className="roster-page-actions">
                <button type="button" className="ghost btn-cyan" data-testid="sheet-quick-grade" onClick={() => setQuickOpen(true)}>
                  Quick Grade Entry
                </button>
                <button type="button" className="ghost" data-testid="sheet-transfer" onClick={() => setTransferOpen(true)}>
                  Transfer Scores
                </button>
                <button type="button" className="ghost btn-olive" data-testid="sheet-history" onClick={() => setHistoryOpen(true)}>
                  View Learner&apos;s Grades
                </button>
                {onManageRoster && (
                  <button type="button" className="primary" onClick={() => onManageRoster(load.id)}>
                    Manage Roster
                  </button>
                )}
              </div>
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
