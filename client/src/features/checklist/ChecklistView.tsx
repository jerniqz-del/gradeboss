import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import {
  addChecklistActivity,
  addChecklistCriterion,
  applyChecklistActivityPublication,
  applyChecklistEntryTransaction,
  bulkMarkChecklist,
  clearToolsPin,
  ensureChecklist,
  findChecklist,
  hasToolsPin,
  isChecklistActivityPublished,
  nudgeChecklistEntry,
  requireToolsPin,
  resetSessionEntries,
  setEntryNote,
  setToolsPin,
  undoLastChecklistEntryChange,
  unlockChecklistActivity,
  upsertChecklist,
  visibleSessions,
  type ActivityPublicationPlan,
} from "../../domain/checklist";
import { isMapehSubject } from "../../domain/grading";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { policyLabel } from "../teaching-loads/create-load";
import { AddActivityForm } from "./AddActivityForm";
import { BulkMarkModal } from "./BulkMarkModal";
import { ChecklistGrid } from "./ChecklistGrid";
import { PublishModal } from "./PublishModal";

export function ChecklistView({
  selectedLoadId,
  onSelectLoad,
  onOpenSheet,
}: {
  selectedLoadId: string | null;
  onSelectLoad: (id: string) => void;
  onOpenSheet?: (id: string) => void;
}) {
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [load, setLoad] = useState<TeachingLoad | null>(null);
  const [term, setTerm] = useState<Term>("1");
  const [mapePart, setMapePart] = useState<MapePart>("music_arts");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [publishActivityId, setPublishActivityId] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [pinSet, setPinSet] = useState(() => hasToolsPin());

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
        setError(err instanceof Error ? err.message : "Failed to open checklist");
      }
    })();
  }, [onSelectLoad, refreshList, selectedLoadId]);

  const mapeh = load ? isMapehSubject(load.subject) : false;
  const activePart = mapeh ? mapePart : "";

  const persistChain = useRef(Promise.resolve());
  const loadRef = useRef<TeachingLoad | null>(null);
  loadRef.current = load;
  const termRef = useRef(term);
  termRef.current = term;
  const partRef = useRef<MapePart | "">(mapeh ? mapePart : "");
  partRef.current = mapeh ? mapePart : "";

  const persist = useCallback((next: TeachingLoad) => {
    loadRef.current = next;
    setLoad(next);
    setLoads((current) => current.map((item) => (item.id === next.id ? next : item)));
    persistChain.current = persistChain.current
      .then(async () => {
        const latest = loadRef.current;
        if (latest) await api.saveTeachingLoad(latest);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to save checklist");
      });
    return persistChain.current;
  }, []);

  const currentChecklist = () => {
    const currentLoad = loadRef.current;
    if (!currentLoad) return null;
    return { load: currentLoad, checklist: findChecklist(currentLoad, termRef.current, partRef.current) };
  };

  useEffect(() => {
    if (!load) return;
    if (findChecklist(load, term, activePart)) return;
    persist(ensureChecklist(load, term, activePart).load);
  }, [activePart, load, persist, term]);

  const checklist = load ? findChecklist(load, term, activePart) : undefined;
  const workingLoad = load;

  const applyChecklist = (nextChecklist: NonNullable<typeof checklist>, nextLoad = loadRef.current) => {
    if (!nextLoad) return persistChain.current;
    return persist(upsertChecklist(nextLoad, nextChecklist));
  };

  const savePoints = (sessionId: string, learnerId: string, criterionId: string, value: number | "") => {
    const ctx = currentChecklist();
    if (!ctx?.checklist) return;
    try {
      const tracked = applyChecklistEntryTransaction(ctx.checklist, ctx.load, [{ sessionId, learnerId, criterionId, value }], { operation: "entry" });
      void applyChecklist(tracked.checklist, ctx.load);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that score.");
    }
  };

  const onNudge = (sessionId: string, learnerId: string, criterionId: string, delta: number) => {
    const ctx = currentChecklist();
    if (!ctx?.checklist) return;
    try {
      const nudged = nudgeChecklistEntry(ctx.checklist, ctx.load, sessionId, learnerId, criterionId, delta);
      const after = nudged.sessions.find((item) => item.id === sessionId)?.entries?.[learnerId]?.[criterionId];
      const tracked = applyChecklistEntryTransaction(ctx.checklist, ctx.load, [{ sessionId, learnerId, criterionId, value: after ? after.points : "" }], {
        operation: "entry",
      });
      void applyChecklist(tracked.checklist, ctx.load);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update points.");
    }
  };

  const onEditNote = (sessionId: string, learnerId: string, criterionId: string, note: string) => {
    const ctx = currentChecklist();
    if (!ctx?.checklist) return;
    try {
      void applyChecklist(setEntryNote(ctx.checklist, ctx.load, sessionId, learnerId, criterionId, note), ctx.load);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note.");
    }
  };

  if (loads.length === 0) {
    return (
      <section>
        <div className="page-header">
          <h2>Performance checklist</h2>
          <p>Create a teaching load with a roster first, then track recitation, notebook, and assignment points here.</p>
        </div>
      </section>
    );
  }

  const sessions = checklist ? visibleSessions(checklist) : [];
  const publishable = sessions.find((session) => session.activity && session.activity.destinationComponent !== "TRACKING");

  return (
    <section className="chk-page">
      <div className="page-header">
        <h2>Performance checklist</h2>
        <p>Mark recitation, notebook, and custom activities, then publish totals into WW or PT columns. Works offline.</p>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <div className="sheet-toolbar">
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
        {load && (
          <div className="form-preview">
            <span className="pill">{policyLabel(load.policy)}</span>
            <span className="pill">{load.learners.length} learners</span>
          </div>
        )}
      </div>

      <div className="sheet-tabs" role="tablist" aria-label="Term">
        {(["1", "2", "3"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={term === id} className={term === id ? "sheet-tab active" : "sheet-tab"} onClick={() => setTerm(id)}>
            Term {id}
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

      {checklist && workingLoad && (
        <>
          <div className="chk-actions">
            <label className="chk-search">
              Search
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or LRN" />
            </label>
            <AddActivityForm
              checklist={checklist}
              onAdd={(input) => {
                try {
                  void applyChecklist(addChecklistActivity(checklist, input));
                  setNotice(`Added ${input.title}.`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add activity.");
                }
              }}
            />
            <button type="button" className="ghost" data-testid="chk-bulk" onClick={() => setBulkOpen(true)}>
              Bulk mark
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                try {
                  void applyChecklist(undoLastChecklistEntryChange(checklist));
                  setNotice("Undid the last checklist change.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Nothing to undo.");
                }
              }}
            >
              Undo
            </button>
            <button
              type="button"
              className="primary"
              data-testid="chk-publish"
              disabled={!publishable}
              onClick={() => setPublishActivityId(publishable?.activity?.id || publishable?.id || null)}
            >
              Publish to sheet
            </button>
            {onOpenSheet && (
              <button type="button" className="ghost" onClick={() => onOpenSheet(workingLoad.id)}>
                Open sheet
              </button>
            )}
          </div>

          <ChecklistGrid
            load={workingLoad}
            checklist={checklist}
            query={query}
            onNudge={onNudge}
            onSetPoints={savePoints}
            onEditNote={onEditNote}
          />

          <div className="card chk-extra">
            <h3>Custom criterion</h3>
            <form
              className="form-row"
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  void applyChecklist(addChecklistCriterion(checklist, { label: customLabel, destinationComponent: "WW", scoringMode: "NUMERIC", maxPointsPerSession: 10 }));
                  setCustomLabel("");
                  setNotice("Added a custom criterion. Use Add activity to start a column.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add criterion.");
                }
              }}
            >
              <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="e.g. Group work" />
              <button type="submit" className="primary" disabled={!customLabel.trim()}>
                Add type
              </button>
            </form>
            <p className="muted">Default types are Recitation, Notebook, and Assignment. Custom types appear in Add activity.</p>
          </div>

          <div className="card chk-extra">
            <h3>Publication PIN</h3>
            <p className="muted">Optional 4–8 digit PIN, stored only on this device. If set, publishing to WW/PT requires it.</p>
            <form
              className="form-row"
              onSubmit={(event) => {
                event.preventDefault();
                void (async () => {
                  try {
                    await setToolsPin(pinValue);
                    setPinSet(true);
                    setPinValue("");
                    setNotice("Publication PIN saved on this device.");
                    setError(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not save PIN.");
                  }
                })();
              }}
            >
              <input type="password" inputMode="numeric" autoComplete="new-password" value={pinValue} onChange={(event) => setPinValue(event.target.value)} placeholder="4–8 digits" />
              <button type="submit" className="primary">
                {pinSet ? "Replace PIN" : "Set PIN"}
              </button>
              {pinSet && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    clearToolsPin();
                    setPinSet(false);
                    setNotice("Publication PIN removed.");
                  }}
                >
                  Remove PIN
                </button>
              )}
            </form>
          </div>

          {sessions.map((session) =>
            isChecklistActivityPublished(session) ? (
              <div key={`unlock-${session.id}`} className="card chk-extra">
                <p>
                  <strong>{session.activity?.title}</strong> is published and locked.
                </p>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    try {
                      const unlocked = unlockChecklistActivity(checklist, workingLoad, session.activity?.id || session.id);
                      void persist(upsertChecklist(unlocked.load, unlocked.checklist));
                      setNotice("Reverted official scores and unlocked this activity.");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not unlock.");
                    }
                  }}
                >
                  Unlock / revert publication
                </button>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => {
                    try {
                      const reset = resetSessionEntries(checklist, workingLoad, session.id);
                      void applyChecklist(reset.checklist);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not reset.");
                    }
                  }}
                >
                  Reset entries
                </button>
              </div>
            ) : null,
          )}
        </>
      )}

      {bulkOpen && checklist && workingLoad && (
        <BulkMarkModal
          load={workingLoad}
          checklist={checklist}
          onClose={() => setBulkOpen(false)}
          onApply={(sessionId, criterionId, points, scope) => {
            try {
              const ctx = currentChecklist();
              if (!ctx?.checklist) return;
              const result = bulkMarkChecklist(ctx.checklist, ctx.load, sessionId, criterionId, points, scope);
              void applyChecklist(result.checklist, ctx.load);
              setBulkOpen(false);
              setNotice("Bulk mark applied.");
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not bulk mark.");
            }
          }}
        />
      )}

      {publishActivityId && checklist && workingLoad && (
        <PublishModal
          load={workingLoad}
          checklist={checklist}
          activityId={publishActivityId}
          onClose={() => setPublishActivityId(null)}
          onPublish={async (plan: ActivityPublicationPlan, pin: string) => {
            await requireToolsPin(pin);
            const ctx = currentChecklist();
            if (!ctx?.checklist) throw new Error("The checklist is no longer available.");
            const published = applyChecklistActivityPublication(ctx.checklist, ctx.load, plan);
            await persist(upsertChecklist(published.load, published.checklist));
            setPublishActivityId(null);
            setNotice(`Published ${plan.activityTitle} to ${plan.assessmentTitle}.`);
          }}
        />
      )}
    </section>
  );
}
