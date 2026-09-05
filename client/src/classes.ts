import type { Sf1Learner, Sf1Meta } from "./sf1";

export interface SchoolClass extends Sf1Meta {
  id: string;
  createdAt: number;
  source: string; // original filename
  learners: Sf1Learner[];
}

const KEY = "gradeboss:classes";

export function listClasses(): SchoolClass[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SchoolClass[]) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function persist(list: SchoolClass[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode / quota) — best effort.
  }
}

export function saveClass(cls: SchoolClass): void {
  const list = listClasses().filter((c) => c.id !== cls.id);
  list.push(cls);
  persist(list);
}

export function deleteClass(id: string): void {
  persist(listClasses().filter((c) => c.id !== id));
}

export function countBySex(learners: Sf1Learner[]): { male: number; female: number } {
  let male = 0;
  let female = 0;
  for (const l of learners) {
    if (l.sex === "M") male++;
    else if (l.sex === "F") female++;
  }
  return { male, female };
}
