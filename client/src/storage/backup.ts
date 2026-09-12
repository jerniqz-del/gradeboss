import { notifyDataSaved } from "./change-events";
import { listClasses, replaceClasses } from "../classes";
import { createEmptyAdvisoryStore } from "../models/advisory";
import { createEmptyCalendarStore } from "../models/calendar";
import { createDefaultProfile } from "../models/teacher-profile";
import { createEmptyWorkplaceStore } from "../models/workplace";
import { buildBackupBundle, mergeBackupBundles, parseBackupBundle } from "../features/exports/backup";
import type { BackupBundle, BackupMode } from "../features/exports/types";
import { ensureStorageReady, getLegacyGradebook, getTeacherProfile, saveLegacyGradebook, saveTeacherProfile } from "./init";
import { parseAdvisoryStore } from "../domain/advisory/transfer";

export async function exportBackupBundle(): Promise<BackupBundle> {
  const db = await ensureStorageReady();
  const [profile, teachingLoads, legacy, advisory, calendar, workplace] = await Promise.all([
    getTeacherProfile(db),
    db.getAll("teachingLoads"),
    getLegacyGradebook(db),
    db.get("advisory", "default"),
    db.get("calendar", "default"),
    db.get("workplace", "default"),
  ]);
  return buildBackupBundle({
    profile: profile || createDefaultProfile(),
    teachingLoads,
    legacy,
    schoolClasses: listClasses(),
    advisory: advisory ? parseAdvisoryStore(advisory) : createEmptyAdvisoryStore(),
    calendar: calendar || createEmptyCalendarStore(),
    workplace: workplace || createEmptyWorkplaceStore(),
  });
}

export async function wipeGradeData(): Promise<void> {
  const db = await ensureStorageReady();
  const loadsTx = db.transaction("teachingLoads", "readwrite");
  await loadsTx.store.clear();
  await loadsTx.done;
  await db.put("advisory", createEmptyAdvisoryStore(), "default");
  await db.put("calendar", createEmptyCalendarStore(), "default");
  await db.put("workplace", createEmptyWorkplaceStore(), "default");
  await saveTeacherProfile(db, createDefaultProfile());
  await saveLegacyGradebook(db, { students: [], courses: [], grades: [] });
  replaceClasses([]);
}

async function writeBundle(bundle: BackupBundle): Promise<void> {
  const db = await ensureStorageReady();
  const previousClasses = localStorage.getItem("gradeboss:classes");
  // Validate local storage capacity before replacing the IndexedDB records.
  localStorage.setItem("gradeboss:classes", JSON.stringify(bundle.schoolClasses));
  try {
    const tx = db.transaction(["teachingLoads", "advisory", "calendar", "workplace", "profile", "legacyGradebook"], "readwrite");
    await tx.objectStore("teachingLoads").clear();
    await Promise.all([
      ...bundle.teachingLoads.map((load) => tx.objectStore("teachingLoads").put(load)),
      tx.objectStore("advisory").put(bundle.advisory || createEmptyAdvisoryStore(), "default"),
      tx.objectStore("calendar").put(bundle.calendar || createEmptyCalendarStore(), "default"),
      tx.objectStore("workplace").put(bundle.workplace || createEmptyWorkplaceStore(), "default"),
      tx.objectStore("profile").put(bundle.profile, "default"),
      tx.objectStore("legacyGradebook").put(bundle.legacy, "default"),
    ]);
    await tx.done;
  } catch (error) {
    if (previousClasses === null) localStorage.removeItem("gradeboss:classes");
    else localStorage.setItem("gradeboss:classes", previousClasses);
    throw error;
  }
  notifyDataSaved("Imported workspace backup");
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
