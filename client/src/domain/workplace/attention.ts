/**
 * Workplace attention items.
 *
 * Ported from eclassrecord `dashboard-workplace.js` (`buildAttention`, advisory
 * conflict/missing hooks) plus GradeBoss pending-import sources (SF1 + GTF).
 */

import type { SchoolClass } from "../../classes";
import { ADVISORY_TERMS, activeAdvisoryClass } from "../advisory";
import type { AdvisoryStore } from "../../models/advisory";
import { scoreKey } from "../../models/assessment";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import type { WorkplaceAction, WorkplaceSeverity, WorkplaceTaskKind } from "../../models/workplace";
import { dateKey } from "../calendar/events";

export interface AttentionItem {
  id: string;
  type: WorkplaceTaskKind;
  title: string;
  detail: string;
  severity: WorkplaceSeverity;
  action: WorkplaceAction;
  priority: number;
  count: number;
  assignmentId?: string;
  assessmentIds?: string[];
  dismissible?: boolean;
}

export interface AdvisoryWorkplaceSummary {
  conflicts: number;
  missingGrades: number;
  pendingImports: number;
}

function clean(value: unknown): string {
  return String(value == null ? "" : value).trim();
}

function isActiveForTerm(learner: Learner, term: Term): boolean {
  if (learner.transferredOutTerm && parseInt(learner.transferredOutTerm, 10) <= parseInt(term, 10)) {
    return false;
  }
  return true;
}

function assessmentLabel(assessment: { title?: string; component?: string }): string {
  return clean(assessment.title) || clean(assessment.component) || "Untitled assessment";
}

function className(load: TeachingLoad): string {
  return `Grade ${clean(load.gradeLevel)} - ${clean(load.section)} · ${clean(load.subject)}`;
}

export function advisoryWorkplaceSummary(store: AdvisoryStore, schoolYear: string): AdvisoryWorkplaceSummary {
  const active = activeAdvisoryClass(store, schoolYear);
  if (!active) {
    return { conflicts: 0, missingGrades: 0, pendingImports: 0 };
  }
  const batches = store.importBatches.filter((batch) => batch.advisoryClassId === active.id);
  const conflicts = batches.reduce((sum, batch) => sum + (batch.conflictCount || 0), 0);
  const pendingImports = batches.filter((batch) => batch.status === "pending" || batch.unmatchedCount > 0).length;
  const learners = store.learners.filter(
    (learner) => learner.advisoryClassId === active.id && learner.enrollmentStatus === "active",
  );
  const subjects = store.subjects.filter((subject) => subject.advisoryClassId === active.id && !subject.isArchived);
  let missingGrades = 0;
  for (const learner of learners) {
    for (const subject of subjects) {
      for (const term of ADVISORY_TERMS) {
        const has = store.grades.some(
          (grade) =>
            grade.advisoryLearnerId === learner.id &&
            grade.advisorySubjectId === subject.id &&
            grade.term === term,
        );
        if (!has) missingGrades += 1;
      }
    }
  }
  return { conflicts, missingGrades, pendingImports };
}

export function pendingSf1Imports(classes: SchoolClass[], loads: TeachingLoad[]): SchoolClass[] {
  return classes.filter((cls) => {
    if (!cls.learners.length) return false;
    const matching = loads.filter(
      (load) =>
        load.subject !== "Class Roster (SF1)" &&
        load.schoolYear === cls.schoolYear &&
        String(load.gradeLevel) === String(cls.gradeLevel) &&
        load.section === cls.section,
    );
    if (matching.length === 0) return true;
    return matching.some((load) => load.learners.length === 0);
  });
}

