import { BACKUP_VERSION, SEALED_FORMAT, type BackupBundle, type SealedBackup } from "./types";
import { parseBackupBundle } from "./backup";

const ITERATIONS = 120_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
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
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Optional PIN wrap — WebCrypto AES-GCM envelope (Phase 6, desktop-inspired). */
export async function sealBackup(bundle: BackupBundle, pin: string): Promise<SealedBackup> {
  const trimmed = pin.trim();
  if (!trimmed) throw new Error("Enter a PIN to encrypt this backup.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(trimmed, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(JSON.stringify(bundle)),
  );
  return {
    format: SEALED_FORMAT,
    version: BACKUP_VERSION,
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(cipher)),
  };
}

export async function unsealBackup(sealed: SealedBackup, pin: string): Promise<BackupBundle> {
  const trimmed = pin.trim();
  if (!trimmed) throw new Error("This backup is PIN-protected. Enter the PIN.");
  try {
    const salt = b64ToBytes(sealed.salt);
    const iv = b64ToBytes(sealed.iv);
    const key = await deriveKey(trimmed, salt);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      b64ToBytes(sealed.ciphertext).buffer as ArrayBuffer,
    );
    return parseBackupBundle(JSON.parse(decoder.decode(plain)));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("This backup")) throw err;
    if (err instanceof Error && err.message.includes("GradeBoss backup")) throw err;
    throw new Error("Wrong PIN or the backup file is damaged.");
  }
}

export function isSealedBackup(value: unknown): value is SealedBackup {
  if (!value || typeof value !== "object") return false;
  const item = value as SealedBackup;
  return item.format === SEALED_FORMAT && typeof item.ciphertext === "string";
}
