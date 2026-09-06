export function cleanText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function normalizeSubjectKey(value: unknown): string {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export function splitMapehSubjects(subjects: string[]): string[] {
  return subjects.flatMap((name) =>
    /mapeh|music, arts, physical education, and health/i.test(name)
      ? ["Music & Arts", "PE & Health"]
      : [name],
  );
}

/** Standard Advisory subjects — MAPEH is stored as Music & Arts + PE & Health. */
export function standardSubjectsForGrade(gradeLevel: string | number): string[] {
  const grade = Number.parseInt(String(gradeLevel), 10);
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
      "Music & Arts",
      "PE & Health",
    ];
  }
  if (grade === 3) {
    return ["Filipino", "English", "Mathematics", "Science", "Makabansa", "Good Manners and Right Conduct (GMRC)"];
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
      "Music & Arts",
      "PE & Health",
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
      "Music & Arts",
      "PE & Health",
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
      "Music & Arts",
      "PE & Health",
    ];
  }
  return [];
}

export function isMusicArtsKey(key: string): boolean {
  return key === "MUSIC ARTS" || key === "MUSIC AND ARTS";
}

export function isPeHealthKey(key: string): boolean {
  return key === "PE HEALTH" || key === "PE AND HEALTH";
}

export function subjectCompactName(subjectName: string): string {
  const key = normalizeSubjectKey(subjectName);
  if (key === "FILIPINO") return "FIL";
  if (key === "ENGLISH") return "ENG";
  if (key === "MATHEMATICS") return "MATH";
  if (key === "SCIENCE") return "SCI";
  if (key === "ARALING PANLIPUNAN") return "AP";
  if (isMusicArtsKey(key)) return "M&A";
  if (isPeHealthKey(key) || key.includes("ARTS AND PHYSICAL EDUCATION")) return "PE&H";
  if (key === "LANGUAGE") return "LANG";
  if (key.includes("READING") && key.includes("LITERACY")) return "R&L";
  if (key === "MAKABANSA") return "MKB";
  if (key.includes("EDUKASYONG PANTAHANAN AT PANGKABUHAYAN") || /(^| )EPP($| )/.test(key)) return "EPP";
  if (key.includes("TECHNOLOGY AND LIVELIHOOD EDUCATION") || /(^| )TLE($| )/.test(key)) return "TLE";
  if (key.includes("GOOD MANNERS AND RIGHT CONDUCT") || key === "GMRC") return "GMRC";
  if (key === "VALUES EDUCATION") return "Val.Ed";
  if (key === "MAPEH AVERAGE") return "MAPEH";
  if (key === "GENERAL AVERAGE") return "GEN AVG";
  return cleanText(subjectName).slice(0, 10) || "SUBJ";
}

export function mapehExportSubjectName(part: "music_arts" | "pe_health"): string {
  return part === "music_arts" ? "Music & Arts" : "PE & Health";
}
