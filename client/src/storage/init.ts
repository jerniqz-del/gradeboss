import type { LegacyGradebook } from "../models/legacy";
import type { TeacherProfile } from "../models/teacher-profile";
import type { TeachingLoad } from "../models/teaching-load";
import {
  getSchemaMeta,
  openGradeBossDb,
  setSchemaMeta,
  type GradeBossDb,
} from "./db";
import {
  hasLegacyLocalStorageData,
  readLocalStorageSnapshot,
  schoolClassToTeachingLoad,
} from "./migrate";
import { createSeedBundle } from "./seed";

let initPromise: Promise<GradeBossDb> | null = null;

async function persistTeachingLoads(db: GradeBossDb, loads: TeachingLoad[]): Promise<void> {
  const tx = db.transaction("teachingLoads", "readwrite");
  await Promise.all(loads.map((load) => tx.store.put(load)));
  await tx.done;
}

async function runMigration(db: GradeBossDb): Promise<void> {
  const snapshot = readLocalStorageSnapshot();
  const teachingLoads: TeachingLoad[] = snapshot.schoolClasses.map(schoolClassToTeachingLoad);

  if (teachingLoads.length === 0 && !hasLegacyLocalStorageData(snapshot)) {
    const seed = createSeedBundle();
    await db.put("profile", seed.profile, "default");
    await persistTeachingLoads(db, seed.teachingLoads);
    await db.put("legacyGradebook", seed.legacy, "default");
    await setSchemaMeta(db, {
      version: 1,
      migratedAt: new Date().toISOString(),
      migrationSource: "seed",
    });
    return;
  }

  const legacy = snapshot.legacy;

  const profile = createSeedBundle().profile;
  if (teachingLoads.length > 0) {
    profile.currentTeachingLoadId = teachingLoads[0].id;
    profile.schoolYear = teachingLoads[0].schoolYear;
    if (teachingLoads[0].sf1Meta?.schoolName) {
      profile.schoolName = teachingLoads[0].sf1Meta.schoolName;
    }
  } else {
    const seedLoad = createSeedBundle().teachingLoads[0];
    teachingLoads.push(seedLoad);
    profile.currentTeachingLoadId = seedLoad.id;
  }

  await db.put("profile", profile, "default");
  await persistTeachingLoads(db, teachingLoads);
  await db.put("legacyGradebook", legacy, "default");
  await setSchemaMeta(db, {
    version: 1,
    migratedAt: new Date().toISOString(),
    migrationSource: "localStorage",
  });
}

/** Open IndexedDB and migrate from localStorage on first run. Idempotent. */
export async function ensureStorageReady(): Promise<GradeBossDb> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await openGradeBossDb();
      const meta = await getSchemaMeta(db);
      if (!meta) {
        await runMigration(db);
      }
      return db;
    })();
  }
  return initPromise;
}

export function resetStorageInitForTests(): void {
  initPromise = null;
}

export async function getLegacyGradebook(db: GradeBossDb): Promise<LegacyGradebook> {
  const book = await db.get("legacyGradebook", "default");
  return book ?? { students: [], courses: [], grades: [] };
}

export async function saveLegacyGradebook(
  db: GradeBossDb,
  legacy: LegacyGradebook,
): Promise<void> {
  await db.put("legacyGradebook", legacy, "default");
}

export async function getTeacherProfile(db: GradeBossDb): Promise<TeacherProfile | undefined> {
  return db.get("profile", "default");
}

export async function saveTeacherProfile(
  db: GradeBossDb,
  profile: TeacherProfile,
): Promise<void> {
  await db.put("profile", profile, "default");
}
