import type { Learner } from "../../models/learner";
import { groupSexCounts, sexKey } from "./learners";
import { shuffle, type RandomInt, secureRandomInt } from "./random";

export type GroupMode = "random" | "balanced";

export function groupCapacities(learnerCount: number, groupCount: number, randomInt: RandomInt): number[] {
  const minimum = Math.floor(learnerCount / groupCount);
  const largerGroups = learnerCount % groupCount;
  const capacities = Array(groupCount).fill(minimum);
  shuffle(
    Array.from({ length: groupCount }, (_, index) => index),
    randomInt,
  )
    .slice(0, largerGroups)
    .forEach((index) => {
      capacities[index] += 1;
    });
  return capacities;
}

/**
 * Partition a roster into `groupCount` groups. Port of eclassrecord `randomizeGroups`.
 * Balanced mode spreads M/F/unspecified as evenly as capacities allow.
 */
export function randomizeGroups<T extends Pick<Learner, "sex">>(
  learners: T[],
  groupCount: number,
  mode: GroupMode = "random",
  randomInt: RandomInt = secureRandomInt,
): T[][] {
  const roster = Array.from(learners || []);
  const count = Number(groupCount);
  const maximum = Math.min(20, roster.length);
  if (!Number.isInteger(count) || count < 2 || count > maximum) {
    throw new RangeError(`Choose between 2 and ${maximum} groups.`);
  }

  const capacities = groupCapacities(roster.length, count, randomInt);
  const groups = capacities.map((capacity, index) => ({
    index,
    capacity,
    members: [] as T[],
    sexCounts: { M: 0, F: 0, U: 0 },
  }));

  const addMember = (group: (typeof groups)[number], learner: T, key: "M" | "F" | "U") => {
    group.members.push(learner);
    group.sexCounts[key] += 1;
  };

  if (mode !== "balanced") {
    const randomized = shuffle(roster, randomInt);
    let cursor = 0;
    groups.forEach((group) => {
      while (group.members.length < group.capacity) {
        addMember(group, randomized[cursor], "U");
        cursor += 1;
      }
    });
    return groups.map((group) => group.members);
  }

  const buckets: Record<"M" | "F" | "U", T[]> = { M: [], F: [], U: [] };
  roster.forEach((learner) => {
    buckets[sexKey(learner)].push(learner);
  });

  (["M", "F", "U"] as const).forEach((key) => {
    shuffle(buckets[key], randomInt).forEach((learner) => {
      const available = groups.filter((group) => group.members.length < group.capacity);
      const lowestSexCount = Math.min(...available.map((group) => group.sexCounts[key]));
      const sexCandidates = available.filter((group) => group.sexCounts[key] === lowestSexCount);
      const lowestSize = Math.min(...sexCandidates.map((group) => group.members.length));
      const candidates = sexCandidates.filter((group) => group.members.length === lowestSize);
      addMember(candidates[randomInt(candidates.length)], learner, key);
    });
  });

  return groups.map((group) => group.members);
}

export function moveLearner<T extends { id: string }>(groups: T[][], learnerId: string, toGroupIndex: number): T[][] {
  if (toGroupIndex < 0 || toGroupIndex >= groups.length) return groups;
  let moving: T | null = null;
  const stripped = groups.map((members) =>
    members.filter((learner) => {
      if (learner.id !== learnerId) return true;
      moving = learner;
      return false;
    }),
  );
  if (!moving) return groups;
  return stripped.map((members, index) => (index === toGroupIndex ? [...members, moving!] : members));
}

export function sameGroupArrangement<T extends { id: string }>(left: T[][], right: T[][]): boolean {
  return JSON.stringify(left.map((group) => group.map((item) => item.id))) === JSON.stringify(right.map((group) => group.map((item) => item.id)));
}

export function formatGroupsPlainText<T extends { id: string; sex?: string }>(
  groups: T[][],
  nameOf: (learner: T) => string,
): string {
  return groups
    .map((members, index) => {
      const counts = groupSexCounts(members);
      const header = `Group ${index + 1} (${members.length} · M ${counts.M} · F ${counts.F})`;
      const lines = members.map((learner) => `- ${nameOf(learner)}`);
      return [header, ...lines].join("\n");
    })
    .join("\n\n");
}
