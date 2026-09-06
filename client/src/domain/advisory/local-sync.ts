import type { AdvisoryClass, AdvisoryGrade, AdvisoryStore, AdvisorySubject } from "../../models/advisory";
import { createRecordId, nowIso } from "../../models/advisory";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { computeTermResult } from "../grading/term-result";
import { isMapehSubject } from "../policy";
import { matchAdvisoryLearner } from "./match";
import { isMusicArtsKey, normalizeSubjectKey } from "./subjects";
import { numericFinalGrade } from "./transfer";

export function localSourceMapePart(subject: AdvisorySubject, load: TeachingLoad): MapePart | undefined {
  if (!isMapehSubject(load.subject)) return undefined;
  return isMusicArtsKey(normalizeSubjectKey(subject.subjectName)) ? "music_arts" : "pe_health";
}

export function matchingLoadsForAdvisory(loads: TeachingLoad[], advisoryClass: AdvisoryClass): TeachingLoad[] {
  return loads.filter(
    (load) =>
      load.schoolYear === advisoryClass.schoolYear &&
      String(load.gradeLevel) === String(advisoryClass.gradeLevel) &&
      load.section.trim().toLowerCase() === advisoryClass.section.trim().toLowerCase(),
  );
}

export function syncGradesFromLoad(
  store: AdvisoryStore,
  advisoryClass: AdvisoryClass,
  subject: AdvisorySubject,
  load: TeachingLoad,
): AdvisoryStore {
  const roster = store.learners.filter((item) => item.advisoryClassId === advisoryClass.id);
  const mapePart = localSourceMapePart(subject, load);
  const nextGrades = store.grades.filter(
    (item) => !(item.advisoryClassId === advisoryClass.id && item.advisorySubjectId === subject.id && item.sourceType === "local-subject-class"),
  );
  const createdAt = nowIso();
  const incoming: AdvisoryGrade[] = [];
  const matched = new Set<string>();
  for (const sourceLearner of load.learners) {
    const match = matchAdvisoryLearner(roster, sourceLearner);
    if (!match.learner || matched.has(match.learner.id)) continue;
    matched.add(match.learner.id);
    (["1", "2", "3"] as Term[]).forEach((term) => {
      const grade = numericFinalGrade(computeTermResult(load, sourceLearner.id, term, mapePart).termGrade);
      if (grade === null) return;
      incoming.push({
        id: createRecordId("advisory-grade"),
        advisoryClassId: advisoryClass.id,
        advisoryLearnerId: match.learner!.id,
        advisorySubjectId: subject.id,
        schoolYear: advisoryClass.schoolYear,
        learnerLrn: match.learner!.lrn,
        subjectName: subject.subjectName,
        normalizedSubjectKey: subject.normalizedSubjectKey,
        gradeLevel: advisoryClass.gradeLevel,
        section: advisoryClass.section,
        term,
        finalGrade: grade,
        gradeStatus: "final",
        sourceType: "local-subject-class",
        sourceClassId: load.id,
        sourceClassName: `${load.subject} ${load.gradeLevel} - ${load.section}`,
        sourceTeacherName: "",
        exportId: "",
        importBatchId: "",
        exportedAt: "",
        importedAt: createdAt,
        validationStatus: "valid",
        conflictStatus: "none",
        remarks: "",
        createdAt,
        updatedAt: createdAt,
      });
    });
  }
  return { ...store, grades: [...nextGrades, ...incoming] };
}
