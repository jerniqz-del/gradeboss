import { useEffect, useRef, useState } from "react";
import type { User } from "../../auth";
import {
  CHANGELOG_ERROR, CHANGELOG_UPDATED, DATA_SAVED, checkpoint, getRestorePoint,
  logActivity, readChangelog, reportHistoryError, restorePoint, setHistoryOwner, type LogEntry,
} from "../../storage/changelog";

export const OPEN_CHANGELOG = "gradeboss:open-changelog";
export function Changelog({ user, view }: { user: User; view: string }) {
  const owner = user.id;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [filter, setFilter] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    let active = true;
    setHistoryOwner(owner);
    const refresh = () => { void readChangelog(owner).then((next) => { if (active) setRows(next); }).catch(reportHistoryError); };
    const show = () => { setOpen(true); refresh(); };
    const failure = (event: Event) => setError(String((event as CustomEvent).detail));
    const saved = (event: Event) => {
      void checkpoint(owner, user.name, String((event as CustomEvent).detail || "Saved changes")).catch(reportHistoryError);
    };
    const click = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("button, [role=button]") : null;
      if (!element || element.closest("[data-changelog]") || element.closest("form[data-sensitive]")) return;
      const label = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim();
      if (label) void logActivity(owner, user.name, "action", viewRef.current + " · Pressed " + label).catch(reportHistoryError);
    };
    const input = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
      if (element.closest("[data-changelog]")) return;
      const label = element.getAttribute("aria-label") || element.labels?.[0]?.textContent?.trim() || element.name || ("placeholder" in element ? element.placeholder : "") || "Field";
      if (element instanceof HTMLInputElement && ["password", "hidden", "file"].includes(element.type)) return;
      if (/password|pin|secret|token|credential/i.test(label + " " + element.name + " " + element.id + " " + element.autocomplete)) return;
      const value = element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type) ? String(element.checked) : element.value;
      void logActivity(owner, user.name, "input", viewRef.current + " · " + label + ": " + value.slice(0, 500)).catch(reportHistoryError);
    };
    window.addEventListener(OPEN_CHANGELOG, show);
    window.addEventListener(CHANGELOG_UPDATED, refresh);
    window.addEventListener(CHANGELOG_ERROR, failure);
    window.addEventListener(DATA_SAVED, saved);
    document.addEventListener("click", click, true);
    document.addEventListener("change", input, true);
    void checkpoint(owner, user.name, "Workspace when session opened").catch(reportHistoryError);
    refresh();
    return () => {
      active = false;
      setHistoryOwner(null);
      window.removeEventListener(OPEN_CHANGELOG, show);
      window.removeEventListener(CHANGELOG_UPDATED, refresh);
      window.removeEventListener(CHANGELOG_ERROR, failure);
      window.removeEventListener(DATA_SAVED, saved);
      document.removeEventListener("click", click, true);
      document.removeEventListener("change", input, true);
    };
  }, [owner, user.name]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => previous?.focus();
  }, [open]);

  const download = async (entry: LogEntry) => {
    try {
      const bundle = await getRestorePoint(owner, entry.snapshotId!);
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "gradeboss-restore-" + entry.at.replace(/[:.]/g, "-") + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { reportHistoryError(err); }
  };

  if (!open) return error ? <div className="banner error" role="alert">Changelog: {error} <button onClick={() => setOpen(true)}>Open Changelog</button></div> : null;
  const visible = rows.filter((row) => (row.label + " " + row.actor).toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="att-modal-backdrop" data-changelog>
      <div ref={modalRef} className="card att-modal changelog-modal" role="dialog" aria-modal="true" aria-labelledby="changelog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) { setOpen(false); setSelected(null); }
          if (event.key !== "Tab") return;
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <div className="att-modal-head">
          <h3 id="changelog-title">Changelog</h3>
          <button className="ghost" disabled={busy} onClick={() => { setOpen(false); setSelected(null); }}>Close</button>
        </div>
        <p className="muted">Timestamped activity and restore points for this profile on this device. Keeps the latest 1,000 actions and 100 restore points. History begins when this feature is enabled.</p>
        <p className="muted">Restore points cover classes, learners, grades, attendance, checklists, calendar, advisory, tasks, and teacher profile. Button activity is a record only; printing and downloads cannot be undone.</p>
        {error && <div className="banner error" role="alert">{error}</div>}
        <div className="changelog-tools">
          <input autoFocus aria-label="Search changelog" placeholder="Search history…" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <button className="primary" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await checkpoint(owner, user.name, "Manual restore point", true); }
            catch (err) { reportHistoryError(err); }
            finally { setBusy(false); }
          }}>Create restore point</button>
        </div>
        {selected && <div className="card" role="alert">
          <strong>Restore all workspace data to {new Date(selected.at).toLocaleString()}?</strong>
          <p>This replaces current saved data across all classes with this restore point. A backup of the current data will be saved first. The app will reload after restoring.</p>
          <button className="primary" disabled={busy} onClick={async () => {
            setBusy(true); setError("");
            try {
              await restorePoint(owner, user.name, selected);
              window.dispatchEvent(new Event("gradeboss:workspace-changed"));
              window.location.reload();
            } catch (err) { reportHistoryError(err); setBusy(false); }
          }}>{busy ? "Restoring…" : "Back up current data and restore"}</button>
          <button className="ghost" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
        </div>}
        <div className="changelog-entries">
          {visible.length === 0 && <p className="muted">No matching history yet.</p>}
          {visible.map((entry) => <article className="changelog-entry" key={entry.id}>
            <div>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
              <span className="pill">{entry.kind === "snapshot" ? "Restore point" : entry.kind === "input" ? "Input" : "Button / action"}</span>
              <p>{entry.label}</p>
              <small className="muted">{entry.actor}</small>
            </div>
            {entry.snapshotId && <div className="changelog-entry-actions">
              <button className="ghost" disabled={busy} onClick={() => void download(entry)}>Download backup</button>
              <button className="primary" disabled={busy} onClick={() => { setSelected(entry); modalRef.current?.scrollTo({ top: 0 }); }}>Restore…</button>
            </div>}
          </article>)}
        </div>
      </div>
    </div>
  );
}
