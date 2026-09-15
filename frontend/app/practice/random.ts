export type RandomInt = (maxExclusive: number) => number;

const UINT32_RANGE = 0x1_0000_0000;

export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) return 0;
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value = UINT32_RANGE;

  while (value >= limit) {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0];
  }

  return value % maxExclusive;
};

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

export type SeededRandom = {
  nextInt: RandomInt;
  state: () => number;
};

/**
 * Xorshift32 uses only specified 32-bit integer operations, so the same saved
 * state produces the same sequence in every JavaScript runtime.
 */
export function createSeededRandom(seed: number, savedState = seed): SeededRandom {
  let state = normalizeSeed(savedState);

  return {
    nextInt(maxExclusive) {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) return 0;
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return Math.floor((state / UINT32_RANGE) * maxExclusive);
    },
    state: () => state >>> 0,
  };
}
