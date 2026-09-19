import type { PactActionTag } from "./pact-schema";

export const DUNGEON_FACT_TYPES = [
  "ROOM_ENTERED",
  "PLAYER_ACTION",
  "ENEMY_DEFEATED",
  "PACT_ACCEPTED",
  "PACT_INTERPRETATION_REQUESTED",
  "PACT_CLARIFICATION_REQUESTED",
  "PACT_DECLINED",
  "PACT_BREACHED",
  "PACT_COMPLETED",
  "ACTION_OBSERVED",
  "WITNESS_SPARED",
  "WITNESS_DEFEATED",
  "CAMP_PURCHASED",
  "BOSS_PREPARED",
  "CLUE_REVEALED",
] as const;
export type DungeonFactType = (typeof DUNGEON_FACT_TYPES)[number];

export type DungeonFact = Readonly<{
  id: string;
  type: DungeonFactType;
  revision: number;
  roomId: string;
  subjectId: string;
  actionId: string | null;
  actionTag: PactActionTag | null;
  valueId: string | null;
  sourceFactIds: readonly string[];
}>;

export type DungeonFactDraft = Omit<DungeonFact, "id"> & Readonly<{ key?: string }>;

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

export function dungeonFactId(runId: string, draft: DungeonFactDraft): string {
  const discriminator = draft.key ?? draft.actionId ?? draft.valueId ?? draft.subjectId;
  return `${safePart(runId)}:${draft.revision}:${draft.type}:${safePart(discriminator)}`;
}

export function createDungeonFact(runId: string, draft: DungeonFactDraft): DungeonFact {
  return Object.freeze({
    id: dungeonFactId(runId, draft),
    type: draft.type,
    revision: draft.revision,
    roomId: draft.roomId,
    subjectId: draft.subjectId,
    actionId: draft.actionId,
    actionTag: draft.actionTag,
    valueId: draft.valueId,
    sourceFactIds: draft.sourceFactIds,
  });
}

/** Append-only and idempotent for the same canonical event. */
export function appendDungeonFact(ledger: readonly DungeonFact[], fact: DungeonFact): readonly DungeonFact[] {
  const previous = ledger.find((entry) => entry.id === fact.id);
  if (!previous) {
    const last = ledger.at(-1);
    if (last && fact.revision < last.revision) throw new Error(`Out-of-order dungeon fact: ${fact.id}`);
    return Object.freeze([...ledger, fact]);
  }
  if (JSON.stringify(previous) !== JSON.stringify(fact)) {
    throw new Error(`Conflicting dungeon fact: ${fact.id}`);
  }
  return ledger;
}

export function factsOfType<T extends DungeonFactType>(ledger: readonly DungeonFact[], type: T): readonly DungeonFact[] {
  return ledger.filter((fact) => fact.type === type);
}

export function isDungeonFact(value: unknown): value is DungeonFact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fact = value as DungeonFact;
  return typeof fact.id === "string" && /^[a-zA-Z0-9:_-]{1,260}$/.test(fact.id)
    && DUNGEON_FACT_TYPES.includes(fact.type)
    && Number.isSafeInteger(fact.revision) && fact.revision >= 0 && fact.revision <= 1_000_000
    && typeof fact.roomId === "string" && fact.roomId.length >= 1 && fact.roomId.length <= 80
    && typeof fact.subjectId === "string" && fact.subjectId.length >= 1 && fact.subjectId.length <= 80
    && (fact.actionId === null || (typeof fact.actionId === "string" && fact.actionId.length <= 180))
    && (fact.actionTag === null || ["ATTACK", "STORM", "VOLUNTARY_HEALING", "AUTOMATIC_HEALING", "PURCHASE", "INTERACTION", "MERCY", "INFORMATION_REVEAL", "RESOURCE_SPEND"].includes(fact.actionTag))
    && (fact.valueId === null || (typeof fact.valueId === "string" && fact.valueId.length <= 120))
    && Array.isArray(fact.sourceFactIds) && fact.sourceFactIds.length <= 8
    && fact.sourceFactIds.every((id) => typeof id === "string" && id.length >= 1 && id.length <= 260);
}
