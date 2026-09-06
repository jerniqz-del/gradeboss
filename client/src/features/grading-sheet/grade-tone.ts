import type { TermGrade } from "../../domain/grading";

export function gradeTone(grade: TermGrade | null | undefined): string {
  if (grade === null || grade === undefined || grade === "T/O") return "var(--muted)";
  if (typeof grade === "string") {
    return ["A", "B", "C"].includes(grade) ? "var(--green)" : "var(--red)";
  }
  if (grade >= 90) return "var(--green)";
  if (grade >= 80) return "var(--blue)";
  if (grade >= 75) return "var(--amber)";
  return "var(--red)";
}

export function completionTone(percent: number): string {
  if (percent >= 100) return "var(--green)";
  if (percent >= 70) return "var(--blue)";
  if (percent >= 40) return "var(--amber)";
  return "var(--orange)";
}
