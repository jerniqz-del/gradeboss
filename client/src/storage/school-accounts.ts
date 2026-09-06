/**
 * School-issued accounts. The school admin registers with the official
 * DepEd email (the same address used for the school’s Cloudflare account).
 * Personnel then sign in with the DepEd emails the school issued — no Google.
 */

import { createSchoolUser, isAllowedEmail, schoolEmailError, SUPER_ADMIN_EMAIL, type Role, type User } from "../auth";
import { verifyLocalProfilePin, wrapLocalProfilePin, type LocalProfilePin } from "./local-profile";

export const SCHOOL_ACCOUNTS_KEY = "gradeboss:school-accounts";

export interface SchoolAccountRecord {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
  pin?: LocalProfilePin;
}

export interface SchoolAccountIndex {
  version: 1;
  accounts: SchoolAccountRecord[];
}

function emptyIndex(): SchoolAccountIndex {
  return { version: 1, accounts: [] };
}

function readIndex(): SchoolAccountIndex {
  try {
    const raw = localStorage.getItem(SCHOOL_ACCOUNTS_KEY);
    if (!raw) return emptyIndex();
    const parsed = JSON.parse(raw) as SchoolAccountIndex;
    if (!parsed || !Array.isArray(parsed.accounts)) return emptyIndex();
    return { version: 1, accounts: parsed.accounts };
  } catch {
    return emptyIndex();
  }
}

function writeIndex(index: SchoolAccountIndex): void {
  localStorage.setItem(SCHOOL_ACCOUNTS_KEY, JSON.stringify(index));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nextRole(index: SchoolAccountIndex, email: string): Role {
  if (email === SUPER_ADMIN_EMAIL) return "superAdmin";
  if (index.accounts.length === 0) return "schoolAdmin";
  return "teacher";
}

export function listSchoolAccounts(): SchoolAccountRecord[] {
  return readIndex().accounts;
}

export async function registerOrOpenSchoolAccount(input: {
  email: string;
  displayName: string;
  pin?: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  if (!isAllowedEmail(email)) throw new Error(schoolEmailError());

  const index = readIndex();
  const existing = index.accounts.find((account) => account.email === email);

  if (existing) {
    if (!(await verifyLocalProfilePin(existing.pin, input.pin || ""))) {
      throw new Error("Wrong PIN for this school account.");
    }
    return createSchoolUser({
      id: existing.id,
      email: existing.email,
      name: existing.displayName,
      role: existing.role,
    });
  }

  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Enter the teacher or admin name.");

  const record: SchoolAccountRecord = {
    id: `school-${crypto.randomUUID?.() || `${Date.now()}`}`,
    email,
    displayName,
    role: nextRole(index, email),
    createdAt: new Date().toISOString(),
    pin: input.pin?.trim() ? await wrapLocalProfilePin(input.pin) : undefined,
  };
  index.accounts.push(record);
  writeIndex(index);
  return createSchoolUser({
    id: record.id,
    email: record.email,
    name: record.displayName,
    role: record.role,
  });
}
