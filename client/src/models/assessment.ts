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
