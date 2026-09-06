/**
 * Workplace dashboard snapshot.
 *
 * Ported from eclassrecord `dashboard-workplace.js` `snapshot()`.
 */

import type { SchoolClass } from "../../classes";
import type { AdvisoryStore } from "../../models/advisory";
import type { CalendarEvent, CalendarFilters } from "../../models/calendar";
import type { TeachingLoad } from "../../models/teaching-load";
import type { Term } from "../../models/types";
import {
  createEmptyWorkplaceStore,
  type WorkplacePreferences,
  type WorkplaceStore,
  type WorkplaceTask,
} from "../../models/workplace";
import { todayIso } from "../attendance/calendar";
import { upcomingEvents, visibleEventsForView } from "../calendar/events";
import { advisoryWorkplaceSummary, buildAttention, pendingSf1Imports, type AttentionItem } from "./attention";
import { buildAnalytics, buildComponentPerformance, type WorkplaceAnalytics } from "./analytics";

const VALID_TERMS = new Set<Term>(["1", "2", "3"]);

export interface WorkplaceSnapshot {
  today: string;
  schoolYear: string;
  currentTerm: Term;
  currentLoadId: string;
  attention: AttentionItem[];
  analytics: WorkplaceAnalytics;
  upcoming: CalendarEvent[];
  tasks: WorkplaceTask[];
  preferences: WorkplacePreferences;
  stats: {
    classes: number;
    learners: number;
    learnerDisplay: number;
    learnerEntries: number;
    uniqueLearners: number;
    attention: number;
  };
}

function learnerIdentity(loadId: string, learner: TeachingLoad["learners"][number], index: number): string {
  const lrn = String(learner.lrn || "").replace(/\s+/g, "").toLowerCase();
  if (lrn) return `lrn:${lrn}`;
  const name = [learner.lastName, learner.firstName, learner.middleName]
    .map((value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    .join("|");
  if (name.replace(/\|/g, "")) return `name:${name}|birth:${learner.birthdate || ""}`;
  return learner.id ? `id:${learner.id}` : `anonymous:${loadId}:${index}`;
}

export function normalizeWorkplace(store?: WorkplaceStore | null): WorkplaceStore {
  const empty = createEmptyWorkplaceStore();
  const incoming = store && typeof store === "object" ? store : empty;
  const preferences = incoming.preferences || empty.preferences;
  const context = incoming.lastContext || empty.lastContext;
  const term = VALID_TERMS.has(context.term) ? context.term : "1";
  return {
    version: 1,
    tasks: (incoming.tasks || [])
      .filter((item) => item && String(item.title || "").trim())
      .map((item, index) => ({
        id: String(item.id || `work-task-${index}`),
        title: String(item.title).trim().slice(0, 160),
        dueDate: String(item.dueDate || "").slice(0, 10),
        completed: Boolean(item.completed),
        createdAt: item.createdAt || new Date().toISOString(),
      })),
    preferences: {
      collapsedPanels: Array.from(new Set((preferences.collapsedPanels || []).map(String).filter(Boolean))),
      includeDuplicateLearners: preferences.includeDuplicateLearners !== false,
      analyticsScope: preferences.analyticsScope === "current" ? "current" : "all",
      attentionScope: preferences.attentionScope === "current" ? "current" : "all",
    },
    lastContext: {
      assignmentId: String(context.assignmentId || ""),
      term,
      action: context.action || "grading",
    },
  };
}

export function workplaceSnapshot(input: {
  loads: TeachingLoad[];
  schoolYear: string;
  currentTerm?: Term;
  currentLoadId?: string;
  workplace?: WorkplaceStore | null;
  advisory?: AdvisoryStore;
  schoolClasses?: SchoolClass[];
  calendarEvents?: CalendarEvent[];
  calendarFilters?: CalendarFilters;
  now?: Date | string;
}): WorkplaceSnapshot {
  const store = normalizeWorkplace(input.workplace);
  const today = typeof input.now === "string" ? input.now : todayIso(input.now);
  const schoolYear = input.schoolYear || "2026-2027";
  const yearLoads = input.loads.filter((load) => !schoolYear || load.schoolYear === schoolYear);
  const current =
    yearLoads.find((load) => load.id === (input.currentLoadId || store.lastContext.assignmentId)) ||
    yearLoads[0] ||
    null;
  const currentTerm = VALID_TERMS.has(input.currentTerm || store.lastContext.term)
    ? (input.currentTerm || store.lastContext.term)
    : "1";

  const advisory = input.advisory
    ? advisoryWorkplaceSummary(input.advisory, schoolYear)
    : { conflicts: 0, missingGrades: 0, pendingImports: 0 };
  const sf1Pending = pendingSf1Imports(input.schoolClasses || [], yearLoads).length;
  const pendingImports = advisory.pendingImports + sf1Pending;

  const analyticsLoads = store.preferences.analyticsScope === "current" && current ? [current] : yearLoads;
  const analytics = buildAnalytics(analyticsLoads, currentTerm);
  analytics.componentPerformance = buildComponentPerformance(current, currentTerm);

  const attention = buildAttention({
    loads: yearLoads,
    today,
    currentTerm,
    selectedLoadId: current?.id,
    advisory,
    pendingImports,
  });

  const calendarFilters = input.calendarFilters || {
    official: true,
    local: true,
    birthdays: true,
    loadId: "all",
  };
  const calendarEvents = visibleEventsForView(input.calendarEvents, yearLoads, calendarFilters, schoolYear);

  const identities = new Set<string>();
  let entries = 0;
  for (const load of yearLoads) {
    load.learners.forEach((learner, index) => {
      entries += 1;
      identities.add(learnerIdentity(load.id, learner, index));
    });
  }

  return {
    today,
    schoolYear,
    currentTerm,
    currentLoadId: current?.id || "",
    attention,
    analytics,
    upcoming: upcomingEvents(calendarEvents, today, 6),
    tasks: store.tasks.slice().sort((left, right) => {
      if (left.completed !== right.completed) return left.completed ? 1 : -1;
      return (left.dueDate || "9999-99-99").localeCompare(right.dueDate || "9999-99-99");
    }),
    preferences: store.preferences,
    stats: {
      classes: yearLoads.length,
      learners: entries,
      learnerDisplay: store.preferences.includeDuplicateLearners ? entries : identities.size,
      learnerEntries: entries,
      uniqueLearners: identities.size,
      attention: attention.length,
    },
  };
}
