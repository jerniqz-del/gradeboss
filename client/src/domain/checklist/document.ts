import type {
  ChecklistActivity,
  ChecklistComponent,
  ChecklistCriterion,
  ChecklistEntry,
  ChecklistSession,
  PerformanceChecklist,
} from "../../models/checklist";
import { CHECKLIST_ENTRY_HISTORY_LIMIT, CHECKLIST_HISTORY_LIMIT } from "../../models/checklist";
import type { MapePart, Term } from "../../models/types";
import type { TeachingLoad } from "../../models/teaching-load";
import {
  clone,
  createId,
  emptyPublicationTarget,
  finiteNonNegative,
  isPublicationTargetPublished,
  normalizeCheckItem,
  normalizeChecklistEntry,
  normalizePublicationTarget,
  normalizedChecklistComponent,
  normalizedScoringMode,
  nowIso,
  optionalPositive,
  standardChecklistType,
  todayIso,
} from "./helpers";

export function defaultChecklistCriteria(): Array<Partial<ChecklistCriterion>> {
  // Desktop defaults these to TRACKING with HPS 1. GradeBoss publishes to WW/PT
  // from the same labels, so new checklists start with usable destinations and HPS.
  return [
    { label: "Recitation", destinationComponent: "WW", scoringMode: "NUMERIC", pointsPerCheck: 1, maxPointsPerSession: 10, allowNotes: true },
    { label: "Notebook", destinationComponent: "WW", scoringMode: "NUMERIC", pointsPerCheck: 1, maxPointsPerSession: 10, allowNotes: true },
    { label: "Assignment", destinationComponent: "PT", scoringMode: "NUMERIC", pointsPerCheck: 1, maxPointsPerSession: 10, allowNotes: true },
  ];
}

export function normalizeChecklistCriterion(criterion: Partial<ChecklistCriterion> | undefined, index = 0): ChecklistCriterion | null {
  if (!criterion || typeof criterion !== "object") return null;
  const label = String(criterion.label || "").trim();
  if (!label) return null;
  const standardType = standardChecklistType(criterion);
  const requestedScoringMode = normalizedScoringMode(criterion.scoringMode, "CHECK");
  const scoringMode = standardType ? "NUMERIC" : requestedScoringMode;
  let pointsPerCheck = optionalPositive(criterion.pointsPerCheck) || 1;
  const maxPointsPerSession = optionalPositive(criterion.maxPointsPerSession) || (scoringMode === "CHECK" ? pointsPerCheck : 1);
  pointsPerCheck = Math.min(pointsPerCheck, maxPointsPerSession);
  const checkItems = (Array.isArray(criterion.checkItems) ? criterion.checkItems : [])
    .map((item, itemIndex) => normalizeCheckItem(item, itemIndex))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 10);
  if (scoringMode === "CHECK" && checkItems.length === 0) {
    const completed = normalizeCheckItem({ label: "Completed", pointValue: pointsPerCheck });
    if (completed) checkItems.push(completed);
  }
  return {
    id: String(criterion.id || createId("checklist-criterion")),
    label,
    standardType,
    destinationComponent: normalizedChecklistComponent(criterion.destinationComponent),
    scoringMode,
    pointsPerCheck,
    maxPointsPerSession,
    maxPointsPerTerm: optionalPositive(criterion.maxPointsPerTerm),
    checkItems,
    allowNotes: Boolean(criterion.allowNotes),
    active: criterion.active !== false,
    order: Number.isFinite(Number(criterion.order)) ? Number(criterion.order) : index,
  };
}

