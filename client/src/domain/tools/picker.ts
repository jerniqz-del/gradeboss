import { shuffle, type RandomInt, secureRandomInt } from "./random";

export interface NamePickerDraw<T> {
  learner: T | null;
  remaining: number;
  cycle: number;
  restarted: boolean;
}

export interface NamePickerStatus {
  remaining: number;
  total: number;
  cycle: number;
}

export interface NamePicker<T> {
  draw: () => NamePickerDraw<T>;
  reset: () => NamePickerStatus;
  status: () => NamePickerStatus;
}

/** No-repeat draws until the roster is exhausted, then a new shuffled cycle. */
export function createNamePicker<T>(learners: T[], randomInt: RandomInt = secureRandomInt): NamePicker<T> {
  const roster = Array.from(learners || []);
  let remaining: T[] = [];
  let cycle = 0;

  const status = (): NamePickerStatus => ({ remaining: remaining.length, total: roster.length, cycle });

  const reset = (): NamePickerStatus => {
    remaining = shuffle(roster, randomInt);
    cycle += 1;
    return status();
  };

  const draw = (): NamePickerDraw<T> => {
    if (roster.length === 0) return { learner: null, remaining: 0, cycle, restarted: false };
    const restarted = remaining.length === 0;
    if (restarted) reset();
    const learner = remaining.shift() ?? null;
    return { learner, remaining: remaining.length, cycle, restarted };
  };

  return { draw, reset, status };
}
