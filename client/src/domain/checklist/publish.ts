import type { Assessment } from "../../models/assessment";
import { scoreKey } from "../../models/assessment";
import type {
  ChecklistPublicationHistoryEntry,
  PerformanceChecklist,
  ScoreChange,
  ScoreState,
} from "../../models/checklist";
import { CHECKLIST_HISTORY_LIMIT } from "../../models/checklist";
import type { TeachingLoad } from "../../models/teaching-load";
import { recordScoreDiff } from "../scores/history";
import { checklistActivityDefinition, isChecklistActivityPublished, upsertChecklist } from "./document";
import {
  activeLearners,
  assessmentHasScores,
  clone,
  createId,
  emptyPublicationTarget,
  equalScoreState,
  finiteNonNegative,
  normalizePublicationTarget,
  normalizedChecklistComponent,
  nowIso,
  optionalPositive,
  roundScore,
  scoreState,
  writeScoreState,
} from "./helpers";

export interface PublicationSuggestion {
  assessmentId: string;
  title: string;
  configuredMax: number | null;
  effectiveMax: number;
  empty: boolean;
  exactHps: boolean;
  requiresSetup: boolean;
  linkedElsewhere: boolean;
  overflowLearnerIds: string[];
  conflictLearnerIds: string[];
  contributionCount: number;
  compatible: boolean;
  rank: number;
  current: boolean;
  recommended: boolean;
}

export interface PublicationBlocked {
  learnerId: string;
  key: string;
  reason: string;
  total: number;
  published: number;
  requestedDelta: number;
  projected?: number;
  maxScore?: number;
}

export interface ActivityPublicationPlan {
  checklistId: string;
  assignmentId: string;
  activityId: string;
  activityTitle: string;
  assessmentId: string;
  assessmentTitle: string;
  component: "WW" | "PT";
  term: PerformanceChecklist["term"];
  maxScore: number;
  assessmentBefore: { title: string; maxScore: number | "" };
  assessmentAfter: { title: string; maxScore: number | "" };
  publicationBefore: ReturnType<typeof normalizePublicationTarget>;
  publicationAfter: ReturnType<typeof normalizePublicationTarget>;
  changes: Array<ScoreChange & { total: number; publishedBefore: number; publishedAfter: number; requestedDelta: number; appliedDelta: number; overflow: number }>;
  blocked: PublicationBlocked[];
  canApply: boolean;
}

function activityPublicationContext(checklist: PerformanceChecklist, load: TeachingLoad, activityId: string) {
  if (String(checklist.assignmentId) !== String(load.id)) {
    throw new Error("The checklist no longer matches the active class.");
  }
  const session = checklist.sessions.find((item) => String(item.activity?.id || item.id) === String(activityId || ""));
  const activity = checklistActivityDefinition(checklist, session || "");
  if (!session || !activity) throw new Error("The selected activity is unavailable.");
  const component = normalizedChecklistComponent(activity.destinationComponent);
  if (component !== "WW" && component !== "PT") {
    throw new Error("Tracking Only activities cannot be published to official grades.");
  }
  const target = normalizePublicationTarget(session.activity?.publicationTarget);
  return { session, activity, component, target };
}

function assessmentPublicationState(assessment: Assessment | undefined): { title: string; maxScore: number | "" } {
  return {
    title: String(assessment?.title || ""),
    maxScore: assessment?.maxScore === undefined ? "" : assessment.maxScore,
  };
}

function equalAssessmentPublicationState(assessment: Assessment | undefined, state: { title: string; maxScore: number | "" } | undefined): boolean {
  return Boolean(assessment && state) && String(assessment?.title || "") === String(state?.title || "") && String(assessment?.maxScore ?? "") === String(state?.maxScore ?? "");
}

