import type { Sex } from "../../models/types";

/** Trim and collapse internal whitespace — eclassrecord `normalizeNamePart`. */
export function normalizeNamePart(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** → 'M' | 'F' | '' — eclassrecord `normalizeSex` / `LearnerAvatars.cleanSex`. */
export function normalizeSex(value: unknown): Sex {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (["M", "MALE", "BOY"].includes(normalized)) return "M";
  if (["F", "FEMALE", "GIRL"].includes(normalized)) return "F";
  return "";
}

export function normalizeLrn(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Advisory-style DepEd LRN: empty or exactly 12 digits. */
export function validateLrn(value: unknown): string {
  const digits = normalizeLrn(value);
  if (!digits) return "";
  if (!/^\d{12}$/.test(digits)) return "LRN must contain exactly 12 digits.";
  return "";
}

export function isImportableLrn(value: unknown): boolean {
  return /^\d{10,13}$/.test(normalizeLrn(value));
}

/**
 * Normalize birthdates to YYYY-MM-DD.
 * Port of eclassrecord `normalizeLearnerBirthdate`.
 */
export function normalizeLearnerBirthdate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return raw;
}

export function validateLearnerBirthdate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = normalizeLearnerBirthdate(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "Use a valid birthdate (YYYY-MM-DD).";
  const [y, m, d] = normalized.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return "Use a valid birthdate (YYYY-MM-DD).";
  }
  if (dt.getTime() > Date.now()) return "Birthdate cannot be in the future.";
  if (y < 1950) return "Birthdate year looks too early.";
  return "";
}

export function normalizeGradeLevel(value: unknown): string {
  const match = String(value ?? "").match(/\d{1,2}/);
  if (!match) return String(value ?? "").trim();
  const n = Number(match[0]);
  return n >= 1 && n <= 12 ? String(n) : String(value ?? "").trim();
}

export function normalizeSection(value: unknown): string {
  return normalizeNamePart(value).toLowerCase();
}

export function normalizeSchoolYear(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");
}
