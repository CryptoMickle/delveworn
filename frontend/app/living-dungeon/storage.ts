import { BOSS_PREPARATIONS, deriveWitnessBelief, isDungeonBelief, selectBossPreparation } from "./beliefs";
import {
  LIVING_DUNGEON_BREACH_BOSS_HP,
  LIVING_DUNGEON_CAMP_PRICES,
  LIVING_DUNGEON_MAX_POTIONS,
  livingDungeonImprovisationTimelineMatches,
  livingDungeonPactEligibility,
} from "./engine";
import { DUNGEON_FACT_TYPES, isDungeonFact } from "./facts";
import {
  LIVING_DUNGEON_ENEMIES,
  LIVING_DUNGEON_ORIGIN,
  LIVING_DUNGEON_RESOLVER,
  LIVING_DUNGEON_ROOMS,
  LIVING_DUNGEON_RULES,
  LIVING_DUNGEON_SCHEMA_VERSION,
  type LivingDungeon,
  type LivingDungeonCommand,
  type LivingDungeonEnemy,
} from "./model";
import { PACT_BOONS, PACT_CATALOGUE_HASH } from "./pact-catalogue";
import { acceptPactOffer, checkPactAction, pactEligibilityDigest } from "./pact-engine";
import { PACT_ACTION_TAGS, isActivePact, isPactAction, isPactOffer } from "./pact-schema";

export const LIVING_DUNGEON_SAVE_KEY = "delveworn_living_dungeon_v1";
const MAX_SAVE_LENGTH = 100_000;

type LivingDungeonStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StorageSource = LivingDungeonStorage | (() => LivingDungeonStorage);

export type LivingDungeonLoadResult =
  | Readonly<{ status: "restored"; run: LivingDungeon }>
  | Readonly<{ status: "empty" | "invalid" | "unavailable" }>;

function sourceValue(source: StorageSource): LivingDungeonStorage {
  return typeof source === "function" ? source() : source;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown, minimum = 0, maximum = 1_000_000): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isPlayer(value: unknown): value is LivingDungeon["player"] {
  if (!record(value)) return false;
  return integer(value.hp, 0, 100) && integer(value.maxHp, 1, 100) && value.hp <= value.maxHp
    && integer(value.potions, 0, 5) && integer(value.gold, 0, 1_000_000)
    && integer(value.weaponLevel, 0, 100) && integer(value.armorLevel, 0, 100);
}

function isEncounter(
  value: unknown,
  expectedId: LivingDungeonEnemy["id"] | null,
  empoweredBoss: boolean,
): value is LivingDungeonEnemy | null {
  if (expectedId === null) return value === null;
  if (!record(value) || value.id !== expectedId) return false;
  const definition = LIVING_DUNGEON_ENEMIES[expectedId];
  const expectedMaxHp = definition.maxHp
    + Number(expectedId === "keeper-of-conclusions" && empoweredBoss) * LIVING_DUNGEON_BREACH_BOSS_HP;
  return value.name === definition.name && value.maxHp === expectedMaxHp
    && value.minRetaliation === definition.minRetaliation && value.maxRetaliation === definition.maxRetaliation
    && integer(value.hp, 0, expectedMaxHp) && integer(value.turn, 0, 10_000);
}

function isStats(value: unknown): value is LivingDungeon["stats"] {
  if (!record(value)) return false;
  return integer(value.combatTurns) && integer(value.damageDealt, 0, 100_000_000)
    && integer(value.damageTaken, 0, 100_000_000) && integer(value.potionsUsed);
}

