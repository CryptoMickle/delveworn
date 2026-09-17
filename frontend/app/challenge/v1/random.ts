/**
 * Frozen Weekly Challenge V1 randomness. Do not replace this import with the
 * live Practice module: archived V1 proofs depend on this exact state machine.
 */
export type V1RandomInt = (maxExclusive: number) => number;

const UINT32_RANGE = 0x1_0000_0000;

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

export function createV1SeededRandom(seed: number, savedState = seed): {
  nextInt: V1RandomInt;
  state: () => number;
} {
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
