import { createDefaultProfile } from "../models/teacher-profile";
import type { BackupBundle } from "../features/exports/types";
import { exportBackupBundle, importBackupBundle, wipeGradeData } from "./backup";
import { ensureStorageReady, getTeacherProfile, saveTeacherProfile } from "./init";
import {
  documentsPathHint,
  getChildDirectory,
  isLocalFolderSupported,
  LOCAL_USERS_FOLDER,
  pickLocalUsersFolder,
  readJsonFile,
  restoreLocalUsersFolder,
  writeJsonFile,
} from "./local-folder";

export const LOCAL_PROFILE_ID_KEY = "gradeboss:local-profile-id";
export const LOCAL_USERS_INDEX = "users.json";
export const LOCAL_DATABASE_FILE = "database.json";
export const LOCAL_PROFILE_FILE = "profile.json";

const PIN_FORMAT = "gradeboss-local-profile-pin-v1";
const PIN_ITERATIONS = 120_000;
const PIN_PAYLOAD = "gradeboss-local-profile-ok";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface LocalProfilePin {
  format: typeof PIN_FORMAT;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface LocalProfileMeta {
  id: string;
  displayName: string;
  schoolName: string;
  createdAt: string;
  updatedAt: string;
  pin?: LocalProfilePin;
}

export interface LocalUsersIndex {
  version: 1;
  folder: typeof LOCAL_USERS_FOLDER;
  users: LocalProfileMeta[];
}

export interface LocalFolderStatus {
  supported: boolean;
  connected: boolean;
  folderName: string;
  pathHint: string;
  users: LocalProfileMeta[];
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: PIN_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapLocalProfilePin(pin: string): Promise<LocalProfilePin> {
  const trimmed = pin.trim();
  if (!/^\d{4,8}$/.test(trimmed)) throw new Error("Use a 4–8 digit PIN, or leave it blank.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(trimmed, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, encoder.encode(PIN_PAYLOAD));
  return {
    format: PIN_FORMAT,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(cipher)),
  };
}

export async function verifyLocalProfilePin(record: LocalProfilePin | undefined, pin: string): Promise<boolean> {
  if (!record) return true;
  const trimmed = pin.trim();
  if (!trimmed) return false;
  try {
    const key = await deriveKey(trimmed, b64ToBytes(record.salt));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(record.iv).buffer as ArrayBuffer },
      key,
      b64ToBytes(record.ciphertext).buffer as ArrayBuffer,
    );
    return decoder.decode(plain) === PIN_PAYLOAD;
  } catch {
    return false;
  }
}

export function currentLocalProfileId(): string | null {
  try {
    return localStorage.getItem(LOCAL_PROFILE_ID_KEY);
  } catch {
    return null;
  }
}

export function setCurrentLocalProfileId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LOCAL_PROFILE_ID_KEY, id);
    else localStorage.removeItem(LOCAL_PROFILE_ID_KEY);
  } catch {
    // Storage unavailable.
  }
}

function emptyIndex(): LocalUsersIndex {
  return { version: 1, folder: LOCAL_USERS_FOLDER, users: [] };
}

async function readIndex(folder: FileSystemDirectoryHandle): Promise<LocalUsersIndex> {
  const stored = await readJsonFile<LocalUsersIndex>(folder, LOCAL_USERS_INDEX);
  if (!stored || !Array.isArray(stored.users)) return emptyIndex();
  return { version: 1, folder: LOCAL_USERS_FOLDER, users: stored.users };
}

async function writeIndex(folder: FileSystemDirectoryHandle, index: LocalUsersIndex): Promise<void> {
  await writeJsonFile(folder, LOCAL_USERS_INDEX, index);
}

export async function connectLocalUsersFolder(): Promise<FileSystemDirectoryHandle> {
  return pickLocalUsersFolder();
}

export async function getLocalFolderStatus(): Promise<LocalFolderStatus> {
  const supported = isLocalFolderSupported();
  const folder = supported ? await restoreLocalUsersFolder() : null;
  const users = folder ? (await readIndex(folder)).users : [];
  return {
    supported,
    connected: Boolean(folder),
    folderName: folder?.name || LOCAL_USERS_FOLDER,
    pathHint: documentsPathHint(),
    users,
  };
}

