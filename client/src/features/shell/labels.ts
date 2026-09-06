import type { TeachingLoad } from "../../models/teaching-load";

export function classTitle(load: TeachingLoad | null | undefined): string {
  if (!load) return "No class selected";
  return `Grade ${load.gradeLevel} — ${load.section} • ${load.subject}`;
}

export function classOptionLabel(load: TeachingLoad): string {
  return `Grade ${load.gradeLevel} - ${load.section} (${load.subject})`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "teacher";
}

export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function learnerNameCaps(name: string): string {
  return name.trim().toUpperCase();
}

export function countSex(learners: Array<{ sex?: string }>): { male: number; female: number } {
  let male = 0;
  let female = 0;
  for (const learner of learners) {
    const sex = String(learner.sex || "").trim().toUpperCase();
    if (sex.startsWith("M")) male += 1;
    else if (sex.startsWith("F")) female += 1;
  }
  return { male, female };
}
