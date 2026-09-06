import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { AdvisoryStore } from "../models/advisory";
import type { LegacyGradebook } from "../models/legacy";
import type { TeacherProfile } from "../models/teacher-profile";
import type { TeachingLoad } from "../models/teaching-load";
import { SCHEMA_VERSION } from "../models/types";

export const DB_NAME = "gradeboss";
export const DB_VERSION = 2;

export interface SchemaMeta {
  version: number;
  migratedAt: string;
  migrationSource?: "localStorage" | "seed";
}

interface GradeBossDbSchema extends DBSchema {
  meta: {
    key: "schema";
    value: SchemaMeta;
  };
  profile: {
    key: "default";
    value: TeacherProfile;
  };
  teachingLoads: {
    key: string;
    value: TeachingLoad;
    indexes: { "by-schoolYear": string; "by-sourceClassId": string };
  };
  legacyGradebook: {
    key: "default";
    value: LegacyGradebook;
  };
  advisory: {
    key: "default";
    value: AdvisoryStore;
  };
}

export type GradeBossDb = IDBPDatabase<GradeBossDbSchema>;

let dbPromise: Promise<GradeBossDb> | null = null;
let dbInstance: GradeBossDb | null = null;

export function openGradeBossDb(): Promise<GradeBossDb> {
  if (!dbPromise) {
    dbPromise = openDB<GradeBossDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
        if (!db.objectStoreNames.contains("profile")) {
          db.createObjectStore("profile");
        }
        if (!db.objectStoreNames.contains("teachingLoads")) {
          const loads = db.createObjectStore("teachingLoads", { keyPath: "id" });
          loads.createIndex("by-schoolYear", "schoolYear");
          loads.createIndex("by-sourceClassId", "sourceClassId");
        }
        if (!db.objectStoreNames.contains("legacyGradebook")) {
          db.createObjectStore("legacyGradebook");
        }
        if (!db.objectStoreNames.contains("advisory")) {
          db.createObjectStore("advisory");
        }
        void transaction;
      },
    }).then((db) => {
      dbInstance = db;
      return db;
    });
  }
  return dbPromise;
}

export async function closeGradeBossDb(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbPromise = null;
}

export async function getSchemaMeta(db: GradeBossDb): Promise<SchemaMeta | undefined> {
  return db.get("meta", "schema");
}

export async function setSchemaMeta(db: GradeBossDb, meta: SchemaMeta): Promise<void> {
  await db.put("meta", meta, "schema");
}

export function resetDbConnectionForTests(): void {
  void closeGradeBossDb();
}

export { SCHEMA_VERSION };