function isLastCombatOutcome(value: unknown, run: LivingDungeon): value is LivingDungeon["lastCombatOutcome"] {
  if (value === null) return run.stats.combatTurns === 0;
  if (!record(value) || !Array.isArray(run.facts) || run.stats.combatTurns === 0
    || !["attack", "storm", "potion"].includes(String(value.action))
    || typeof value.actionId !== "string" || value.actionId !== `${run.runId}:${String(value.revision)}:${String(value.action)}`
    || !integer(value.revision, 1, run.revision)
    || !LIVING_DUNGEON_ROOMS.some((room) => room.id === value.roomId && room.kind === "combat")
    || typeof value.critical !== "boolean"
    || !integer(value.damageDealt, 0, 100_000_000)
    || !integer(value.damageTaken, 0, 100_000_000)
    || !integer(value.healing, 0, 25)
    || typeof value.enemyDefeated !== "boolean" || typeof value.playerDefeated !== "boolean") return false;
  if ((value.action !== "attack" && value.critical)
    || (value.action === "potion" && (value.damageDealt !== 0 || value.critical))
    || (value.action !== "potion" && value.healing !== 0)
    || value.damageDealt > run.stats.damageDealt || value.damageTaken > run.stats.damageTaken
    || (value.action === "potion" && run.stats.potionsUsed < 1)) return false;
  const tag = value.action === "attack" ? "ATTACK" : value.action === "storm" ? "STORM" : "VOLUNTARY_HEALING";
  if (!run.facts.some((fact) => fact.type === "PLAYER_ACTION" && fact.revision === value.revision
    && fact.roomId === value.roomId && fact.actionId === value.actionId && fact.actionTag === tag)) return false;
  if (value.revision === run.revision) {
    if (value.playerDefeated !== (run.player.hp === 0)
      || value.enemyDefeated !== (run.encounter?.hp === 0)) return false;
  }
  return true;
}

function isWitness(value: unknown): value is LivingDungeon["witness"] {
  if (!record(value) || value.id !== "dungeon-scrivener"
    || !["UNMET", "FIGHTING", "SPARED", "DEFEATED"].includes(String(value.outcome))
    || !Array.isArray(value.observedTags) || value.observedTags.length > 1
    || !value.observedTags.every((tag) => PACT_ACTION_TAGS.includes(tag))
    || new Set(value.observedTags).size !== value.observedTags.length) return false;
  return true;
}

function isPendingBreach(value: unknown): value is NonNullable<LivingDungeon["pendingBreach"]> {
  if (!record(value) || !record(value.action) || !isPactAction(value.pactAction)) return false;
  const action = value.action as LivingDungeonCommand;
  if (action.type === "storm") return value.pactAction.tag === "STORM";
  if (action.type === "potion") return value.pactAction.tag === "VOLUNTARY_HEALING";
  return action.type === "camp-buy"
    && (action.item === "BANDAGE" || action.item === "POTION")
    && (value.pactAction.tag === "PURCHASE"
      || (action.item === "BANDAGE" && value.pactAction.tag === "VOLUNTARY_HEALING"));
}

function phaseMatches(run: LivingDungeon): boolean {
  const room = LIVING_DUNGEON_ROOMS[run.stageIndex];
  if (room.kind === "pact") return run.phase === "pact";
  if (room.kind === "camp") return run.phase === "camp";
  if (run.roomId === "boss") return ["explore", "combat", "won", "lost"].includes(run.phase);
  return ["explore", "combat", "room-cleared", "lost"].includes(run.phase);
}

function encounterMatchesPhase(run: LivingDungeon): boolean {
  if (!run.encounter) return run.phase === "pact" || run.phase === "camp";
  if ((run.phase === "explore" || run.phase === "combat") && run.encounter.hp === 0) return false;
  if ((run.phase === "room-cleared" || run.phase === "won") && run.encounter.hp !== 0) return false;
  return true;
}

