import {
  createWorkplaceTaskId,
  type WorkplaceContext,
  type WorkplacePreferences,
  type WorkplaceStore,
  type WorkplaceTask,
} from "../../models/workplace";
import { normalizeWorkplace } from "../../domain/workplace";
import { ensureStorageReady } from "../init";
import { openGradeBossDb } from "../db";

export async function getWorkplaceStore(): Promise<WorkplaceStore> {
  const db = await ensureStorageReady();
  return normalizeWorkplace(await db.get("workplace", "default"));
}

export async function saveWorkplaceStore(store: WorkplaceStore): Promise<WorkplaceStore> {
  const db = await ensureStorageReady();
  const next = normalizeWorkplace(store);
  await db.put("workplace", next, "default");
  return next;
}

export async function addWorkplaceTask(title: string, dueDate = ""): Promise<WorkplaceTask> {
  const store = await getWorkplaceStore();
  const task: WorkplaceTask = {
    id: createWorkplaceTaskId(),
    title: title.trim().slice(0, 160),
    dueDate: dueDate.slice(0, 10),
    completed: false,
    createdAt: new Date().toISOString(),
  };
  if (!task.title) throw new Error("Task title is required.");
  store.tasks.push(task);
  await saveWorkplaceStore(store);
  return task;
}

export async function toggleWorkplaceTask(taskId: string): Promise<boolean> {
  const store = await getWorkplaceStore();
  const task = store.tasks.find((item) => item.id === taskId);
  if (!task) return false;
  task.completed = !task.completed;
  await saveWorkplaceStore(store);
  return true;
}

export async function removeWorkplaceTask(taskId: string): Promise<boolean> {
  const store = await getWorkplaceStore();
  const next = store.tasks.filter((item) => item.id !== taskId);
  if (next.length === store.tasks.length) return false;
  await saveWorkplaceStore({ ...store, tasks: next });
  return true;
}

export async function updateWorkplacePreferences(
  patch: Partial<WorkplacePreferences>,
): Promise<WorkplaceStore> {
  const store = await getWorkplaceStore();
  store.preferences = { ...store.preferences, ...patch };
  return saveWorkplaceStore(store);
}

export async function rememberWorkplaceContext(context: Partial<WorkplaceContext>): Promise<WorkplaceStore> {
  const store = await getWorkplaceStore();
  store.lastContext = {
    ...store.lastContext,
    ...(context.assignmentId ? { assignmentId: context.assignmentId } : {}),
    ...(context.term ? { term: context.term } : {}),
    ...(context.action ? { action: context.action } : {}),
  };
  return saveWorkplaceStore(store);
}

export async function putWorkplaceStoreForTest(store: WorkplaceStore): Promise<void> {
  const db = await openGradeBossDb();
  await db.put("workplace", normalizeWorkplace(store), "default");
}
