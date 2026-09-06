import { useMemo, useRef, useState } from "react";
import { Icon } from "../../Icon";
import { learnerDisplayName, type Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import { parseSf1 } from "../../sf1";
import { cloneRosterOntoLoad } from "./clone";
import { addCsvLearnersToLoad } from "./csv";
import { LearnerAvatar } from "./LearnerAvatar";
import { LearnerForm } from "./LearnerForm";
import { upsertLearner } from "./learner";
import { attachSf1RosterToLoad } from "./sf1-link";
import { sortDepEdRoster } from "./sort";
import { transferableLoads, transferLearnerBetweenLoads } from "./transfer";
import { assignRoster } from "./avatars";
import { learnerNameCaps } from "../shell/labels";

type PanelMode = "list" | "add" | "edit" | "csv" | "clone" | "transfer";

export function RosterPanel({
  load,
  loads,
  onChange,
  onChangeMany,
  onBack: _onBack,
  onOpenSheet,
}: {
  load: TeachingLoad;
  loads: TeachingLoad[];
  onChange: (next: TeachingLoad) => Promise<void> | void;
  onChangeMany?: (next: TeachingLoad[]) => Promise<void> | void;
  onBack: () => void;
  onOpenSheet: () => void;
}) {
  const [mode, setMode] = useState<PanelMode>("list");
  const [editing, setEditing] = useState<Learner | null>(null);
  const [query, setQuery] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloneId, setCloneId] = useState("");
  const [cloneMode, setCloneMode] = useState<"merge" | "overwrite">("merge");
  const [transferId, setTransferId] = useState("");
  const [transferTerm, setTransferTerm] = useState<Term>("1");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const learners = useMemo(() => sortDepEdRoster(load.learners), [load.learners]);
  const males = learners.filter((item) => item.sex === "M").length;
  const females = learners.filter((item) => item.sex === "F").length;
  const filtered = query.trim()
    ? learners.filter((item) =>
        `${learnerDisplayName(item)} ${item.lrn}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : learners;
  const cloneSources = loads.filter((item) => item.id !== load.id && item.learners.length > 0);
  const transferTargets = transferableLoads(load, loads);

  const persist = async (next: TeachingLoad) => {
    await onChange(next);
    setMode("list");
    setEditing(null);
    setError(null);
  };

  const onSf1 = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = parseSf1(await file.arrayBuffer());
      if (parsed.learners.length === 0) {
        setError(parsed.warnings[0] ?? "No learners found in this file.");
        return;
      }
      await persist(attachSf1RosterToLoad(load, parsed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the SF1 file.");
    } finally {
      setBusy(false);
    }
  };

  const applyCsv = async () => {
    const result = addCsvLearnersToLoad(load.learners, csvText);
    if (result.imported === 0 && result.errors.length) {
      setError(result.errors[0]);
      return;
    }
    await persist({
      ...load,
      learners: assignRoster(sortDepEdRoster(result.learners)),
      updatedAt: new Date().toISOString(),
    });
    setCsvNotice(`Imported ${result.imported}. Skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}.`);
    setCsvText("");
  };

  const applyClone = async () => {
    const source = loads.find((item) => item.id === cloneId);
    if (!source) return;
    await persist(cloneRosterOntoLoad(source, load, cloneMode));
  };

  const applyTransfer = async () => {
    if (!editing) return;
    const target = loads.find((item) => item.id === transferId);
    if (!target) return;
    try {
      const result = transferLearnerBetweenLoads(load, target, editing.id, transferTerm);
      if (onChangeMany) await onChangeMany([result.source, result.target]);
      else {
        await onChange(result.source);
        await onChange(result.target);
      }
      setMode("list");
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    }
  };

  return (
    <section>
      {error && <div className="banner error">{error}</div>}
      {csvNotice && <div className="banner warn">{csvNotice}</div>}

      <input
        ref={fileRef}
        type="file"
        accept=".xls,.xlsx,.csv"
        hidden
        onChange={(e) => void onSf1(e)}
      />

      {mode === "add" || mode === "edit" ? (
        <div className="card">
          <LearnerForm
            learner={mode === "edit" ? editing : null}
            roster={load.learners}
            onCancel={() => { setMode("list"); setEditing(null); }}
            onSave={(learner) => void persist(upsertLearner(load, learner))}
          />
        </div>
      ) : null}

      {mode === "csv" && (
        <div className="card">
          <h3>Bulk CSV paste</h3>
          <p className="muted">
            One learner per line: <code>LRN, Last Name, First Name, Sex</code>. Header row optional.
          </p>
          <textarea
            className="csv-paste"
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"123456789012, Santos, Juan, M\n123456789013, Reyes, Maria, F"}
          />
          <div className="form-row wrap">
            <button type="button" className="primary" onClick={() => void applyCsv()}>
              Import pasted rows
            </button>
            <button type="button" className="ghost" onClick={() => setMode("list")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "clone" && (
        <div className="card">
          <h3>Clone roster from another load</h3>
          <div className="form-grid">
            <label>
              Source
              <select value={cloneId} onChange={(e) => setCloneId(e.target.value)}>
                <option value="">Select a teaching load</option>
                {cloneSources.map((item) => (
                  <option key={item.id} value={item.id}>
                    G{item.gradeLevel} {item.section} — {item.subject} ({item.learners.length})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mode
              <select value={cloneMode} onChange={(e) => setCloneMode(e.target.value as "merge" | "overwrite")}>
                <option value="merge">Merge (skip duplicates)</option>
                <option value="overwrite">Overwrite this roster</option>
              </select>
            </label>
          </div>
          <div className="form-row wrap">
            <button type="button" className="primary" disabled={!cloneId} onClick={() => void applyClone()}>
              Clone roster
            </button>
            <button type="button" className="ghost" onClick={() => setMode("list")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "transfer" && editing && (
        <div className="card">
          <h3>Transfer {learnerDisplayName(editing)}</h3>
          <p className="muted">
            Completed term grades stay on this load as T/O and copy to the destination as T/I.
          </p>
          <div className="form-grid">
            <label>
              Destination
              <select value={transferId} onChange={(e) => setTransferId(e.target.value)}>
                <option value="">Select a teaching load</option>
                {transferTargets.map((item) => (
                  <option key={item.id} value={item.id}>
                    G{item.gradeLevel} {item.section} — {item.subject}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Through term
              <select value={transferTerm} onChange={(e) => setTransferTerm(e.target.value as Term)}>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </label>
          </div>
          <div className="form-row wrap">
            <button type="button" className="primary" disabled={!transferId} onClick={() => void applyTransfer()}>
              Transfer learner
            </button>
            <button type="button" className="ghost" onClick={() => { setMode("list"); setEditing(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="roster-card-head">
          <div>
            <h3>Class Roster</h3>
            <p className="muted small">
              {learners.length} learners · {males} male · {females} female · DepEd name order
            </p>
          </div>
          <div className="roster-page-actions">
            <button type="button" className="primary" onClick={() => { setEditing(null); setMode("add"); }}>
              + Add Learner
            </button>
            <button
              type="button"
              className="ghost btn-olive"
              onClick={() => void persist({ ...load, learners: assignRoster(sortDepEdRoster(load.learners)), updatedAt: new Date().toISOString() })}
            >
              Sort Roster
            </button>
            <button
              type="button"
              className="ghost btn-danger"
              onClick={() => {
                if (!window.confirm("Clear every learner from this class?")) return;
                void persist({ ...load, learners: [], updatedAt: new Date().toISOString() });
              }}
            >
              Clear All
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" /> {busy ? "Reading…" : "Import SF1"}
            </button>
            <button type="button" className="ghost" onClick={() => setMode("csv")}>
              Paste CSV
            </button>
            <button type="button" className="ghost" onClick={() => setMode("clone")} disabled={cloneSources.length === 0}>
              Clone roster
            </button>
          </div>
        </div>
        <input
          className="roster-search"
          placeholder="Search name or LRN"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="table-scroll">
          <table className="roster-table">
            <thead>
              <tr>
                <th>#</th>
                <th />
                <th>LRN</th>
                <th>Name</th>
                <th>Sex</th>
                <th>Birthdate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((learner, index) => (
                <tr key={learner.id} className={learner.transferredOutTerm ? "transferred-out" : undefined}>
                  <td>{index + 1}</td>
                  <td>
                    <LearnerAvatar presetId={learner.avatarPresetId} size="sm" />
                  </td>
                  <td className="muted">{learner.lrn || "—"}</td>
                  <td>
                    {learnerNameCaps(learnerDisplayName(learner))}
                    {learner.transferredOutTerm ? (
                      <span className="pill">T/O T{learner.transferredOutTerm}</span>
                    ) : null}
                    {learner.transferredInGrades ? <span className="pill">T/I</span> : null}
                  </td>
                  <td>{learner.sex || "—"}</td>
                  <td className="muted">{learner.birthdate || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="ghost small row-btn" onClick={onOpenSheet}>
                        Export
                      </button>
                      <button
                        type="button"
                        className="ghost small row-btn btn-olive"
                        disabled={transferTargets.length === 0}
                        onClick={() => {
                          setEditing(learner);
                          setTransferId("");
                          setMode("transfer");
                        }}
                      >
                        Transfer
                      </button>
                      <button
                        type="button"
                        className="ghost small row-btn btn-danger"
                        onClick={() => {
                          setEditing(learner);
                          setMode("edit");
                        }}
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted center">
                    No learners yet. Add one, paste CSV, or import an SF1.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
