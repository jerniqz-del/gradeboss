/**
 * Persist GradeBoss local profiles under the device Documents folder
 * `ecrecord_users_local` (same folder name as desktop E-Class Record).
 *
 * Chromium (desktop Chrome / Edge, installed PWA) can write there via the
 * File System Access API after the user picks Documents once. Other browsers
 * keep IndexedDB as the working copy and can download/import JSON by hand.
 */

export const LOCAL_USERS_FOLDER = "ecrecord_users_local";

const HANDLE_DB = "gradeboss-local-folder";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "root";

export function isLocalFolderSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local-folder storage."));
  });
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save folder access."));
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
  });
  db.close();
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readonly");
    const request = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read folder access."));
  });
  db.close();
  return handle;
}

export async function clearFolderHandle(): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not clear folder access."));
    tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
  });
  db.close();
}

export async function ensureFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

export async function resolveUsersFolder(picked: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (picked.name === LOCAL_USERS_FOLDER) return picked;
  return picked.getDirectoryHandle(LOCAL_USERS_FOLDER, { create: true });
}

export async function pickLocalUsersFolder(): Promise<FileSystemDirectoryHandle> {
  if (!isLocalFolderSupported() || !window.showDirectoryPicker) {
    throw new Error("This browser cannot write to Documents. Use Chrome or Edge on a computer, or download the database JSON instead.");
  }
  const picked = await window.showDirectoryPicker({
    id: LOCAL_USERS_FOLDER,
    mode: "readwrite",
    startIn: "documents",
  });
  const folder = await resolveUsersFolder(picked);
  await saveFolderHandle(folder);
  await writeReadme(folder);
  return folder;
}

export async function restoreLocalUsersFolder(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadFolderHandle();
  if (!handle) return null;
  if (!(await ensureFolderPermission(handle))) return null;
  return handle;
}

export async function writeTextFile(dir: FileSystemDirectoryHandle, name: string, contents: string): Promise<void> {
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(contents);
  await writable.close();
}

export async function writeJsonFile(dir: FileSystemDirectoryHandle, name: string, value: unknown): Promise<void> {
  await writeTextFile(dir, name, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJsonFile<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try {
    const file = await dir.getFileHandle(name);
    const text = await (await file.getFile()).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function getChildDirectory(
  dir: FileSystemDirectoryHandle,
  name: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  return dir.getDirectoryHandle(name, { create });
}

async function writeReadme(folder: FileSystemDirectoryHandle): Promise<void> {
  try {
    await folder.getFileHandle("README.txt");
    return;
  } catch {
    await writeTextFile(
      folder,
      "README.txt",
      [
        "GradeBoss local profiles",
        "",
        `This folder is ${LOCAL_USERS_FOLDER}.`,
        "Keep it inside your device Documents folder.",
        "Each subfolder is one local teacher profile (database.json).",
        "Do not rename folders while GradeBoss is open.",
        "",
      ].join("\n"),
    );
  }
}

export function documentsPathHint(): string {
  return `Documents/${LOCAL_USERS_FOLDER}`;
}
