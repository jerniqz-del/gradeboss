import type { AdvisoryLearner } from "../../models/advisory";
import { cleanText } from "./subjects";

export function normalizeMatchText(value: unknown): string {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export function officialFullName(learner: {
  lastName?: string;
  firstName?: string;
  middleName?: string;
  extensionName?: string;
}): string {
  const lastName = cleanText(learner.lastName);
  const given = [cleanText(learner.firstName), cleanText(learner.middleName), cleanText(learner.extensionName)]
    .filter(Boolean)
    .join(" ");
  return lastName && given ? `${lastName}, ${given}` : lastName || given;
}

export function nameKey(learner: {
  lastName?: string;
  firstName?: string;
  middleName?: string;
  extensionName?: string;
}): string {
  return [learner.lastName, learner.firstName, learner.middleName, learner.extensionName]
    .map(normalizeMatchText)
    .join("|");
}

export type LearnerMatchStatus = "matched-lrn" | "matched-name" | "matched-manual" | "unmatched" | "ambiguous";

export function matchAdvisoryLearner(
  roster: AdvisoryLearner[],
  incoming: { lrn?: string; lastName?: string; firstName?: string; middleName?: string; extensionName?: string },
): { status: LearnerMatchStatus; learner: AdvisoryLearner | null; warning: string } {
  const active = roster.filter((item) => item.enrollmentStatus !== "inactive");
  const lrn = cleanText(incoming.lrn);
  if (lrn) {
    const matches = active.filter((item) => item.lrn === lrn);
    if (matches.length === 1) return { status: "matched-lrn", learner: matches[0], warning: "" };
    if (matches.length > 1) {
      return { status: "ambiguous", learner: null, warning: "More than one Advisory learner uses this LRN." };
    }
  }
  const incomingKey = nameKey(incoming);
  const nameMatches = active.filter((item) => nameKey(item) === incomingKey);
  if (nameMatches.length === 1) {
    return {
      status: "matched-name",
      learner: nameMatches[0],
      warning: "Matched by normalized official name. Review this fallback match.",
    };
  }
  if (nameMatches.length > 1) {
    return { status: "ambiguous", learner: null, warning: "This official name matches more than one Advisory learner." };
  }
  return { status: "unmatched", learner: null, warning: "This learner could not be matched safely." };
}
