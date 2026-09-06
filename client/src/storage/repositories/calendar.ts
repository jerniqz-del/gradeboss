import { createEmptyCalendarStore, type CalendarEvent, type CalendarFilters, type CalendarStore } from "../../models/calendar";
import { ensureStorageReady } from "../init";
import { openGradeBossDb } from "../db";

function normalize(store?: CalendarStore | null): CalendarStore {
  const empty = createEmptyCalendarStore();
  if (!store || typeof store !== "object") return empty;
  return {
    version: 1,
    events: Array.isArray(store.events) ? store.events.filter((item) => item && typeof item.id === "string") : [],
    filters: {
      official: store.filters?.official !== false,
      local: store.filters?.local !== false,
      birthdays: store.filters?.birthdays !== false,
      loadId: store.filters?.loadId || "all",
    },
  };
}

export async function getCalendarStore(): Promise<CalendarStore> {
  const db = await ensureStorageReady();
  return normalize(await db.get("calendar", "default"));
}

export async function saveCalendarStore(store: CalendarStore): Promise<CalendarStore> {
  const db = await ensureStorageReady();
  const next = normalize(store);
  await db.put("calendar", next, "default");
  return next;
}

export async function saveLocalCalendarEvent(event: CalendarEvent): Promise<CalendarStore> {
  const store = await getCalendarStore();
  const events = store.events.filter((item) => item.id !== event.id);
  events.push(event);
  return saveCalendarStore({ ...store, events });
}

export async function deleteLocalCalendarEvent(eventId: string): Promise<CalendarStore> {
  const store = await getCalendarStore();
  return saveCalendarStore({
    ...store,
    events: store.events.filter((item) => item.id !== eventId),
  });
}

export async function saveCalendarFilters(filters: CalendarFilters): Promise<CalendarStore> {
  const store = await getCalendarStore();
  return saveCalendarStore({ ...store, filters });
}

export async function putCalendarStoreForTest(store: CalendarStore): Promise<void> {
  const db = await openGradeBossDb();
  await db.put("calendar", normalize(store), "default");
}