export function normalizeChecklistActivity(
  activity: Partial<ChecklistActivity> | null | undefined,
  session: Pick<ChecklistSession, "id" | "title">,
  criteria: ChecklistCriterion[],
): ChecklistActivity | null {
  if (!activity || typeof activity !== "object") return null;
  const criterionId = String(activity.criterionId || "");
  const criterion = criteria.find((item) => item.id === criterionId);
  if (!criterion) return null;
  const scoringMode = criterion.standardType ? "NUMERIC" : normalizedScoringMode(activity.scoringMode, criterion.scoringMode);
  const maxPoints = optionalPositive(activity.maxPoints) || criterion.maxPointsPerSession;
  const pointsPerCheck = Math.min(optionalPositive(activity.pointsPerCheck) || criterion.pointsPerCheck || 1, maxPoints);
  return {
    id: String(activity.id || session.id || createId("checklist-activity")),
    criterionId,
    title: String(activity.title || session.title || criterion.label).trim() || criterion.label,
    sequence: Math.max(1, Math.floor(finiteNonNegative(activity.sequence, 1))),
    destinationComponent: normalizedChecklistComponent(activity.destinationComponent || criterion.destinationComponent),
    scoringMode,
    pointsPerCheck,
    maxPoints,
    allowNotes: activity.allowNotes === undefined ? Boolean(criterion.allowNotes) : Boolean(activity.allowNotes),
    status: activity.status === "archived" || activity.deletedAt ? "archived" : "active",
    deletedAt: String(activity.deletedAt || ""),
    checkItems: (Array.isArray(activity.checkItems) ? activity.checkItems : criterion.checkItems || [])
      .map((item, index) => normalizeCheckItem(item, index))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 10),
    publicationTarget: normalizePublicationTarget(activity.publicationTarget),
  };
}

export function normalizeChecklistSession(session: Partial<ChecklistSession> | undefined, criteria: ChecklistCriterion[]): ChecklistSession | null {
  if (!session || typeof session !== "object") return null;
  const criterionIds = new Set(criteria.map((item) => item.id));
  const entries: ChecklistSession["entries"] = {};
  const sourceEntries = session.entries && typeof session.entries === "object" && !Array.isArray(session.entries) ? session.entries : {};
  for (const [learnerId, learnerEntries] of Object.entries(sourceEntries)) {
    if (!learnerId || !learnerEntries || typeof learnerEntries !== "object") continue;
    const normalizedLearnerEntries: Record<string, ChecklistEntry> = {};
    for (const [criterionId, entry] of Object.entries(learnerEntries)) {
      if (!criterionIds.has(criterionId)) continue;
      const normalized = normalizeChecklistEntry(entry);
      if (normalized) normalizedLearnerEntries[criterionId] = normalized;
    }
    if (Object.keys(normalizedLearnerEntries).length) entries[learnerId] = normalizedLearnerEntries;
  }
  const normalizedSession: ChecklistSession = {
    id: String(session.id || createId("checklist-session")),
    date: String(session.date || todayIso()),
    title: String(session.title || "Checklist Session").trim() || "Checklist Session",
    entries,
    activity: null,
    createdAt: String(session.createdAt || nowIso()),
    updatedAt: String(session.updatedAt || session.createdAt || nowIso()),
  };
  normalizedSession.activity = normalizeChecklistActivity(session.activity, normalizedSession, criteria);
  return normalizedSession;
}

export function normalizePerformanceChecklist(checklist: Partial<PerformanceChecklist> | undefined): PerformanceChecklist | null {
  if (!checklist || typeof checklist !== "object") return null;
  const assignmentId = String(checklist.assignmentId || "");
  if (!assignmentId) return null;
  const criteria = (Array.isArray(checklist.criteria) ? checklist.criteria : [])
    .map((item, index) => normalizeChecklistCriterion(item, index))
    .filter((item): item is ChecklistCriterion => Boolean(item));
  const sessions = (Array.isArray(checklist.sessions) ? checklist.sessions : [])
    .map((item) => normalizeChecklistSession(item, criteria))
    .filter((item): item is ChecklistSession => Boolean(item));
  const targets = checklist.publicationTargets && typeof checklist.publicationTargets === "object" ? checklist.publicationTargets : { WW: emptyPublicationTarget(), PT: emptyPublicationTarget() };
  const term = checklist.term === "2" || checklist.term === "3" ? checklist.term : "1";
  return {
    id: String(checklist.id || createId("performance-checklist")),
    assignmentId,
    schoolYear: String(checklist.schoolYear || ""),
    term,
    mapePart: checklist.mapePart === "music_arts" || checklist.mapePart === "pe_health" ? checklist.mapePart : "",
    title: String(checklist.title || "Performance Checklist").trim() || "Performance Checklist",
    status: checklist.status === "archived" ? "archived" : "active",
    criteria,
    sessions,
    publicationTargets: {
      WW: normalizePublicationTarget(targets.WW),
      PT: normalizePublicationTarget(targets.PT),
    },
    publicationHistory: Array.isArray(checklist.publicationHistory) ? checklist.publicationHistory.slice(-CHECKLIST_HISTORY_LIMIT) : [],
    entryHistory: Array.isArray(checklist.entryHistory) ? checklist.entryHistory.slice(-CHECKLIST_ENTRY_HISTORY_LIMIT) : [],
    createdAt: String(checklist.createdAt || nowIso()),
    updatedAt: String(checklist.updatedAt || checklist.createdAt || nowIso()),
  };
}

