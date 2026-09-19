import { importBackupBundle, exportBackupBundle } from "./backup";
import { openDB } from "idb";
import { saveThemePreference, type ThemePreference } from "../theme";

const FILE_NAME = "gradeboss.json";
const HANDLE_KEY = "default";

export interface FolderDatabaseFile {
  format: 1;
  updatedAt: string;
  data: Awaited<ReturnType<typeof exportBackupBundle>>;
  settings: { theme: ThemePreference };
}

interface HandleDb { handles: { key: string; value: FileSystemDirectoryHandle } }

const handleDb = () => openDB<HandleDb>("gradeboss-folder", 1, { upgrade(db) { db.createObjectStore("handles"); } });

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
};

let activeHandle: FileSystemDirectoryHandle | null = null;
let activeFolderName: string | null = null;

export function folderDatabaseSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

async function permission(handle: FileSystemDirectoryHandle, request: boolean): Promise<boolean> {
  const candidate = handle as FileSystemDirectoryHandle & { queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>; requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> };
  if (!candidate.queryPermission || !candidate.requestPermission) return true;
  const options = { mode: "readwrite" as const };
  if ((await candidate.queryPermission(options)) === "granted") return true;
  return request && (await candidate.requestPermission(options)) === "granted";
}

async function readFile(handle: FileSystemDirectoryHandle): Promise<FolderDatabaseFile | null> {
  try {
    const fileHandle = await handle.getFileHandle(FILE_NAME);
    const text = await (await fileHandle.getFile()).text();
    if (!text.trim()) return null;
    const parsed = JSON.parse(text) as FolderDatabaseFile;
    if (parsed?.format !== 1 || !parsed.data) throw new Error("This is not a GradeBoss database file.");
    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw error;
  }
}

async function writeFile(handle: FileSystemDirectoryHandle, value: FolderDatabaseFile): Promise<void> {
  const fileHandle = await handle.getFileHandle(FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(value, null, 2) + "\n");
  await writable.close();
}

async function rememberHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await handleDb();
  await db.put("handles", handle, HANDLE_KEY);
  activeHandle = handle;
  activeFolderName = handle.name;
}

async function currentFile(): Promise<FolderDatabaseFile> {
  const data = await exportBackupBundle();
  const theme = localStorage.getItem("gradeboss:theme");
  return {
    format: 1,
    updatedAt: new Date().toISOString(),
    data,
    settings: { theme: theme === "light" || theme === "dark" ? theme : "system" },
  };
}

async function applyFile(value: FolderDatabaseFile): Promise<void> {
  await importBackupBundle(value.data, "replace");
  saveThemePreference(value.settings?.theme === "light" || value.settings?.theme === "dark" ? value.settings.theme : "system");
}

export async function selectFolderDatabase(): Promise<string> {
  if (!folderDatabaseSupported()) {
    throw new Error("Folder databases require a Chromium-based browser on desktop.");
  }
  const handle = await (window as DirectoryPickerWindow).showDirectoryPicker!({ mode: "readwrite" });
  if (!(await permission(handle, true))) throw new Error("GradeBoss needs read and write access to that folder.");
  const existing = await readFile(handle);
  await rememberHandle(handle);
  if (existing) await applyFile(existing);
  await writeFile(handle, await currentFile());
  return handle.name;
}

export async function syncFolderDatabase(): Promise<void> {
  if (!activeHandle || !(await permission(activeHandle, false))) {
    throw new Error("Reconnect the GradeBoss folder database before syncing.");
  }
  await writeFile(activeHandle, await currentFile());
}

export async function restoreRememberedFolderDatabase(): Promise<boolean> {
  const db = await handleDb();
  const handle = await db.get("handles", HANDLE_KEY);
  if (!handle || !(await permission(handle, false))) return false;
  const existing = await readFile(handle);
  if (!existing) return false;
  activeHandle = handle;
  activeFolderName = handle.name;
  await applyFile(existing);
  return true;
}

export async function disconnectFolderDatabase(): Promise<void> {
  const db = await handleDb();
  await db.delete("handles", HANDLE_KEY);
  activeHandle = null;
  activeFolderName = null;
}

export function folderDatabaseName(): string | null {
  return activeFolderName;
}

export function folderDatabaseConnected(): boolean {
  return activeHandle !== null;
}
