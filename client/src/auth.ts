export type Role = "superAdmin" | "teacher";

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: Role;
  signedInAt: string;
}

export const SUPER_ADMIN_EMAIL = "jerniqz@gmail.com";
export const ALLOWED_DOMAIN = "deped.gov.ph";

const KEY = "gradeboss:auth";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const DOMAIN_ERROR = "GradeBoss is only for DepEd accounts (@deped.gov.ph).";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

interface StoredAuth {
  user: User;
}

interface GoogleJwtPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  aud?: string;
  iss?: string;
  exp?: number;
}

let gisLoad: Promise<void> | null = null;

export function googleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
}

export function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized === SUPER_ADMIN_EMAIL || normalized.endsWith(`@${ALLOWED_DOMAIN}`);
}

export function roleLabel(role: Role): string {
  return role === "superAdmin" ? "Super admin" : "DepEd teacher";
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const user = value as User;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.name === "string" &&
    typeof user.picture === "string" &&
    (user.role === "superAdmin" || user.role === "teacher") &&
    typeof user.signedInAt === "string"
  );
}

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredAuth;
    if (!isUser(stored?.user) || !isAllowedEmail(stored.user.email)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return stored.user;
  } catch {
    return null;
  }
}

export function saveUser(user: User): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ user } satisfies StoredAuth));
  } catch {
    // Storage unavailable (private mode / quota) — best effort.
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — session is already cleared in memory.
  }
}

function decodeJwtPayload(credential: string): GoogleJwtPayload {
  const parts = credential.split(".");
  if (parts.length < 2) throw new Error("Invalid Google credential.");
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as GoogleJwtPayload;
}

function isEmailVerified(value: GoogleJwtPayload["email_verified"]): boolean {
  return value === true || value === "true";
}

export function userFromGoogleCredential(credential: string): User {
  const payload = decodeJwtPayload(credential);
  const email = payload.email?.trim();
  if (!email) throw new Error("Missing email in Google credential.");
  if (!isEmailVerified(payload.email_verified)) {
    throw new Error("Google email is not verified.");
  }
  if (!payload.aud || payload.aud !== googleClientId()) {
    throw new Error("Google credential audience mismatch.");
  }
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new Error("Google credential issuer is invalid.");
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
    throw new Error("Google credential has expired.");
  }
  if (!isAllowedEmail(email)) {
    throw new Error(DOMAIN_ERROR);
  }
  if (!payload.sub) throw new Error("Missing subject in Google credential.");

  const role: Role = email.toLowerCase() === SUPER_ADMIN_EMAIL ? "superAdmin" : "teacher";

  return {
    id: payload.sub,
    email,
    name: payload.name?.trim() || email,
    picture: payload.picture ?? "",
    role,
    signedInAt: new Date().toISOString(),
  };
}

export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisLoad) return gisLoad;

  gisLoad = new Promise((resolve, reject) => {
    const fail = () => {
      gisLoad = null;
      reject(new Error("Failed to load Google Identity Services."));
    };
    const ready = () => {
      if (window.google?.accounts?.id) resolve();
      else fail();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", ready);
      existing.addEventListener("error", fail);
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = ready;
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return gisLoad;
}

export function disableGoogleAutoSelect(): void {
  try {
    window.google?.accounts.id.disableAutoSelect();
  } catch {
    // GIS may not be loaded (offline / first paint after a stored session).
  }
}