function pactMatches(run: LivingDungeon): boolean {
  if (run.pendingOffer !== null) {
    if (run.phase !== "pact" || run.pact !== null || !isPactOffer(run.pendingOffer)
      || run.pendingOffer.boundRunId !== run.runId || run.pendingOffer.boundRevision !== run.revision
      || run.pendingOffer.terms.catalogueHash !== PACT_CATALOGUE_HASH
      || run.pendingOffer.eligibilityDigest !== pactEligibilityDigest(livingDungeonPactEligibility(run))) return false;
    if (!acceptPactOffer(run.pendingOffer, run.runId, run.revision, livingDungeonPactEligibility(run))) return false;
  }
  if (run.pact === null) return run.pendingBreach === null;
  if (!isActivePact(run.pact) || run.pact.terms.catalogueHash !== PACT_CATALOGUE_HASH
    || run.pact.acceptedAtRevision > run.revision || !PACT_BOONS[run.pact.terms.boonId]) return false;
  const boon = PACT_BOONS[run.pact.terms.boonId];
  if (run.pact.boonUsesRemaining > boon.initialUses
    || (run.pact.terms.boonId !== "BOSS_ENTRY_RESTORE" && run.pact.entryBoonApplied)
    || (run.pact.entryBoonApplied && (run.stageIndex < 5 || run.pact.boonUsesRemaining !== 0))) return false;
  if (run.pact.terms.templateId !== `${run.pact.terms.restrictionId}:${run.pact.terms.boonId}`) return false;
  if (run.pact.status === "COMPLETED" && run.phase !== "won") return false;
  if (run.phase === "won" && run.pact.status === "ACTIVE") return false;
  if (run.pendingBreach !== null) {
    if (!isPendingBreach(run.pendingBreach) || run.pact.status !== "ACTIVE"
      || run.pendingBreach.pactAction.roomId !== run.roomId
      || !run.pendingBreach.pactAction.actionId.startsWith(`${run.runId}:${run.revision + 1}:`)
      || !checkPactAction(run.pact, run.pendingBreach.pactAction).requiresBreachConfirmation) return false;
    const command = run.pendingBreach.action;
    if ((command.type === "storm" && run.phase !== "combat")
      || (command.type === "potion" && (run.phase !== "combat" || run.player.potions < 1 || run.player.hp >= run.player.maxHp))
      || (command.type === "camp-buy" && (run.phase !== "camp"
        || run.facts.some((fact) => fact.type === "CAMP_PURCHASED")
        || run.player.gold < LIVING_DUNGEON_CAMP_PRICES[command.item]
        || (command.item === "POTION" && run.player.potions >= LIVING_DUNGEON_MAX_POTIONS)
        || (command.item === "BANDAGE" && run.player.hp >= run.player.maxHp)))) return false;
    const commandKey = command.type === "camp-buy"
      ? `camp-buy-${command.item.toLocaleLowerCase("en")}`
      : command.type;
    if (run.pendingBreach.pactAction.actionId !== `${run.runId}:${run.revision + 1}:${commandKey}`) return false;
  }
  return true;
}

function knowledgeMatches(run: LivingDungeon): boolean {
  if (!Array.isArray(run.facts) || run.facts.length > 200 || !run.facts.every(isDungeonFact)) return false;
  if (new Set(run.facts.map((fact) => fact.id)).size !== run.facts.length
    || run.facts.some((fact, index) => fact.revision > run.revision
      || (index > 0 && fact.revision < run.facts[index - 1].revision)
      || !DUNGEON_FACT_TYPES.includes(fact.type))) return false;
  const factIds = new Set(run.facts.map((fact) => fact.id));
  if (run.facts.some((fact) => fact.sourceFactIds.some((id) => !factIds.has(id)))) return false;
  if (!Array.isArray(run.beliefs) || run.beliefs.length > 10 || !run.beliefs.every(isDungeonBelief)
    || new Set(run.beliefs.map((belief) => belief.id)).size !== run.beliefs.length
    || run.beliefs.some((belief) => belief.formedAtRevision > run.revision
      || belief.sourceFactIds.some((id) => !factIds.has(id)))) return false;
  const entered = run.facts.filter((fact) => fact.type === "ROOM_ENTERED");
  if (!entered.some((fact) => fact.valueId === run.roomId)) return false;
  if (run.pact && !run.facts.some((fact) => fact.type === "PACT_ACCEPTED" && fact.subjectId === run.pact?.terms.pactId)) return false;
  if (run.pact?.status === "BREACHED" && !run.facts.some((fact) => fact.type === "PACT_BREACHED" && fact.actionId === run.pact?.breachActionId)) return false;
  if (run.pact?.status === "COMPLETED" && !run.facts.some((fact) => fact.type === "PACT_COMPLETED" && fact.subjectId === run.pact?.terms.pactId)) return false;
  return livingDungeonImprovisationTimelineMatches(run);
}

