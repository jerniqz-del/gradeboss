export type RandomInt = (maxExclusive: number) => number;

/** Rejection-sampled CSPRNG integer in `[0, maxExclusive)`. Port of eclassrecord `secureRandomInt`. */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("A positive random range is required.");
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Secure randomization is unavailable on this device.");
  }
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const values = new Uint32Array(1);
  do {
    cryptoApi.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % maxExclusive;
}

export function shuffle<T>(items: T[], randomInt: RandomInt = secureRandomInt): T[] {
  const result = Array.from(items || []);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    const value = result[index];
    result[index] = result[target];
    result[target] = value;
  }
  return result;
}