export async function listLocalProfiles(): Promise<LocalProfileMeta[]> {
  const folder = await restoreLocalUsersFolder();
  if (!folder) return [];
  return (await readIndex(folder)).users;
}

function newProfileId(): string {
  const stamp = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `local-${stamp}`;
}

export async function createLocalProfile(input: {
  displayName: string;
  schoolName?: string;
  pin?: string;
  copyDeviceData?: boolean;
}): Promise<LocalProfileMeta> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Enter a name for this local profile.");

  const folder = await restoreLocalUsersFolder();
  if (!folder && isLocalFolderSupported()) {
    throw new Error(`Choose your Documents folder first so GradeBoss can create ${LOCAL_USERS_FOLDER}.`);
  }

  if (!input.copyDeviceData) {
    await wipeGradeData();
  }

  const now = new Date().toISOString();
  const meta: LocalProfileMeta = {
    id: newProfileId(),
    displayName,
    schoolName: (input.schoolName || "").trim(),
    createdAt: now,
    updatedAt: now,
    pin: input.pin?.trim() ? await wrapLocalProfilePin(input.pin) : undefined,
  };

  const profile = createDefaultProfile();
  profile.teacherName = meta.displayName;
  profile.schoolName = meta.schoolName;
  const db = await ensureStorageReady();
  const existing = await getTeacherProfile(db);
  await saveTeacherProfile(db, { ...(existing || profile), ...profile });

  if (folder) {
    const userDir = await getChildDirectory(folder, meta.id, true);
    await writeJsonFile(userDir, LOCAL_PROFILE_FILE, meta);
    const bundle = await exportBackupBundle();
    bundle.profile = { ...bundle.profile, teacherName: meta.displayName, schoolName: meta.schoolName };
    await writeJsonFile(userDir, LOCAL_DATABASE_FILE, bundle);
    const index = await readIndex(folder);
    index.users = index.users.filter((user) => user.id !== meta.id).concat(meta);
    await writeIndex(folder, index);
  }
  setCurrentLocalProfileId(meta.id);
  return meta;
}

export async function openLocalProfile(id: string, pin = ""): Promise<LocalProfileMeta> {
  const folder = await restoreLocalUsersFolder();
  if (!folder) {
    throw new Error(`Choose your Documents folder first (${documentsPathHint()}).`);
  }
  const index = await readIndex(folder);
  const meta = index.users.find((user) => user.id === id);
  if (!meta) throw new Error("That local profile was not found in ecrecord_users_local.");
  if (!(await verifyLocalProfilePin(meta.pin, pin))) {
    throw new Error("Wrong PIN for this local profile.");
  }

  const userDir = await getChildDirectory(folder, meta.id, false);
  const bundle = await readJsonFile<BackupBundle>(userDir, LOCAL_DATABASE_FILE);
  if (bundle) {
    await importBackupBundle(bundle, "replace");
  }
  setCurrentLocalProfileId(meta.id);
  return meta;
}

export async function persistLocalDatabase(): Promise<void> {
  const id = currentLocalProfileId();
  if (!id) return;
  const folder = await restoreLocalUsersFolder();
  if (!folder) return;

  const index = await readIndex(folder);
  const meta = index.users.find((user) => user.id === id);
  if (!meta) return;

  const bundle = await exportBackupBundle();
  const userDir = await getChildDirectory(folder, id, true);
  const next: LocalProfileMeta = { ...meta, updatedAt: new Date().toISOString() };
  await writeJsonFile(userDir, LOCAL_PROFILE_FILE, next);
  await writeJsonFile(userDir, LOCAL_DATABASE_FILE, bundle);
  index.users = index.users.map((user) => (user.id === id ? next : user));
  await writeIndex(folder, index);
}

let persistTimer: number | null = null;

export function scheduleLocalDatabasePersist(): void {
  if (typeof window === "undefined") return;
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistLocalDatabase();
  }, 800);
}

export { isLocalFolderSupported, LOCAL_USERS_FOLDER, documentsPathHint };