function progressMatches(run: LivingDungeon): boolean {
  const defeated = (enemyId: LivingDungeonEnemy["id"]) => run.facts.some(
    (fact) => fact.type === "ENEMY_DEFEATED" && fact.subjectId === enemyId && fact.valueId === enemyId,
  );
  const resolved = (enemyId: LivingDungeonEnemy["id"]) => defeated(enemyId) || run.facts.some(
    (fact) => fact.type === "ENCOUNTER_BYPASSED" && fact.subjectId === enemyId,
  );
  const acceptedFacts = run.facts.filter((fact) => fact.type === "PACT_ACCEPTED");
  const declinedFacts = run.facts.filter((fact) => fact.type === "PACT_DECLINED");
  const interpretationFacts = run.facts.filter((fact) => fact.type === "PACT_INTERPRETATION_REQUESTED");
  const clarificationFacts = run.facts.filter((fact) => fact.type === "PACT_CLARIFICATION_REQUESTED");
  if (interpretationFacts.length !== run.pactInterpretationAttempts
    || clarificationFacts.length !== run.pactClarificationAttempts
    || run.pactClarificationAttempts > run.pactInterpretationAttempts) return false;
  if (run.stageIndex === 0 && (run.pactOfferAttempts !== 0 || run.pactInterpretationAttempts !== 0
    || run.pactClarificationAttempts !== 0 || run.pendingOffer !== null)) return false;
  if (run.stageIndex < 2) {
    if (run.pact !== null || acceptedFacts.length !== 0 || declinedFacts.length !== 0) return false;
  } else if (run.pact) {
    if (acceptedFacts.length !== 1 || declinedFacts.length !== 0) return false;
    const accepted = acceptedFacts[0];
    if (accepted.subjectId !== run.pact.terms.pactId || accepted.valueId !== run.pact.terms.templateId
      || accepted.revision !== run.pact.acceptedAtRevision) return false;
  } else if (acceptedFacts.length !== 0 || declinedFacts.length !== 1
    || declinedFacts[0].valueId !== "DECLINED") return false;
  if (run.stageIndex > 0 && !resolved("grave-attendant")) return false;
  if (run.stageIndex > 1) {
    const resolvedPactRoom = run.pact !== null || run.facts.some((fact) => fact.type === "PACT_DECLINED");
    if (!resolvedPactRoom) return false;
  }
  if (run.stageIndex > 2 && !defeated("oath-hound")) return false;
  if (run.phase === "room-cleared" && run.roomId === "warmup" && !resolved("grave-attendant")) return false;
  if (run.phase === "room-cleared" && run.roomId === "pressure" && !defeated("oath-hound")) return false;
  if (run.phase === "won" && !defeated("keeper-of-conclusions")) return false;
  if (run.stageIndex < 3 && run.witness.outcome !== "UNMET") return false;
  const knownByScrivener = run.facts.find((fact) => (
    (fact.type === "ACTION_OBSERVED" || fact.type === "REPORT_RELAYED")
    && fact.subjectId === "dungeon-scrivener"
    && fact.actionTag !== null
  ));
  const expectedObservedTags = knownByScrivener?.actionTag ? [knownByScrivener.actionTag] : [];
  if (JSON.stringify(run.witness.observedTags) !== JSON.stringify(expectedObservedTags)) return false;
  if (run.stageIndex === 3) {
    if (["explore", "combat"].includes(run.phase) && run.witness.outcome !== "FIGHTING") return false;
    if (run.phase === "room-cleared" && !["SPARED", "DEFEATED"].includes(run.witness.outcome)) return false;
  }
  if (run.stageIndex > 3 && !["SPARED", "DEFEATED"].includes(run.witness.outcome)) return false;
  if (run.witness.outcome === "SPARED" && !run.facts.some((fact) => fact.type === "WITNESS_SPARED")) return false;
  if (run.witness.outcome === "DEFEATED" && !run.facts.some((fact) => fact.type === "WITNESS_DEFEATED")) return false;
  if (run.witness.outcome === "SPARED") {
    const expected = deriveWitnessBelief(run.facts, run.beliefs[0]?.formedAtRevision ?? run.revision);
    if (!expected || run.beliefs.length !== 1 || JSON.stringify(expected) !== JSON.stringify(run.beliefs[0])) return false;
  } else if (run.beliefs.length !== 0) return false;
  if (run.stageIndex < 5) return run.bossPreparation === "NONE";
  return run.bossPreparation === selectBossPreparation(run.beliefs)
    && run.facts.some((fact) => fact.type === "BOSS_PREPARED" && fact.valueId === run.bossPreparation)
    && run.facts.some((fact) => fact.type === "CLUE_REVEALED" && fact.valueId === run.bossPreparation);
}