export function checklistActivityTargetSuggestions(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  activityId: string,
): PublicationSuggestion[] {
  const context = activityPublicationContext(checklist, load, activityId);
  const targetId = context.target.assessmentId;
  const suggestions = (load.assessments || [])
    .filter(
      (assessment) =>
        String(assessment.term) === String(checklist.term) &&
        String(assessment.component) === context.component &&
        String(assessment.mapePart || "") === String(checklist.mapePart || ""),
    )
    .map((assessment): PublicationSuggestion => {
      const linkedElsewhere = (checklist.sessions || []).some(
        (other) => other !== context.session && other.activity?.publicationTarget?.assessmentId === assessment.id,
      );
      const empty = !assessmentHasScores(load, assessment.id);
      const configuredMax = Number(assessment.maxScore);
      const hasPositiveHps = Number.isFinite(configuredMax) && configuredMax > 0;
      const exactHps = hasPositiveHps && roundScore(configuredMax) === roundScore(context.activity.maxPointsPerSession);
      const requiresSetup = empty && !exactHps;
      const effectiveMax = requiresSetup ? context.activity.maxPointsPerSession : configuredMax;
      const overflowLearnerIds: string[] = [];
      const conflictLearnerIds: string[] = [];
      let contributionCount = 0;
      for (const learner of activeLearners(load)) {
        const learnerId = String(learner.id);
        const entry = context.session.entries?.[learnerId]?.[context.activity.criterionId];
        const key = scoreKey(learnerId, assessment.id);
        const before = scoreState(load.scores, key);
        const wasPublished = targetId === assessment.id && Object.prototype.hasOwnProperty.call(context.target.publishedContributions, learnerId);
        if (!entry && !wasPublished) continue;
        if (entry) contributionCount += 1;
        if (wasPublished) {
          const expected = context.target.publishedScoreStates[learnerId];
          if (!expected || !equalScoreState(before, expected)) {
            conflictLearnerIds.push(learnerId);
            continue;
          }
        }
        const baseline = wasPublished ? context.target.originalScoreStates[learnerId] || { present: false, value: null } : before;
        const contribution = Math.min(finiteNonNegative(entry?.points, 0), context.activity.maxPointsPerSession);
        const projected = roundScore((baseline.present ? Number(baseline.value) : 0) + contribution);
        if (Number.isFinite(effectiveMax) && effectiveMax > 0 && projected > effectiveMax) {
          overflowLearnerIds.push(learnerId);
        }
      }
      const compatible =
        !linkedElsewhere && conflictLearnerIds.length === 0 && Number.isFinite(effectiveMax) && effectiveMax > 0 && overflowLearnerIds.length === 0;
      const rank =
        targetId === assessment.id ? -1 : linkedElsewhere ? 5 : empty && exactHps ? 0 : empty ? 1 : compatible ? 2 : 4;
      return {
        assessmentId: assessment.id,
        title: String(assessment.title || assessment.component),
        configuredMax: hasPositiveHps ? configuredMax : null,
        effectiveMax,
        empty,
        exactHps,
        requiresSetup,
        linkedElsewhere,
        overflowLearnerIds,
        conflictLearnerIds,
        contributionCount,
        compatible,
        rank,
        current: targetId === assessment.id,
        recommended: false,
      };
    })
    .sort((left, right) => left.rank - right.rank || left.title.localeCompare(right.title));
  const recommended = suggestions.find((item) => item.compatible);
  if (recommended) recommended.recommended = true;
  return suggestions;
}

function validateActivityPublication(checklist: PerformanceChecklist, load: TeachingLoad, activityId: string, assessmentId: string) {
  const context = activityPublicationContext(checklist, load, activityId);
  const suggestion = checklistActivityTargetSuggestions(checklist, load, activityId).find((item) => item.assessmentId === String(assessmentId));
  const assessment = load.assessments.find((item) => item.id === suggestion?.assessmentId);
  if (!assessment || !suggestion) {
    throw new Error("Choose an assessment from this class, term, component, and MAPEH strand.");
  }
  if (suggestion.linkedElsewhere) {
    throw new Error("This official assessment is already linked to another checklist activity.");
  }
  if (!Number.isFinite(suggestion.effectiveMax) || suggestion.effectiveMax <= 0) {
    throw new Error("Set a positive HPS for this occupied assessment before adding checklist points.");
  }
  const hasPublishedPoints = Object.keys(context.target.publishedContributions).length > 0;
  if (hasPublishedPoints && context.target.assessmentId && context.target.assessmentId !== assessment.id) {
    throw new Error("Revert this activity publication before selecting a different target assessment.");
  }
  const assessmentBefore = assessmentPublicationState(assessment);
  const assessmentAfter = suggestion.requiresSetup
    ? { title: context.activity.title, maxScore: context.activity.maxPointsPerSession }
    : assessmentBefore;
  return { ...context, assessment, maxScore: suggestion.effectiveMax, suggestion, assessmentBefore, assessmentAfter };
}

