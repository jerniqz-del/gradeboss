import { openDB, type DBSchema } from "idb";
export { DATA_SAVED } from "./change-events";
export const CHANGELOG_UPDATED = "gradeboss:changelog-updated";
export const CHANGELOG_ERROR = "gradeboss:changelog-error";
export interface LogEntry {
  id: string; owner: string; actor: string; at: string;
  kind: "action" | "input" | "snapshot";
  label: string;
}
interface HistoryDb extends DBSchema {
  entries: { key: string; value: LogEntry; indexes: { owner: string } };
}
const historyDb = () => openDB<HistoryDb>("gradeboss-changelog", 1, {
  upgrade(db) {
    db.createObjectStore("entries", { keyPath: "id" }).createIndex("owner", "owner");
  },
});
let queue: Promise<unknown> = Promise.resolve();
export function reportHistoryError(error: unknown) {
  window.dispatchEvent(new CustomEvent(CHANGELOG_ERROR, { detail: error instanceof Error ? error.message : "Could not save activity log." }));
}
export async function readChangelog(owner: string) {
  const db = await historyDb();
  try {
    return (await db.getAllFromIndex("entries", "owner", owner))
      .filter((entry) => entry.kind !== "snapshot")
      .sort((a, b) => b.at.localeCompare(a.at));
  } finally { db.close(); }
}
export function logActivity(owner: string, actor: string, kind: "action" | "input", label: string) {
  const entry: LogEntry = { id: crypto.randomUUID(), owner, actor, at: new Date().toISOString(), kind, label: label.slice(0, 800) };
  const result = queue.then(async () => {
    const db = await historyDb();
    try {
      const tx = db.transaction("entries", "readwrite");
      await tx.store.put(entry);
      const rows = (await tx.store.index("owner").getAll(owner))
        .filter((row) => row.kind !== "snapshot")
        .sort((a, b) => b.at.localeCompare(a.at));
      for (const row of rows.slice(1000)) await tx.store.delete(row.id);
      await tx.done;
    } finally { db.close(); }
    window.dispatchEvent(new Event(CHANGELOG_UPDATED));
  });
  queue = result.catch(() => undefined);
  return result;
}
