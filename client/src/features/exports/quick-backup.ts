import { persistLocalDatabase } from "../../storage/local-profile";
import { exportBackupBundle, importBackupBundle } from "../../storage";
import { backupFilename, downloadJson } from "./download";
import { isSealedBackup, unsealBackup } from "./pin";
import type { BackupMode } from "./types";

export async function downloadOpenBackup(): Promise<number> {
  const bundle = await exportBackupBundle();
  downloadJson(backupFilename(false), bundle);
  return bundle.teachingLoads.length;
}

export async function uploadBackupFile(file: File, mode: BackupMode = "replace"): Promise<number> {
  const parsed: unknown = JSON.parse(await file.text());
  const bundle = isSealedBackup(parsed) ? await unsealBackup(parsed, "") : parsed;
  const applied = await importBackupBundle(bundle, mode);
  await persistLocalDatabase();
  return applied.teachingLoads.length;
}