export function isLivingDungeon(value: unknown): value is LivingDungeon {
  if (!record(value)) return false;
  const run = value as LivingDungeon;
  if (run.schemaVersion !== LIVING_DUNGEON_SCHEMA_VERSION || run.rulesVersion !== LIVING_DUNGEON_RULES
    || run.resolverVersion !== LIVING_DUNGEON_RESOLVER || run.originId !== LIVING_DUNGEON_ORIGIN
    || typeof run.runId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(run.runId)
    || !integer(run.seed, 0, 0xffffffff) || !integer(run.rngState, 1, 0xffffffff)
    || !integer(run.revision) || !integer(run.pactOfferAttempts, 0, 2)
    || !integer(run.pactInterpretationAttempts, 0, 2)
    || !integer(run.pactClarificationAttempts, 0, 1)
    || !integer(run.stageIndex, 0, LIVING_DUNGEON_ROOMS.length - 1)
    || run.roomId !== LIVING_DUNGEON_ROOMS[run.stageIndex].id
    || !["menu", "ai"].includes(run.variant)
    || !["explore", "combat", "room-cleared", "pact", "camp", "won", "lost"].includes(run.phase)
    || !isPlayer(run.player) || !isEncounter(
      run.encounter,
      LIVING_DUNGEON_ROOMS[run.stageIndex].enemyId,
      run.roomId === "boss" && run.pact?.status === "BREACHED",
    )
    || !isWitness(run.witness) || !BOSS_PREPARATIONS.includes(run.bossPreparation)
    || typeof run.storyBeatId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(run.storyBeatId)
    || !isStats(run.stats) || !isLastCombatOutcome(run.lastCombatOutcome, run)
    || (run.lastAction !== null && (typeof run.lastAction !== "string" || run.lastAction.length > 120))) return false;
  if (!phaseMatches(run) || !encounterMatchesPhase(run) || !pactMatches(run) || !knowledgeMatches(run) || !progressMatches(run)) return false;
  if ((run.phase === "lost") !== (run.player.hp === 0)) return false;
  if (run.stats.potionsUsed > run.stats.combatTurns || run.stats.damageTaken > 0 && run.player.maxHp <= 0) return false;
  return true;
}

export function loadLivingDungeon(source: StorageSource): LivingDungeonLoadResult {
  try {
    const raw = sourceValue(source).getItem(LIVING_DUNGEON_SAVE_KEY);
    if (raw === null) return { status: "empty" };
    if (raw.length > MAX_SAVE_LENGTH) return { status: "invalid" };
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { status: "invalid" }; }
    return isLivingDungeon(value) ? { status: "restored", run: value } : { status: "invalid" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Compare-before-write prevents a stale tab from replacing a newer expedition. */
export function saveLivingDungeon(
  source: StorageSource,
  next: LivingDungeon,
  previous: LivingDungeon | null,
  replace = false,
): "saved" | "conflict" | "unavailable" {
  if (!isLivingDungeon(next)) return "conflict";
  const stored = loadLivingDungeon(source);
  if (stored.status === "unavailable") return "unavailable";
  if (!replace && stored.status === "invalid") return "conflict";
  if (!replace && stored.status === "restored"
    && (stored.run.runId !== previous?.runId || stored.run.revision !== previous?.revision)) return "conflict";
  if (!replace && stored.status === "empty" && previous !== null) return "conflict";
  try {
    sourceValue(source).setItem(LIVING_DUNGEON_SAVE_KEY, JSON.stringify(next));
    return "saved";
  } catch {
    return "unavailable";
  }
}

/** Explicit reset only; invalid or newer saves are never removed during loading. */
export function clearLivingDungeon(source: StorageSource): "cleared" | "unavailable" {
  try {
    sourceValue(source).removeItem(LIVING_DUNGEON_SAVE_KEY);
    return "cleared";
  } catch {
    return "unavailable";
  }
}
