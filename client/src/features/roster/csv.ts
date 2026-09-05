import type { Learner } from "../../models/learner";
import { createLearner } from "./learner";
import { learnerAlreadyExists } from "./learner";
import {
  isImportableLrn,
  normalizeLearnerBirthdate,
  normalizeLrn,
  normalizeNamePart,
  normalizeSex,
} from "./normalize";

export interface CsvImportResult {
  learners: Learner[];
  skipped: number;
  errors: string[];
}

/** RFC-4180 line parser — eclassrecord `parseCsvLine`. */
export function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === "," || ch === "\t") && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function isHeaderRow(cols: string[]): boolean {
  const first = cols[0]?.toLowerCase() ?? "";
  return first.includes("lrn") || first.includes("last name") || first === "name";
}

function looksLikeSex(value: string): boolean {
  return Boolean(normalizeSex(value));
}

function looksLikeBirthdate(value: string): boolean {
  const normalized = normalizeLearnerBirthdate(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized);
}

/**
 * Bulk paste import — ports eclassrecord `importCsvLearners` and `showBulkAddLearnersModal`.
 *
 * Accepted formats:
 * - `LRN, Last Name, First Name, Sex[, Middle[, Birthdate]]`
 * - `Last Name, First Name Middle Name`
 * - Tab- or comma-delimited rows with a detectable LRN / sex / birthdate
 */
export function parseLearnerCsvPaste(text: string, existing: Learner[] = []): CsvImportResult {
  const errors: string[] = [];
  const learners: Learner[] = [];
  let skipped = 0;
  const roster = [...existing];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line, index) => {
    const cols = parseCsvLine(line).filter((col, _index, all) => col || all.length > 1);
    if (index === 0 && isHeaderRow(cols)) return;

    let lrn = "";
    let sex = "";
    let birthdate = "";
    const leftover: string[] = [];

    for (const col of cols) {
      const digits = normalizeLrn(col);
      if (!lrn && isImportableLrn(digits)) {
        lrn = digits.length === 12 ? digits : digits;
        continue;
      }
      if (!sex && looksLikeSex(col)) {
        sex = normalizeSex(col);
        continue;
      }
      if (!birthdate && looksLikeBirthdate(col)) {
        birthdate = normalizeLearnerBirthdate(col);
        continue;
      }
      leftover.push(col);
    }

    let lastName = "";
    let firstName = "";
    let middleName = "";

    if (leftover.length >= 2) {
      lastName = leftover[0];
      const rest = leftover[1].split(/\s+/).filter(Boolean);
      firstName = rest[0] || leftover[1];
      middleName = [...rest.slice(1), ...leftover.slice(2)].join(" ");
    } else if (leftover.length === 1 && leftover[0].includes(",")) {
      const parts = leftover[0].split(",").map((part) => part.trim());
      lastName = parts[0] || "";
      const rest = (parts[1] || "").split(/\s+/).filter(Boolean);
      firstName = rest[0] || "";
      middleName = rest.slice(1).join(" ");
    } else if (leftover.length === 1) {
      const words = leftover[0].split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        lastName = words[words.length - 1];
        firstName = words[0];
        middleName = words.slice(1, -1).join(" ");
      }
    }

    lastName = normalizeNamePart(lastName);
    firstName = normalizeNamePart(firstName);
    middleName = normalizeNamePart(middleName);

    if (!lastName || !firstName) {
      errors.push(`Row ${index + 1}: could not parse a last and first name.`);
      return;
    }

    const candidate = { lrn, lastName, firstName };
    if (learnerAlreadyExists(roster, candidate)) {
      skipped += 1;
      return;
    }

    const learner = createLearner({ lrn, lastName, firstName, middleName, sex, birthdate }, roster);
    learners.push(learner);
    roster.push(learner);
  });

  if (learners.length === 0 && skipped === 0 && errors.length === 0) {
    errors.push("No learners found. Paste rows like: LRN, Last Name, First Name, Sex");
  }

  return { learners, skipped, errors };
}

export function addCsvLearnersToLoad(
  existing: Learner[],
  pasted: string,
): { learners: Learner[]; imported: number; skipped: number; errors: string[] } {
  const parsed = parseLearnerCsvPaste(pasted, existing);
  return {
    learners: [...existing, ...parsed.learners],
    imported: parsed.learners.length,
    skipped: parsed.skipped,
    errors: parsed.errors,
  };
}