export function buildAttention(input: {
  loads: TeachingLoad[];
  today: string;
  currentTerm: Term;
  selectedLoadId?: string;
  advisory?: AdvisoryWorkplaceSummary;
  pendingImports?: number;
}): AttentionItem[] {
  const groups = new Map<string, AttentionItem>();
  const term = input.currentTerm;
  const add = (item: Omit<AttentionItem, "id" | "count"> & { count?: number; titleForCount?: (count: number) => string }) => {
    const key = [item.assignmentId || "global", item.type].join("|");
    const existing = groups.get(key);
    const count = item.count ?? 1;
    if (existing) {
      existing.count += count;
      existing.assessmentIds = Array.from(new Set((existing.assessmentIds || []).concat(item.assessmentIds || [])));
      if (item.titleForCount) existing.title = item.titleForCount(existing.count);
      return;
    }
    groups.set(key, {
      ...item,
      id: key,
      count,
      title: item.titleForCount ? item.titleForCount(count) : item.title,
      assessmentIds: item.assessmentIds || [],
    });
  };

  for (const load of input.loads) {
    const learners = load.learners.filter((learner) => isActiveForTerm(learner, term));
    if (!learners.length) {
      add({
        type: "empty-class",
        assignmentId: load.id,
        priority: 4,
        severity: "info",
        action: "learner",
        title: "Empty class roster",
        titleForCount: () => `Add learners to ${className(load)}`,
        detail: "This class has no active learners yet.",
      });
    }

    for (const assessment of (load.assessments || []).filter((item) => item.term === term)) {
      const rawHps = assessment.maxScore;
      const hpsBlank = rawHps === undefined || rawHps === null;
      const hps = Number(rawHps);
      let invalid = 0;
      let missing = 0;
      for (const learner of learners) {
        const value = load.scores[scoreKey(learner.id, assessment.id)];
        if (value === undefined || value === null || value === "") {
          missing += 1;
          continue;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0 || (!hpsBlank && Number.isFinite(hps) && hps > 0 && numeric > hps)) {
          invalid += 1;
        }
      }
      if (invalid) {
        add({
          type: "invalid-scores",
          assignmentId: load.id,
          assessmentIds: [assessment.id],
          priority: 1,
          severity: "danger",
          action: "grading",
          count: invalid,
          title: "Invalid scores",
          titleForCount: (count) => `${count} invalid or HPS-exceeding score${count === 1 ? "" : "s"}`,
          detail: className(load),
        });
      }
      if (hpsBlank || !Number.isFinite(hps) || hps <= 0) {
        add({
          type: "missing-hps",
          assignmentId: load.id,
          assessmentIds: [assessment.id],
          priority: 2,
          severity: "warning",
          action: "grading",
          title: "Missing HPS",
          titleForCount: (count) => `${count} assessment${count === 1 ? "" : "s"} missing HPS`,
          detail: className(load),
        });
      }
      const assessmentDate = dateKey(assessment.date);
      if (assessmentDate && assessmentDate <= input.today && learners.length && missing) {
        add({
          type: "incomplete-scores",
          assignmentId: load.id,
          assessmentIds: [assessment.id],
          priority: 3,
          severity: "warning",
          action: "grading",
          count: missing,
          title: "Incomplete scores",
          titleForCount: (count) => `${count} score${count === 1 ? "" : "s"} still needed`,
          detail: className(load),
        });
      }
      if (assessmentDate && assessmentDate > input.today) {
        const days = Math.ceil(
          (new Date(`${assessmentDate}T00:00:00`).getTime() - new Date(`${input.today}T00:00:00`).getTime()) / 86400000,
        );
        if (days <= 7) {
          add({
            type: "upcoming-deadline",
            assignmentId: load.id,
            assessmentIds: [assessment.id],
            priority: 6,
            severity: "info",
            action: "grading",
            title: "Upcoming deadline",
            titleForCount: (count) => `${count} assessment deadline${count === 1 ? "" : "s"} this week`,
            detail: `${assessmentLabel(assessment)} · ${className(load)}`,
            dismissible: true,
          });
        }
      }
    }
  }

  const advisory = input.advisory;
  if (advisory && advisory.conflicts > 0) {
    add({
      type: "advisory-conflicts",
      priority: 5,
      action: "advisory",
      severity: "danger",
      count: advisory.conflicts,
      title: "Advisory conflicts",
      titleForCount: (count) => `${count} Advisory grade conflict${count === 1 ? "" : "s"}`,
      detail: "Review conflicting imported grades.",
    });
  } else if (advisory && advisory.missingGrades > 0) {
    add({
      type: "advisory-missing",
      priority: 5,
      action: "advisory",
      severity: "warning",
      count: advisory.missingGrades,
      title: "Advisory grades missing",
      titleForCount: (count) => `${count} Advisory grade${count === 1 ? "" : "s"} missing`,
      detail: "Open Advisory to continue grade consolidation.",
    });
  }

  if ((input.pendingImports || 0) > 0) {
    add({
      type: "pending-import",
      priority: 5,
      action: "classes",
      severity: "warning",
      count: input.pendingImports,
      title: "Pending imports",
      titleForCount: (count) => `${count} pending import${count === 1 ? "" : "s"}`,
      detail: "SF1 or Grade Transfer files still need to be applied.",
    });
  }

  const selected = clean(input.selectedLoadId);
  return Array.from(groups.values()).sort(
    (left, right) =>
      (left.assignmentId === selected ? 0 : 1) - (right.assignmentId === selected ? 0 : 1) ||
      left.priority - right.priority ||
      left.title.localeCompare(right.title),
  );
}
