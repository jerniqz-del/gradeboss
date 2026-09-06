import { listClasses, replaceClasses } from "../classes";
import { createEmptyAdvisoryStore } from "../models/advisory";
import { createDefaultProfile } from "../models/teacher-profile";
import { buildBackupBundle, mergeBackupBundles, parseBackupBundle } from "../features/exports/backup";
import type { BackupBundle, BackupMode } from "../features/exports/types";
import { ensureStorageReady, getLegacyGradebook, getTeacherProfile, saveLegacyGradebook, saveTeacherProfile } from "./init";
import { parseAdvisoryStore } from "../domain/advisory/transfer";

export async function exportBackupBundle(): Promise<BackupBundle> {
  const db = await ensureStorageReady();
  const [profile, teachingLoads, legacy, advisory] = await Promise.all([
    getTeacherProfile(db),
    db.getAll("teachingLoads"),
    getLegacyGradebook(db),
    db.get("advisory", "default"),
  ]);
  return buildBackupBundle({
    profile: profile || createDefaultProfile(),
    teachingLoads,
    legacy,
    schoolClasses: listClasses(),
    advisory: advisory ? parseAdvisoryStore(advisory) : createEmptyAdvisoryStore(),
  });
}

export async function wipeGradeData(): Promise<void> {
  const db = await ensureStorageReady();
  const loadsTx = db.transaction("teachingLoads", "readwrite");
  await loadsTx.store.clear();
  await loadsTx.done;
  await db.put("advisory", createEmptyAdvisoryStore(), "default");
  await saveTeacherProfile(db, createDefaultProfile());
  await saveLegacyGradebook(db, { students: [], courses: [], grades: [] });
  replaceClasses([]);
}

async function writeBundle(bundle: BackupBundle): Promise<void> {
  const db = await ensureStorageReady();
  const tx = db.transaction("teachingLoads", "readwrite");
  await tx.store.clear();
  await Promise.all(bundle.teachingLoads.map((load) => tx.store.put(load)));
  await tx.done;
  await db.put("advisory", bundle.advisory || createEmptyAdvisoryStore(), "default");
  await saveTeacherProfile(db, bundle.profile);
  await saveLegacyGradebook(db, bundle.legacy);
  replaceClasses(bundle.schoolClasses);
}

export async function importBackupBundle(raw: unknown, mode: BackupMode): Promise<BackupBundle> {
  const incoming = parseBackupBundle(raw);
  if (mode === "replace") {
    await writeBundle(incoming);
    return incoming;
  }
  const local = await exportBackupBundle();
  const merged = mergeBackupBundles(local, incoming);
  await writeBundle(merged);
  return merged;
}