export function planChecklistActivityPublication(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  activityId: string,
  assessmentId: string,
): ActivityPublicationPlan {
  const validated = validateActivityPublication(checklist, load, activityId, assessmentId);
  const changes: ActivityPublicationPlan["changes"] = [];
  const blocked: PublicationBlocked[] = [];
  const contributionsAfter = { ...validated.target.publishedContributions };
  const scoreStatesAfter = { ...validated.target.publishedScoreStates };
  const originalScoreStatesAfter = { ...validated.target.originalScoreStates };
  for (const learner of activeLearners(load)) {
    const learnerId = String(learner.id);
    const entry = validated.session.entries?.[learnerId]?.[validated.activity.criterionId];
    const wasPublished = Object.prototype.hasOwnProperty.call(validated.target.publishedContributions, learnerId);
    if (!entry && !wasPublished) continue;
    const total = roundScore(Math.min(finiteNonNegative(entry?.points, 0), validated.activity.maxPointsPerSession));
    const published = finiteNonNegative(validated.target.publishedContributions[learnerId], 0);
    const requestedDelta = roundScore(total - published);
    const key = scoreKey(learnerId, validated.assessment.id);
    const before = scoreState(load.scores, key);
    const expectedPublishedScore = validated.target.publishedScoreStates[learnerId];
    if (wasPublished && (!expectedPublishedScore || !equalScoreState(before, expectedPublishedScore))) {
      blocked.push({ learnerId, key, reason: "score-changed-after-publication", total, published, requestedDelta });
      continue;
    }
    const original: ScoreState = wasPublished
      ? validated.target.originalScoreStates[learnerId] || { present: false, value: null }
      : before;
    const after: ScoreState = entry
      ? { present: true, value: roundScore((original.present ? Number(original.value) : 0) + total) }
      : original;
    if (after.present && Number(after.value) > validated.maxScore) {
      blocked.push({
        learnerId,
        key,
        reason: "score-exceeds-hps",
        total,
        published,
        requestedDelta,
        projected: after.value ?? undefined,
        maxScore: validated.maxScore,
      });
      continue;
    }
    if (equalScoreState(before, after) && requestedDelta === 0) continue;
    if (entry) {
      contributionsAfter[learnerId] = total;
      scoreStatesAfter[learnerId] = clone(after);
      originalScoreStatesAfter[learnerId] = clone(original);
    } else {
      delete contributionsAfter[learnerId];
      delete scoreStatesAfter[learnerId];
      delete originalScoreStatesAfter[learnerId];
    }
    changes.push({
      learnerId,
      key,
      before,
      after,
      total,
      publishedBefore: published,
      publishedAfter: entry ? total : 0,
      requestedDelta,
      appliedDelta: requestedDelta,
      overflow: 0,
    });
  }
  return {
    checklistId: checklist.id,
    assignmentId: load.id,
    activityId: validated.activity.activityId,
    activityTitle: validated.activity.title,
    assessmentId: validated.assessment.id,
    assessmentTitle: String(validated.assessment.title || validated.assessment.component),
    component: validated.component,
    term: checklist.term,
    maxScore: validated.maxScore,
    assessmentBefore: clone(validated.assessmentBefore),
    assessmentAfter: clone(validated.assessmentAfter),
    publicationBefore: clone(validated.target),
    publicationAfter: {
      assessmentId: validated.assessment.id,
      lastPublishedAt: "",
      publishedContributions: contributionsAfter,
      publishedScoreStates: scoreStatesAfter,
      originalScoreStates: originalScoreStatesAfter,
    },
    changes,
    blocked,
    canApply: changes.length > 0 && blocked.length === 0,
  };
}

function comparablePlan(plan: ActivityPublicationPlan) {
  return {
    checklistId: plan.checklistId,
    assignmentId: plan.assignmentId,
    activityId: plan.activityId,
    assessmentId: plan.assessmentId,
    component: plan.component,
    maxScore: plan.maxScore,
    assessmentBefore: plan.assessmentBefore,
    assessmentAfter: plan.assessmentAfter,
    changes: plan.changes.map((change) => ({
      key: change.key,
      before: change.before,
      after: change.after,
      publishedBefore: change.publishedBefore,
      publishedAfter: change.publishedAfter,
    })),
    blocked: plan.blocked.map((item) => ({ key: item.key, reason: item.reason, requestedDelta: item.requestedDelta })),
  };
}

