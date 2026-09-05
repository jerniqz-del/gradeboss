import type { Assessment, AssessmentComponent, MapePart, Term } from "../../models";
import { isMapehSubject } from "../../domain/grading";

export interface TemplateSlot {
  component: AssessmentComponent;
  title: string;
}

/** DO 015 Table 3: G1–3 use 4 WW + 4 PT; G4–12 use 5 WW + 3 PT. */
export function templateForGrade(gradeLevel: string | number): TemplateSlot[] {
  const grade = parseInt(String(gradeLevel), 10);
  const wwCount = grade <= 3 ? 4 : 5;
  const ptCount = grade <= 3 ? 4 : 3;
  const slots: TemplateSlot[] = [];
  for (let i = 1; i <= wwCount; i++) slots.push({ component: "WW", title: `WW ${i}` });
  for (let i = 1; i <= ptCount; i++) slots.push({ component: "PT", title: `PT ${i}` });
  slots.push({ component: "ST1", title: "ST1" });
  slots.push({ component: "ST2", title: "ST2" });
  slots.push({ component: "TE", title: "TE" });
  return slots;
}

export function subjectsForGrade(gradeLevel: string | number): string[] {
  const grade = parseInt(String(gradeLevel), 10);
  if (grade === 1) {
    return [
      "Language",
      "Reading and Literacy",
      "Mathematics",
      "Makabansa",
      "Good Manners and Right Conduct (GMRC)",
      "Arts and Physical Education",
    ];
  }
  if (grade === 2) {
    return [
      "Filipino",
      "English",
      "Mathematics",
      "Makabansa",
      "Good Manners and Right Conduct (GMRC)",
      "Music, Arts, Physical Education, and Health (MAPEH)",
    ];
  }
  if (grade === 3) {
    return [
      "Filipino",
      "English",
      "Mathematics",
      "Science",
      "Makabansa",
      "Good Manners and Right Conduct (GMRC)",
    ];
  }
  if (grade >= 4 && grade <= 5) {
    return [
      "Filipino",
      "English",
      "Mathematics",
      "Science",
      "Araling Panlipunan",
      "Good Manners and Right Conduct (GMRC)",
      "Edukasyong Pantahanan at Pangkabuhayan (EPP)",
      "MAPEH",
    ];
  }
  if (grade === 6) {
    return [
      "Filipino",
      "English",
      "Mathematics",
      "Science",
      "Araling Panlipunan",
      "Good Manners and Right Conduct (GMRC)",
      "Technology and Livelihood Education (TLE)",
      "MAPEH",
    ];
  }
  if (grade >= 7 && grade <= 10) {
    return [
      "Filipino",
      "English",
      "Mathematics",
      "Science",
      "Araling Panlipunan",
      "Values Education",
      "Technology and Livelihood Education (TLE)",
      "MAPEH",
    ];
  }
  if (grade >= 11) return SENIOR_HIGH_SUBJECTS;
  return [];
}

const SENIOR_HIGH_SUBJECTS = [
  "Effective Communication",
  "Mabisang Komunikasyon",
  "General Mathematics",
  "General Science",
  "Life and Career Skills",
  "Pag-aaral ng Kasaysayan at Lipunang Pilipino",
  "Introduction to Philosophy",
  "Entrepreneurship",
  "Work Immersion",
  "Research 1",
  "Research 2",
  "Design and Innovation",
  "Creative Production and Presentation",
  "Physical Education 1 — Fitness and Recreation",
  "Computer Systems Servicing",
];

export function createTemplateAssessments(
  gradeLevel: string | number,
  subject: string,
): Assessment[] {
  const template = templateForGrade(gradeLevel);
  const parts: Array<MapePart | undefined> = isMapehSubject(subject)
    ? ["music_arts", "pe_health"]
    : [undefined];
  const terms: Term[] = ["1", "2", "3"];
  const assessments: Assessment[] = [];
  for (const term of terms) {
    for (const mapePart of parts) {
      template.forEach((slot, slotIndex) => {
        assessments.push({
          id: crypto.randomUUID(),
          term,
          component: slot.component,
          title: slot.title,
          maxScore: 0,
          date: "",
          templateSlotId: `term:${term}|part:${mapePart || "regular"}|slot:${slotIndex}`,
          ...(mapePart ? { mapePart } : {}),
        });
      });
    }
  }
  return assessments;
}

export const SCHOOL_YEARS = ["2026-2027", "2027-2028", "2028-2029"];