export function createPerformanceChecklist(
  load: Pick<TeachingLoad, "id" | "schoolYear">,
  term: Term = "1",
  options: {
    mapePart?: MapePart | "";
    title?: string;
    criteria?: Array<Partial<ChecklistCriterion>>;
    activityTitle?: string;
    date?: string;
    now?: string;
  } = {},
): PerformanceChecklist {
  if (!load?.id) throw new TypeError("A class assignment is required.");
  const now = nowIso(options.now);
  const sourceCriteria = Array.isArray(options.criteria) && options.criteria.length ? options.criteria : defaultChecklistCriteria();
  const criteria = sourceCriteria
    .map((criterion, index) => normalizeChecklistCriterion({ ...criterion, order: index }, index))
    .filter((item): item is ChecklistCriterion => Boolean(item));
  if (!criteria.length) throw new Error("Add at least one checklist criterion.");
  const firstActivityTitle = String(options.activityTitle || `${criteria[0].label} 1`).trim() || `${criteria[0].label} 1`;
  const sessionId = createId("checklist-session");
  const created = normalizePerformanceChecklist({
    id: createId("performance-checklist"),
    assignmentId: String(load.id),
    schoolYear: String(load.schoolYear || ""),
    term,
    mapePart: options.mapePart || "",
    title: options.title || "Performance Checklist",
    status: "active",
    criteria,
    sessions: [
      {
        id: sessionId,
        date: String(options.date || now.slice(0, 10)),
        title: firstActivityTitle,
        entries: {},
        activity: {
          id: sessionId,
          criterionId: criteria[0].id,
          title: firstActivityTitle,
          sequence: 1,
          destinationComponent: criteria[0].destinationComponent,
          scoringMode: criteria[0].scoringMode,
          pointsPerCheck: criteria[0].pointsPerCheck,
          maxPoints: criteria[0].maxPointsPerSession,
          allowNotes: criteria[0].allowNotes,
          status: "active",
          deletedAt: "",
          checkItems: criteria[0].checkItems,
          publicationTarget: emptyPublicationTarget(),
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    publicationTargets: { WW: emptyPublicationTarget(), PT: emptyPublicationTarget() },
    publicationHistory: [],
    entryHistory: [],
    createdAt: now,
    updatedAt: now,
  });
  if (!created) throw new Error("Could not create the performance checklist.");
  return created;
}

export function addChecklistCriterion(checklist: PerformanceChecklist, raw: Partial<ChecklistCriterion>): PerformanceChecklist {
  const next = clone(checklist);
  const criterion = normalizeChecklistCriterion(raw, next.criteria.length);
  if (!criterion) throw new Error("Enter a criterion name.");
  const duplicate = next.criteria.some(
    (item) => item.id !== criterion.id && item.label.trim().toLowerCase() === criterion.label.toLowerCase(),
  );
  if (duplicate) throw new Error("A criterion with this name already exists.");
  next.criteria = [...next.criteria, criterion];
  next.updatedAt = nowIso();
  return next;
}

export function addChecklistActivity(
  checklist: PerformanceChecklist,
  options: {
    criterionId: string;
    title?: string;
    date?: string;
    destinationComponent?: ChecklistComponent;
    maxPoints?: number;
    allowNotes?: boolean;
    now?: string;
  },
): PerformanceChecklist {
  const next = clone(checklist);
  const criterion = next.criteria.find((item) => item.id === String(options.criterionId || ""));
  if (!criterion || !criterion.active) throw new Error("Choose an active activity type.");
  const now = nowIso(options.now);
  const sequence = next.sessions.filter((session) => session.activity?.criterionId === criterion.id).length + 1;
  const title = String(options.title || `${criterion.label} ${sequence}`).trim();
  if (!title) throw new Error("Enter an activity title.");
  const sessionId = createId("checklist-session");
  const session = normalizeChecklistSession(
    {
      id: sessionId,
      date: String(options.date || now.slice(0, 10)),
      title,
      entries: {},
      activity: {
        id: sessionId,
        criterionId: criterion.id,
        title,
        sequence,
        destinationComponent: options.destinationComponent || criterion.destinationComponent,
        scoringMode: criterion.scoringMode,
        pointsPerCheck: criterion.pointsPerCheck,
        maxPoints: options.maxPoints || criterion.maxPointsPerSession,
        allowNotes: options.allowNotes ?? criterion.allowNotes,
        status: "active",
        deletedAt: "",
        checkItems: criterion.checkItems,
        publicationTarget: emptyPublicationTarget(),
      },
      createdAt: now,
      updatedAt: now,
    },
    next.criteria,
  );
  if (!session) throw new Error("Could not add the activity.");
  next.sessions = [...next.sessions, session];
  next.updatedAt = now;
  return next;
}

export function checklistsOf(load: TeachingLoad): PerformanceChecklist[] {
  return Array.isArray(load.checklists) ? load.checklists : [];
}

export function findChecklist(load: TeachingLoad, term: Term, mapePart: MapePart | "" = ""): PerformanceChecklist | undefined {
  return checklistsOf(load).find(
    (item) => item.status !== "archived" && item.term === term && String(item.mapePart || "") === String(mapePart || ""),
  );
}

export function upsertChecklist(load: TeachingLoad, checklist: PerformanceChecklist): TeachingLoad {
  const existing = checklistsOf(load);
  const index = existing.findIndex((item) => item.id === checklist.id);
  const nextList = index >= 0 ? existing.map((item, i) => (i === index ? checklist : item)) : [...existing, checklist];
  return { ...load, checklists: nextList, updatedAt: checklist.updatedAt };
}

export function ensureChecklist(
  load: TeachingLoad,
  term: Term,
  mapePart: MapePart | "" = "",
): { load: TeachingLoad; checklist: PerformanceChecklist } {
  const found = findChecklist(load, term, mapePart);
  if (found) return { load, checklist: found };
  const checklist = createPerformanceChecklist(load, term, { mapePart });
  return { load: upsertChecklist(load, checklist), checklist };
}

export function visibleSessions(checklist: PerformanceChecklist): ChecklistSession[] {
  return (checklist.sessions || []).filter((session) => !session.activity?.deletedAt);
}

export function checklistActivityDefinition(checklist: PerformanceChecklist, sessionOrId: ChecklistSession | string) {
  const session = typeof sessionOrId === "string" ? checklist.sessions.find((item) => item.id === sessionOrId) : sessionOrId;
  if (!session?.activity) return null;
  const criterion = checklist.criteria.find((item) => item.id === session.activity?.criterionId);
  if (!criterion) return null;
  return {
    ...criterion,
    ...session.activity,
    id: criterion.id,
    activityId: session.activity.id || session.id,
    criterionId: criterion.id,
    maxPointsPerSession: session.activity.maxPoints,
  };
}

export function isChecklistActivityPublished(session: ChecklistSession | undefined): boolean {
  return Boolean(session?.activity) && isPublicationTargetPublished(session?.activity?.publicationTarget);
}

export function checklistEntry(checklist: PerformanceChecklist, sessionId: string, learnerId: string, criterionId: string): ChecklistEntry | null {
  const session = checklist.sessions.find((item) => item.id === sessionId);
  return session?.entries?.[learnerId]?.[criterionId] || null;
}

export function writeChecklistEntryState(
  checklist: PerformanceChecklist,
  sessionId: string,
  learnerId: string,
  criterionId: string,
  state: ChecklistEntry | null,
): PerformanceChecklist {
  const next = clone(checklist);
  const session = next.sessions.find((item) => item.id === sessionId);
  if (!session) return next;
  if (!session.entries || typeof session.entries !== "object") session.entries = {};
  if (!state) {
    if (session.entries[learnerId]) {
      delete session.entries[learnerId][criterionId];
      if (!Object.keys(session.entries[learnerId]).length) delete session.entries[learnerId];
    }
  } else {
    if (!session.entries[learnerId]) session.entries[learnerId] = {};
    session.entries[learnerId][criterionId] = clone(state);
  }
  const stamp = nowIso();
  session.updatedAt = stamp;
  next.updatedAt = stamp;
  return next;
}
