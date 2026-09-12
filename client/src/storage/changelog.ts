import { openDB, type DBSchema } from "idb";
import type { BackupBundle } from "../features/exports/types";
import { exportBackupBundle, importBackupBundle } from "./backup";

export const CHANGELOG_UPDATED = "gradeboss:changelog-updated";
export { DATA_SAVED } from "./change-events";
export const CHANGELOG_ERROR = "gradeboss:changelog-error";
export interface LogEntry {
  id: string;
  owner: string;
  actor: string;
  at: string;
  kind: "action" | "input" | "snapshot";
  label: string;
  snapshotId?: string;
}
interface HistoryDb extends DBSchema {
  entries: { key: string; value: LogEntry; indexes: { owner: string } };
  snapshots: { key: string; value: { id: string; owner: string; bundle: BackupBundle } };
}
const historyDb = () => openDB<HistoryDb>("gradeboss-changelog", 1, {
  upgrade(db) {
    db.createObjectStore("entries", { keyPath: "id" }).createIndex("owner", "owner");
    db.createObjectStore("snapshots", { keyPath: "id" });
  },
});
let queue: Promise<unknown> = Promise.resolve();
let activeOwner: string | null = null;
let restoring = false;
export function setHistoryOwner(owner: string | null) { activeOwner = owner; }
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => undefined);
  return result;
}
export function reportHistoryError(error: unknown) {
  window.dispatchEvent(new CustomEvent(CHANGELOG_ERROR, { detail: error instanceof Error ? error.message : "Could not save history." }));
}
export async function readChangelog(owner: string) {
  const db = await historyDb();
  try {
    return (await db.getAllFromIndex("entries", "owner", owner)).sort((a, b) => b.at.localeCompare(a.at));
  } finally { db.close(); }
}
async function append(entry: LogEntry, bundle?: BackupBundle) {
  const db = await historyDb();
  try {
    const tx = db.transaction(["entries", "snapshots"], "readwrite");
    await tx.objectStore("entries").put(entry);
    if (bundle) await tx.objectStore("snapshots").put({ id: entry.id, owner: entry.owner, bundle });
    const rows = (await tx.objectStore("entries").index("owner").getAll(entry.owner)).sort((a, b) => b.at.localeCompare(a.at));
    let snapshots = 0;
    let activity = 0;
    for (const row of rows) {
      const remove = row.snapshotId ? ++snapshots > 100 : ++activity > 1000;
      if (remove) {
        await tx.objectStore("entries").delete(row.id);
        if (row.snapshotId) await tx.objectStore("snapshots").delete(row.snapshotId);
      }
    }
    await tx.done;
  } finally { db.close(); }
  window.dispatchEvent(new Event(CHANGELOG_UPDATED));
}
export function logActivity(owner: string, actor: string, kind: "action" | "input", label: string) {
  const entry: LogEntry = { id: crypto.randomUUID(), owner, actor, at: new Date().toISOString(), kind, label: label.slice(0, 800) };
  return serial(() => append(entry));
}
const fingerprints = new Map<string, string>();
export function checkpoint(owner: string, actor: string, label: string, force = false) {
  if (restoring) return Promise.resolve();
  return serial(async () => {
    if (activeOwner !== owner) return;
    const bundle = await exportBackupBundle();
    if (activeOwner !== owner) return;
    const fingerprint = JSON.stringify({ ...bundle, exportedAt: "" });
    if (!force && fingerprints.get(owner) === fingerprint) return;
    const id = crypto.randomUUID();
    await append({ id, owner, actor, at: new Date().toISOString(), kind: "snapshot", label, snapshotId: id }, bundle);
    fingerprints.set(owner, fingerprint);
  });
}
export async function getRestorePoint(owner: string, id: string) {
  const db = await historyDb();
  try {
    const point = await db.get("snapshots", id);
    if (!point || point.owner !== owner) throw new Error("This restore point is no longer available.");
    return point.bundle;
  } finally { db.close(); }
}
export async function restorePoint(owner: string, actor: string, entry: LogEntry) {
  const target = await getRestorePoint(owner, entry.snapshotId || "");
  return serial(async () => {
    if (activeOwner !== owner) throw new Error("The active profile changed. Reopen Changelog.");
    const current = await exportBackupBundle();
    // Persist the exact rollback state before replacing any data.
    const id = crypto.randomUUID();
    await append({ id, owner, actor, at: new Date().toISOString(), kind: "snapshot", label: "Current data before restore", snapshotId: id }, current);
    restoring = true;
    try {
      await importBackupBundle(target, "replace");
      const { persistLocalDatabase } = await import("./local-profile");
      await persistLocalDatabase();
    } catch (error) {
      try {
        await importBackupBundle(current, "replace");
        const { persistLocalDatabase } = await import("./local-profile");
        await persistLocalDatabase();
      }
      catch { throw new Error("Restore failed. Use the saved 'Current data before restore' point to recover your workspace."); }
      throw error;
    } finally { restoring = false; }
    fingerprints.delete(owner);
    await append({ id: crypto.randomUUID(), owner, actor, at: new Date().toISOString(), kind: "action", label: "Restored workspace to " + new Date(entry.at).toLocaleString() });
  });
}
