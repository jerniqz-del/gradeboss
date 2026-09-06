/** Optional local PIN for checklist publication — same PBKDF2 wrap as Phase 6 backups. */

const TOOLS_PIN_KEY = "gradeboss:tools-pin";
const TOOLS_PIN_FORMAT = "gradeboss-tools-pin-v1";
const ITERATIONS = 120_000;
const PAYLOAD = "gradeboss-tools-ok";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface ToolsPinRecord {
  format: typeof TOOLS_PIN_FORMAT;
  salt: string;
  iv: string;
  ciphertext: string;
}

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

function readRecord(storage: Pick<Storage, "getItem"> = localStorage): ToolsPinRecord | null {
  try {
    const raw = storage.getItem(TOOLS_PIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ToolsPinRecord;
    if (parsed.format !== TOOLS_PIN_FORMAT || typeof parsed.ciphertext !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasToolsPin(storage: Pick<Storage, "getItem"> = localStorage): boolean {
  return Boolean(readRecord(storage));
}

export async function setToolsPin(pin: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): Promise<void> {
  const trimmed = pin.trim();
  if (!trimmed) throw new Error("Enter a PIN to protect checklist publication.");
  if (!/^\d{4,8}$/.test(trimmed)) throw new Error("Use a 4–8 digit PIN.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(trimmed, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, encoder.encode(PAYLOAD));
  const record: ToolsPinRecord = {
    format: TOOLS_PIN_FORMAT,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(cipher)),
  };
  storage.setItem(TOOLS_PIN_KEY, JSON.stringify(record));
}

export function clearToolsPin(storage: Pick<Storage, "removeItem"> = localStorage): void {
  storage.removeItem(TOOLS_PIN_KEY);
}

export async function verifyToolsPin(pin: string, storage: Pick<Storage, "getItem"> = localStorage): Promise<boolean> {
  const record = readRecord(storage);
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
    return decoder.decode(plain) === PAYLOAD;
  } catch {
    return false;
  }
}

export async function requireToolsPin(pin: string, storage: Pick<Storage, "getItem"> = localStorage): Promise<void> {
  if (!hasToolsPin(storage)) return;
  const ok = await verifyToolsPin(pin, storage);
  if (!ok) throw new Error("Wrong PIN. Publication was not applied.");
}
