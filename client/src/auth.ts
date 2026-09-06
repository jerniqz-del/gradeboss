export type Role = "superAdmin" | "schoolAdmin" | "teacher" | "nonTeaching";
export type AuthKind = "school" | "local" | "google";
export type SchoolAccountKind = "admin" | "teaching" | "nonTeaching";
export type SyncStatus = "local-only" | "waiting" | "linked";

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: Role;
  signedInAt: string;
  authKind?: AuthKind;
  schoolEmail?: string;
  schoolAccountKind?: SchoolAccountKind;
  syncStatus?: SyncStatus;
}

export const LOCAL_EMAIL_SUFFIX = "@ecrecord.local";

export const SUPER_ADMIN_EMAIL = "jerniqz@gmail.com";
export const ALLOWED_DOMAIN = "deped.gov.ph";

const KEY = "gradeboss:auth";
const DOMAIN_ERROR = "Use a school-issued DepEd email (@deped.gov.ph).";

interface StoredAuth {
  user: User;
}

export function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized === SUPER_ADMIN_EMAIL || normalized.endsWith(`@${ALLOWED_DOMAIN}`);
}

export function roleLabel(role: Role, kind?: AuthKind): string {
  if (kind === "local" && role === "teacher") return "Local profile";
  if (role === "schoolAdmin") return "School admin";
  if (role === "superAdmin") return "Super admin";
  if (role === "nonTeaching") return "Non-teaching";
  return "Teaching";
}

export function isLocalUser(user: User): boolean {
  return user.authKind === "local" || user.email.endsWith(LOCAL_EMAIL_SUFFIX);
}

export function isSchoolUser(user: User): boolean {
  return Boolean(user.schoolEmail) || user.authKind === "school";
}

export function createLocalUser(name: string, profileId: string): User {
  return {
    id: profileId,
    email: `${profileId}${LOCAL_EMAIL_SUFFIX}`,
    name: name.trim(),
    picture: "",
    role: "teacher",
    signedInAt: new Date().toISOString(),
    authKind: "local",
    syncStatus: "local-only",
  };
}

export function createSchoolUser(input: {
  id: string;
  email: string;
  name: string;
  role: Role;
}): User {
  return {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim() || input.email,
    picture: "",
    role: input.role,
    signedInAt: new Date().toISOString(),
    authKind: "school",
  };
}

function isRole(value: unknown): value is Role {
  return value === "superAdmin" || value === "schoolAdmin" || value === "teacher" || value === "nonTeaching";
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const user = value as User;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.name === "string" &&
    typeof user.picture === "string" &&
    isRole(user.role) &&
    typeof user.signedInAt === "string"
  );
}

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredAuth;
    if (!isUser(stored?.user)) {
      localStorage.removeItem(KEY);
      return null;
    }
    if (!isLocalUser(stored.user) && !isAllowedEmail(stored.user.email) && !stored.user.schoolEmail) {
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

export function schoolEmailError(): string {
  return DOMAIN_ERROR;
}
