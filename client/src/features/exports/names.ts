import type { TeachingLoad } from "../../models/teaching-load";

export function safeFilenamePart(value: string): string {
  return String(value || "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function reportFilename(load: TeachingLoad, suffix: string, ext: string): string {
  const safe = safeFilenamePart(`${load.gradeLevel}-${load.section}-${load.subject}`);
  return `gradeboss-${safe}-${suffix}.${ext}`;
}
