import { useEffect, useRef, useState } from "react";
import type { User } from "../../auth";
import {
  CHANGELOG_ERROR, CHANGELOG_UPDATED, DATA_SAVED,
  logActivity, readChangelog, reportHistoryError, type LogEntry,
} from "../../storage/changelog";

export const OPEN_CHANGELOG = "gradeboss:open-changelog";
export function Changelog({ user, view }: { user: User; view: string }) {
  const owner = user.id;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<"actions" | "entries">("actions");
  const modalRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    let active = true;
    const refresh = () => { void readChangelog(owner).then((next) => { if (active) setRows(next); }).catch(reportHistoryError); };
    const show = () => { setOpen(true); refresh(); };
    const failure = (event: Event) => setError(String((event as CustomEvent).detail));
    const saved = (event: Event) => {
      void logActivity(owner, user.name, "input", String((event as CustomEvent).detail || "Saved data changes")).catch(reportHistoryError);
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
    refresh();
    return () => {
      active = false;
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

  if (!open) return error ? <div className="banner error" role="alert">Activity Log: {error} <button onClick={() => setOpen(true)}>Open Activity Log</button></div> : null;
  const actions = rows.filter((row) => row.kind === "action");
  const entries = rows.filter((row) => row.kind === "input");
  const categoryRows = category === "actions" ? actions : entries;
  const visible = categoryRows.filter((row) => (row.label + " " + row.actor).toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="att-modal-backdrop" data-changelog>
      <div ref={modalRef} className="card att-modal changelog-modal" role="dialog" aria-modal="true" aria-labelledby="changelog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); }
          if (event.key !== "Tab") return;
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <div className="att-modal-head">
          <h3 id="changelog-title">Activity Log</h3>
          <button className="ghost destructive-action" onClick={() => { setOpen(false); }}>Close</button>
        </div>
        <p className="muted">Actions and data entries are stored separately for this profile on this device, with local date and time. Passwords and PINs are not recorded.</p>
        {error && <div className="banner error" role="alert">{error}</div>}
        <div className="activity-log-tabs" role="tablist" aria-label="Activity log type">
          <button
            type="button"
            role="tab"
            aria-selected={category === "actions"}
            className={category === "actions" ? "sheet-tab active" : "sheet-tab"}
            onClick={() => setCategory("actions")}
          >
            Actions / Button Clicks ({actions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={category === "entries"}
            className={category === "entries" ? "sheet-tab active" : "sheet-tab"}
            onClick={() => setCategory("entries")}
          >
            Data Entries ({entries.length})
          </button>
        </div>
        <div className="changelog-tools">
          <input
            autoFocus
            aria-label={category === "actions" ? "Search actions and button clicks" : "Search data entries"}
            placeholder={category === "actions" ? "Search actions…" : "Search data entries…"}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />

        </div>
        <div className="changelog-entries">
          <table className="activity-log-table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Time</th><th scope="col">Activity</th><th scope="col">User</th></tr>
            </thead>
            <tbody>
              {visible.length === 0 && <tr><td className="activity-log-empty muted" colSpan={4}>No matching {category === "actions" ? "actions" : "data entries"} yet.</td></tr>}
              {visible.map((entry) => {
                const occurredAt = new Date(entry.at);
                return <tr key={entry.id}>
                  <td><time dateTime={entry.at}>{occurredAt.toLocaleDateString()}</time></td>
                  <td><time dateTime={entry.at}>{occurredAt.toLocaleTimeString()}</time></td>
                  <td>{entry.label}</td>
                  <td>{entry.actor}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