export function applyChecklistActivityPublication(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  reviewedPlan: ActivityPublicationPlan,
): { checklist: PerformanceChecklist; load: TeachingLoad; history: ChecklistPublicationHistoryEntry } {
  const freshPlan = planChecklistActivityPublication(checklist, load, reviewedPlan.activityId, reviewedPlan.assessmentId);
  if (JSON.stringify(comparablePlan(freshPlan)) !== JSON.stringify(comparablePlan(reviewedPlan))) {
    throw new Error("Activity entries or official scores changed after the review opened. Review the publication again.");
  }
  if (freshPlan.blocked.length) {
    throw new Error("One or more learner scores would exceed HPS or conflict with newer official scores.");
  }
  if (!freshPlan.changes.length) throw new Error("There are no activity score changes to publish.");
  const assessment = load.assessments.find((item) => item.id === freshPlan.assessmentId);
  if (!assessment || !equalAssessmentPublicationState(assessment, freshPlan.assessmentBefore)) {
    throw new Error("The target assessment changed after the review opened. Review the publication again.");
  }
  let scores = { ...load.scores };
  for (const change of freshPlan.changes) {
    scores = writeScoreState(scores, change.key, change.after);
  }
  const appliedAt = nowIso();
  const publicationAfter = { ...clone(freshPlan.publicationAfter), lastPublishedAt: appliedAt };
  const nextChecklist = clone(checklist);
  const session = nextChecklist.sessions.find((item) => String(item.activity?.id || item.id) === String(freshPlan.activityId));
  if (!session?.activity) throw new Error("The selected activity is unavailable.");
  session.activity.publicationTarget = clone(publicationAfter);
  nextChecklist.updatedAt = appliedAt;
  const history: ChecklistPublicationHistoryEntry = {
    id: createId("checklist-publication"),
    checklistId: checklist.id,
    assignmentId: load.id,
    activityId: freshPlan.activityId,
    activityTitle: freshPlan.activityTitle,
    assessmentId: freshPlan.assessmentId,
    component: freshPlan.component,
    term: checklist.term,
    appliedAt,
    assessmentBefore: clone(freshPlan.assessmentBefore),
    assessmentAfter: clone(freshPlan.assessmentAfter),
    changes: clone(freshPlan.changes.map((change) => ({ key: change.key, learnerId: change.learnerId, before: change.before, after: change.after }))),
    publicationBefore: clone(freshPlan.publicationBefore),
    publicationAfter: clone(publicationAfter),
    status: "applied",
    revertedAt: "",
  };
  nextChecklist.publicationHistory = [...(nextChecklist.publicationHistory || []), history].slice(-CHECKLIST_HISTORY_LIMIT);
  const nextAssessments = load.assessments.map((item) =>
    item.id === freshPlan.assessmentId
      ? { ...item, title: String(freshPlan.assessmentAfter.title), maxScore: Number(freshPlan.assessmentAfter.maxScore) || item.maxScore }
      : item,
  );
  const nextLoad: TeachingLoad = {
    ...load,
    scores,
    assessments: nextAssessments,
    updatedAt: appliedAt,
  };
  const withHistory = recordScoreDiff(nextLoad, load.scores, scores, "checklist-publication", appliedAt);
  return { checklist: nextChecklist, load: upsertChecklist(withHistory, nextChecklist), history };
}

