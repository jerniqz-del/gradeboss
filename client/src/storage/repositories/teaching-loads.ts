import type { TeachingLoad } from "../../models/teaching-load";
import { ensureStorageReady } from "../init";
import { openGradeBossDb } from "../db";

export async function listTeachingLoads(): Promise<TeachingLoad[]> {
  const db = await ensureStorageReady();
  const loads = await db.getAll("teachingLoads");
  return loads.sort((a, b) => a.dashboardOrder - b.dashboardOrder || a.subject.localeCompare(b.subject));
}

export async function getTeachingLoad(id: string): Promise<TeachingLoad | undefined> {
  const db = await ensureStorageReady();
  return db.get("teachingLoads", id);
}

export async function getTeachingLoadBySourceClassId(
  sourceClassId: string,
): Promise<TeachingLoad | undefined> {
  const db = await ensureStorageReady();
  return db.getFromIndex("teachingLoads", "by-sourceClassId", sourceClassId);
}

export async function saveTeachingLoad(load: TeachingLoad): Promise<TeachingLoad> {
  const db = await ensureStorageReady();
  const next: TeachingLoad = {
    ...load,
    updatedAt: new Date().toISOString(),
  };
  await db.put("teachingLoads", next);
  return next;
}

export async function deleteTeachingLoad(id: string): Promise<void> {
  const db = await ensureStorageReady();
  await db.delete("teachingLoads", id);
}

export async function countTeachingLoads(): Promise<number> {
  const db = await ensureStorageReady();
  return db.count("teachingLoads");
}

/** Test helper: write loads without going through migration. */
export async function putTeachingLoadsForTest(loads: TeachingLoad[]): Promise<void> {
  const db = await openGradeBossDb();
  const tx = db.transaction("teachingLoads", "readwrite");
  await Promise.all(loads.map((l) => tx.store.put(l)));
  await tx.done;
}
