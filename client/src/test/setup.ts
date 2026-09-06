import { beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { indexedDB } from "fake-indexeddb";
import { closeGradeBossDb, resetDbConnectionForTests } from "../storage/db";
import { resetStorageInitForTests } from "../storage/init";

beforeEach(async () => {
  resetStorageInitForTests();
  await closeGradeBossDb();
  resetDbConnectionForTests();
  localStorage.clear();

  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("gradeboss");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
});