export function revertChecklistPublication(
  historyEntry: ChecklistPublicationHistoryEntry,
  checklist: PerformanceChecklist,
  load: TeachingLoad,
): { checklist: PerformanceChecklist; load: TeachingLoad } {
  if (!historyEntry || historyEntry.checklistId !== checklist.id || historyEntry.assignmentId !== load.id) {
    throw new Error("The checklist publication history no longer matches this class.");
  }
  const scoreConflicts = historyEntry.changes.filter((change) => !equalScoreState(scoreState(load.scores, change.key), change.after));
  const activitySession = historyEntry.activityId
    ? checklist.sessions.find((item) => String(item.activity?.id || item.id) === String(historyEntry.activityId))
    : null;
  if (historyEntry.activityId && !activitySession?.activity) {
    throw new Error("The published activity is no longer available.");
  }
  const currentTarget = normalizePublicationTarget(activitySession?.activity?.publicationTarget || emptyPublicationTarget());
  const publicationConflict = JSON.stringify(currentTarget) !== JSON.stringify(historyEntry.publicationAfter);
  const assessment = load.assessments.find((item) => item.id === historyEntry.assessmentId);
  const assessmentConflict = Boolean(historyEntry.assessmentAfter) && !equalAssessmentPublicationState(assessment, historyEntry.assessmentAfter);
  if (scoreConflicts.length || publicationConflict || assessmentConflict) {
    throw new Error("Scores or checklist publication data changed after this publication. Preserve the newer data and review it manually.");
  }
  let scores = { ...load.scores };
  for (const change of historyEntry.changes) {
    scores = writeScoreState(scores, change.key, change.before);
  }
  const stamp = nowIso();
  const nextChecklist = clone(checklist);
  if (historyEntry.activityId) {
    const session = nextChecklist.sessions.find((item) => String(item.activity?.id || item.id) === String(historyEntry.activityId));
    if (!session?.activity) throw new Error("The published activity is no longer available.");
    session.activity.publicationTarget = clone(historyEntry.publicationBefore);
  }
  nextChecklist.updatedAt = stamp;
  nextChecklist.publicationHistory = (nextChecklist.publicationHistory || []).map((item) =>
    item.id === historyEntry.id ? { ...item, status: "reverted" as const, revertedAt: stamp } : item,
  );
  let assessments = load.assessments;
  if (historyEntry.assessmentBefore && assessment) {
    assessments = load.assessments.map((item) =>
      item.id === historyEntry.assessmentId
        ? {
            ...item,
            title: historyEntry.assessmentBefore.title,
            maxScore: typeof historyEntry.assessmentBefore.maxScore === "number" ? historyEntry.assessmentBefore.maxScore : item.maxScore,
          }
        : item,
    );
  }
  const nextLoad: TeachingLoad = { ...load, scores, assessments, updatedAt: stamp };
  const withHistory = recordScoreDiff(nextLoad, load.scores, scores, "checklist-publication-revert", stamp);
  return { checklist: nextChecklist, load: upsertChecklist(withHistory, nextChecklist) };
}

export function unlockChecklistActivity(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  activityId: string,
): { checklist: PerformanceChecklist; load: TeachingLoad } {
  const session = checklist.sessions.find((item) => String(item.activity?.id || item.id) === String(activityId));
  if (!isChecklistActivityPublished(session)) {
    return { checklist, load };
  }
  const applied = [...(checklist.publicationHistory || [])]
    .reverse()
    .filter((entry) => entry.status === "applied" && entry.activityId === activityId);
  let nextChecklist = checklist;
  let nextLoad = load;
  for (const entry of applied) {
    const result = revertChecklistPublication(entry, nextChecklist, nextLoad);
    nextChecklist = result.checklist;
    nextLoad = result.load;
  }
  return { checklist: nextChecklist, load: nextLoad };
}

export function createChecklistActivityAssessment(
  checklist: PerformanceChecklist,
  load: TeachingLoad,
  activityId: string,
  options: { title?: string; maxScore?: number; now?: string } = {},
): { checklist: PerformanceChecklist; load: TeachingLoad; assessment: Assessment } {
  const context = activityPublicationContext(checklist, load, activityId);
  const title = String(options.title || context.activity.title).trim();
  const maxScore = optionalPositive(options.maxScore) || context.activity.maxPointsPerSession;
  if (!title || !Number.isFinite(maxScore) || maxScore <= 0) throw new Error("Enter an assessment title and positive HPS.");
  const stamp = nowIso(options.now);
  const assessment: Assessment = {
    id: createId(context.component.toLowerCase()),
    title,
    component: context.component,
    term: checklist.term,
    mapePart: checklist.mapePart || undefined,
    maxScore,
    date: stamp.slice(0, 10),
    description: "Created from performance checklist",
  };
  return {
    checklist: { ...checklist, updatedAt: stamp },
    load: { ...load, assessments: [...load.assessments, assessment], updatedAt: stamp },
    assessment,
  };
}
