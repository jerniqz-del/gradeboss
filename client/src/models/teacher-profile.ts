import type { Term } from "./types";

export interface TeacherProfile {
  teacherName: string;
  schoolId: string;
  schoolName: string;
  region: string;
  division: string;
  district: string;
  schoolYear: string;
  currentTerm: Term;
  currentTeachingLoadId: string;
}

export function createDefaultProfile(): TeacherProfile {
  return {
    teacherName: "",
    schoolId: "",
    schoolName: "",
    region: "",
    division: "",
    district: "",
    schoolYear: "2026-2027",
    currentTerm: "1",
    currentTeachingLoadId: "",
  };
}
