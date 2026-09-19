import { appendDungeonFact, createDungeonFact, type DungeonFact } from "./facts";

export const DUNGEON_CLAIMS = ["PLAYER_RELIES_ON_STORM", "PLAYER_AVOIDS_STORM", "PLAYER_GUARDS_LIFE"] as const;
export type DungeonClaimId = (typeof DUNGEON_CLAIMS)[number];
export const BOSS_PREPARATIONS = ["NONE", "ANTI_STORM_WARD", "PHYSICAL_BULWARK", "HEALING_PRESSURE"] as const;
export type BossPreparationId = (typeof BOSS_PREPARATIONS)[number];

export type DungeonBelief = Readonly<{
  id: string;
  subjectId: "PLAYER";
  claimId: DungeonClaimId;
  sourceId: "dungeon-scrivener";
  sourceFactIds: readonly string[];
  confidence: number;
  formedAtRevision: number;
  expiresAfterStage: number | null;
}>;

function beliefId(claimId: DungeonClaimId, sourceFactIds: readonly string[]): string {
  const evidence = [...sourceFactIds].sort().join("+").replace(/[^a-zA-Z0-9+_-]/g, "-").slice(-120);
  return `belief:dungeon-scrivener:${claimId}:${evidence}`;
}

export function appendDungeonBelief(ledger: readonly DungeonBelief[], belief: DungeonBelief): readonly DungeonBelief[] {
  const previous = ledger.find((entry) => entry.id === belief.id);
  if (!previous) return Object.freeze([...ledger, belief]);
  if (JSON.stringify(previous) !== JSON.stringify(belief)) throw new Error(`Conflicting dungeon belief: ${belief.id}`);
  return ledger;
}

/** A living witness reports only what its bounded observation facts support. */
export function deriveWitnessBelief(facts: readonly DungeonFact[], revision: number): DungeonBelief | null {
  const survived = facts.find((fact) => fact.type === "WITNESS_SPARED");
  if (!survived || facts.some((fact) => fact.type === "WITNESS_DEFEATED")) return null;
  const observed = facts.filter((fact) => fact.type === "ACTION_OBSERVED" && fact.subjectId === "dungeon-scrivener");
  if (observed.length === 0) return null;

  let claimId: DungeonClaimId;
  let evidence: readonly DungeonFact[];
  const storm = observed.find((fact) => fact.actionTag === "STORM");
  const healing = observed.find((fact) => fact.actionTag === "VOLUNTARY_HEALING");
  if (storm) {
    claimId = "PLAYER_RELIES_ON_STORM";
    evidence = [storm, survived];
  } else if (healing) {
    claimId = "PLAYER_GUARDS_LIFE";
    evidence = [healing, survived];
  } else {
    claimId = "PLAYER_AVOIDS_STORM";
    evidence = [observed[0], survived];
  }
  const sourceFactIds = evidence.map((fact) => fact.id);
  return Object.freeze({
    id: beliefId(claimId, sourceFactIds),
    subjectId: "PLAYER",
    claimId,
    sourceId: "dungeon-scrivener",
    sourceFactIds,
    confidence: claimId === "PLAYER_AVOIDS_STORM" ? 65 : 85,
    formedAtRevision: revision,
    expiresAfterStage: null,
  });
}

export function selectBossPreparation(beliefs: readonly DungeonBelief[]): BossPreparationId {
  const active = [...beliefs].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))[0];
  if (!active) return "NONE";
  if (active.claimId === "PLAYER_RELIES_ON_STORM") return "ANTI_STORM_WARD";
  if (active.claimId === "PLAYER_GUARDS_LIFE") return "HEALING_PRESSURE";
  return "PHYSICAL_BULWARK";
}

export function bossPreparationClue(preparation: BossPreparationId): string {
  if (preparation === "ANTI_STORM_WARD") return "Copper roots bite into the floor around the throne. Someone expected lightning.";
  if (preparation === "PHYSICAL_BULWARK") return "Fresh iron plates cover the throne, while their rune seams remain suspiciously exposed.";
  if (preparation === "HEALING_PRESSURE") return "Empty potion bottles hang above the throne like warning bells.";
  return "The throne bears no sign that your methods reached it first.";
}

export function recordBossPreparation(
  runId: string,
  facts: readonly DungeonFact[],
  beliefs: readonly DungeonBelief[],
  preparation: BossPreparationId,
  revision: number,
): readonly DungeonFact[] {
  const sourceFactIds = beliefs.flatMap((belief) => belief.sourceFactIds).slice(0, 8);
  const prepared = createDungeonFact(runId, {
    type: "BOSS_PREPARED", revision, roomId: "boss", subjectId: "keeper-of-conclusions",
    actionId: null, actionTag: null, valueId: preparation, sourceFactIds, key: preparation,
  });
  const clue = createDungeonFact(runId, {
    type: "CLUE_REVEALED", revision, roomId: "boss", subjectId: "PLAYER",
    actionId: null, actionTag: "INFORMATION_REVEAL", valueId: preparation,
    sourceFactIds: [prepared.id], key: preparation,
  });
  return appendDungeonFact(appendDungeonFact(facts, prepared), clue);
}

export function isDungeonBelief(value: unknown): value is DungeonBelief {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const belief = value as DungeonBelief;
  return typeof belief.id === "string" && belief.id.length >= 1 && belief.id.length <= 300
    && belief.subjectId === "PLAYER" && DUNGEON_CLAIMS.includes(belief.claimId)
    && belief.sourceId === "dungeon-scrivener"
    && Array.isArray(belief.sourceFactIds) && belief.sourceFactIds.length >= 1 && belief.sourceFactIds.length <= 8
    && belief.sourceFactIds.every((id) => typeof id === "string" && id.length <= 260)
    && Number.isInteger(belief.confidence) && belief.confidence >= 0 && belief.confidence <= 100
    && Number.isSafeInteger(belief.formedAtRevision) && belief.formedAtRevision >= 0
    && (belief.expiresAfterStage === null || (Number.isSafeInteger(belief.expiresAfterStage) && belief.expiresAfterStage >= 0));
}

