import { listClasses, replaceClasses } from "../classes";
import { createDefaultProfile } from "../models/teacher-profile";
import { buildBackupBundle, mergeBackupBundles, parseBackupBundle } from "../features/exports/backup";
import type { BackupBundle, BackupMode } from "../features/exports/types";
import { ensureStorageReady, getLegacyGradebook, getTeacherProfile, saveLegacyGradebook, saveTeacherProfile } from "./init";

export async function exportBackupBundle(): Promise<BackupBundle> {
  const db = await ensureStorageReady();
  const [profile, teachingLoads, legacy] = await Promise.all([
    getTeacherProfile(db),
    db.getAll("teachingLoads"),
    getLegacyGradebook(db),
  ]);
  return buildBackupBundle({
    profile: profile || createDefaultProfile(),
    teachingLoads,
    legacy,
    schoolClasses: listClasses(),
  });
}

export async function wipeGradeData(): Promise<void> {
  const db = await ensureStorageReady();
  const tx = db.transaction("teachingLoads", "readwrite");
  await tx.store.clear();
  await tx.done;
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
