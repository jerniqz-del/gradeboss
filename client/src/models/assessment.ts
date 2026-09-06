import type { AssessmentComponent, MapePart, Term } from "./types";

export interface Assessment {
  id: string;
  term: Term;
  component: AssessmentComponent;
  title: string;
  maxScore: number;
  date: string;
  mapePart?: MapePart;
  description?: string;
  templateSlotId?: string;
}

export function scoreKey(learnerId: string, assessmentId: string): string {
  return `${learnerId}|${assessmentId}`;
}

export function parseScoreKey(key: string): { learnerId: string; assessmentId: string } | null {
  const separator = String(key || "").lastIndexOf("|");
  if (separator < 1 || separator === key.length - 1) return null;
  return { learnerId: key.slice(0, separator), assessmentId: key.slice(separator + 1) };
}
