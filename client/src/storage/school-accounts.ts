/**
 * School Cloudflare directory.
 *
 * Everyone starts on a local profile. When the school admin’s Cloudflare
 * account (official DepEd email) is ready, they issue teaching and
 * non-teaching accounts. A local profile can then sync to the email the
 * admin created for that person.
 */

import {
  createSchoolUser,
  isAllowedEmail,
  schoolEmailError,
  SUPER_ADMIN_EMAIL,
  type Role,
  type SchoolAccountKind,
  type SyncStatus,
  type User,
} from "../auth";
import {
  currentLocalProfileId,
  verifyLocalProfilePin,
  wrapLocalProfilePin,
  type LocalProfilePin,
} from "./local-profile";

export const SCHOOL_ACCOUNTS_KEY = "gradeboss:school-accounts";

export interface SchoolAccountRecord {
  id: string;
  email: string;
  displayName: string;
  kind: SchoolAccountKind;
  role: Role;
  createdAt: string;
  pin?: LocalProfilePin;
  linkedLocalProfileId?: string;
  linkedAt?: string;
}

export interface SchoolDirectory {
  version: 2;
  schoolName: string;
  adminEmail: string;
  cloudflareReady: boolean;
  accounts: SchoolAccountRecord[];
}

function emptyDirectory(): SchoolDirectory {
  return {
    version: 2,
    schoolName: "",
    adminEmail: "",
    cloudflareReady: false,
    accounts: [],
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function roleForKind(kind: SchoolAccountKind, email: string): Role {
  if (email === SUPER_ADMIN_EMAIL) return "superAdmin";
  if (kind === "admin") return "schoolAdmin";
  if (kind === "nonTeaching") return "nonTeaching";
  return "teacher";
}

function readDirectory(): SchoolDirectory {
  try {
    const raw = localStorage.getItem(SCHOOL_ACCOUNTS_KEY);
    if (!raw) return emptyDirectory();
    const parsed = JSON.parse(raw) as Partial<SchoolDirectory> & { accounts?: SchoolAccountRecord[] };
    const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
    return {
      version: 2,
      schoolName: typeof parsed.schoolName === "string" ? parsed.schoolName : "",
      adminEmail: typeof parsed.adminEmail === "string" ? parsed.adminEmail : "",
      cloudflareReady: Boolean(parsed.cloudflareReady),
      accounts: accounts.map((account) => ({
        ...account,
        kind: account.kind || (account.role === "schoolAdmin" ? "admin" : "teaching"),
      })),
    };
  } catch {
    return emptyDirectory();
  }
}

function writeDirectory(directory: SchoolDirectory): void {
  localStorage.setItem(SCHOOL_ACCOUNTS_KEY, JSON.stringify(directory));
}

export function getSchoolDirectory(): SchoolDirectory {
  return readDirectory();
}

export function schoolIsSetUp(): boolean {
  return Boolean(readDirectory().adminEmail);
}

export function isCloudflareReady(): boolean {
  return readDirectory().cloudflareReady;
}

export function canManageSchool(user: User): boolean {
  return user.role === "schoolAdmin" || user.role === "superAdmin";
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export async function setupSchoolCloudflare(input: {
  adminEmail: string;
  schoolName: string;
  displayName: string;
  pin?: string;
  localProfileId?: string | null;
}): Promise<User> {
  const email = normalizeEmail(input.adminEmail);
  if (!isAllowedEmail(email)) throw new Error(schoolEmailError());
  const schoolName = input.schoolName.trim();
  const displayName = input.displayName.trim();
  if (!schoolName) throw new Error("Enter the school name.");
  if (!displayName) throw new Error("Enter the school admin name.");

  const directory = readDirectory();
  if (directory.adminEmail && directory.adminEmail !== email) {
    throw new Error("This device already has a school admin. Sign in as that admin to change Cloudflare settings.");
  }

  const existing = directory.accounts.find((account) => account.kind === "admin") || directory.accounts.find((account) => account.email === email);
  const record: SchoolAccountRecord = {
    id: existing?.id || newId("school-admin"),
    email,
    displayName,
    kind: "admin",
    role: roleForKind("admin", email),
    createdAt: existing?.createdAt || new Date().toISOString(),
    pin: input.pin?.trim() ? await wrapLocalProfilePin(input.pin) : existing?.pin,
    linkedLocalProfileId: input.localProfileId || existing?.linkedLocalProfileId || currentLocalProfileId() || undefined,
    linkedAt: new Date().toISOString(),
  };

  directory.schoolName = schoolName;
  directory.adminEmail = email;
  directory.accounts = directory.accounts.filter((account) => account.id !== record.id && account.kind !== "admin");
  directory.accounts.unshift(record);
  writeDirectory(directory);

  return {
    ...createSchoolUser({
      id: record.id,
      email: record.email,
      name: record.displayName,
      role: record.role,
    }),
    authKind: "local",
    schoolEmail: record.email,
    schoolAccountKind: "admin",
    syncStatus: directory.cloudflareReady ? "linked" : "waiting",
  };
}

export function setCloudflareReady(ready: boolean): SchoolDirectory {
  const directory = readDirectory();
  if (!directory.adminEmail) throw new Error("Set up the school Cloudflare admin first.");
  directory.cloudflareReady = ready;
  writeDirectory(directory);
  return directory;
}

export async function issueSchoolAccount(input: {
  email: string;
  displayName: string;
  kind: "teaching" | "nonTeaching";
  pin?: string;
}): Promise<SchoolAccountRecord> {
  const email = normalizeEmail(input.email);
  if (!isAllowedEmail(email)) throw new Error(schoolEmailError());
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Enter the person’s name.");

  const directory = readDirectory();
  if (!directory.adminEmail) throw new Error("Set up the school Cloudflare admin before issuing accounts.");
  if (directory.accounts.some((account) => account.email === email)) {
    throw new Error("That DepEd email is already issued.");
  }

  const record: SchoolAccountRecord = {
    id: newId("school"),
    email,
    displayName,
    kind: input.kind,
    role: roleForKind(input.kind, email),
    createdAt: new Date().toISOString(),
    pin: input.pin?.trim() ? await wrapLocalProfilePin(input.pin) : undefined,
  };
  directory.accounts.push(record);
  writeDirectory(directory);
  return record;
}

export function listIssuedAccounts(): SchoolAccountRecord[] {
  return readDirectory().accounts;
}

export function accountKindLabel(kind: SchoolAccountKind): string {
  if (kind === "admin") return "School admin";
  if (kind === "nonTeaching") return "Non-teaching";
  return "Teaching";
}

export function syncStatusForLocalProfile(localProfileId: string | null, user?: User): SyncStatus {
  const directory = readDirectory();
  if (user?.syncStatus === "linked" || user?.schoolEmail) {
    const linked = directory.accounts.find((account) => account.email === user.schoolEmail);
    if (linked) return directory.cloudflareReady ? "linked" : "waiting";
  }
  if (localProfileId) {
    const linked = directory.accounts.find((account) => account.linkedLocalProfileId === localProfileId);
    if (linked) return directory.cloudflareReady ? "linked" : "waiting";
  }
  if (!directory.cloudflareReady) return directory.adminEmail ? "waiting" : "local-only";
  return "local-only";
}

export async function syncLocalProfileToSchoolAccount(input: {
  email: string;
  pin?: string;
  localProfileId?: string | null;
  localName: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  if (!isAllowedEmail(email)) throw new Error(schoolEmailError());

  const directory = readDirectory();
  if (!directory.adminEmail) {
    throw new Error("The school has not set up its Cloudflare account yet.");
  }
  if (!directory.cloudflareReady) {
    throw new Error("School Cloudflare is not ready yet. Ask the school admin to mark it ready.");
  }

  const account = directory.accounts.find((item) => item.email === email);
  if (!account) {
    throw new Error("That email has not been issued by the school admin.");
  }
  if (!(await verifyLocalProfilePin(account.pin, input.pin || ""))) {
    throw new Error("Wrong PIN for this school-issued account.");
  }

  account.linkedLocalProfileId = input.localProfileId || currentLocalProfileId() || undefined;
  account.linkedAt = new Date().toISOString();
  writeDirectory(directory);

  return {
    id: input.localProfileId || account.id,
    email: account.email,
    name: input.localName || account.displayName,
    picture: "",
    role: account.role,
    signedInAt: new Date().toISOString(),
    authKind: "local",
    schoolEmail: account.email,
    schoolAccountKind: account.kind,
    syncStatus: "linked",
  };
}
