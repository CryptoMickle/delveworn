import type { WitnessGateState } from "./schema";

export function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Stable serialization used only for small, JSON-safe rule records. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Binds a plan to every piece of state that can affect its legality or result.
 * Arrays are sorted so equivalent state cannot produce different digests.
 */
export function witnessGateStateDigest(state: WitnessGateState): string {
  const canonical = {
    schemaVersion: state.schemaVersion,
    sceneId: state.sceneId,
    runId: state.runId,
    revision: state.revision,
    sceneSeed: state.sceneSeed,
    player: state.player,
    alarm: state.alarm,
    visibleEntityIds: [...state.visibleEntityIds].sort(),
    resolvedPremiseIds: [...state.resolvedPremiseIds].sort(),
    beliefs: [...state.beliefs]
      .sort((left, right) => `${left.observerId}:${left.signalId}`.localeCompare(`${right.observerId}:${right.signalId}`)),
  };
  return `wgstate-${fnv1a(stableStringify(canonical))}`;
}

