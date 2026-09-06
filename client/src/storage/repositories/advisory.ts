import type { AdvisoryStore } from "../../models/advisory";
import { createEmptyAdvisoryStore } from "../../models/advisory";
import { parseAdvisoryStore } from "../../domain/advisory/transfer";
import { ensureStorageReady } from "../init";
import { openGradeBossDb } from "../db";

export async function getAdvisoryStore(): Promise<AdvisoryStore> {
  const db = await ensureStorageReady();
  const stored = await db.get("advisory", "default");
  return stored ? parseAdvisoryStore(stored) : createEmptyAdvisoryStore();
}

export async function saveAdvisoryStore(store: AdvisoryStore): Promise<AdvisoryStore> {
  const db = await ensureStorageReady();
  await db.put("advisory", store, "default");
  return store;
}

export async function putAdvisoryStoreForTest(store: AdvisoryStore): Promise<void> {
  const db = await openGradeBossDb();
  await db.put("advisory", store, "default");
}
