import { createSeededRandom } from "../practice/random";
import {
  appendDungeonBelief,
  bossPreparationClue,
  deriveWitnessBelief,
  recordBossPreparation,
  selectBossPreparation,
  type BossPreparationId,
} from "./beliefs";
import { appendDungeonFact, createDungeonFact, type DungeonFactDraft } from "./facts";
import {
  WITNESS_GATE_BELIEF_SIGNAL_IDS,
  WITNESS_GATE_EFFECT_IDS,
  WITNESS_GATE_MANOEUVRES,
  WITNESS_GATE_PREMISES,
  compileWitnessGatePlan,
  createWitnessGateState,
  isImprovisationSemanticSelection,
  resolveWitnessGatePlan,
  type ImprovisationSemanticSelection,
  type WitnessGateBeliefSignalId,
  type WitnessGateEffectId,
  type WitnessGateResolution,
  type WitnessGateState,
} from "./improvisation";
import {
  acceptPactOffer,
  applyBossDamageBoon,
  applyBossEntryBoon,
  applyBossRetaliationBoon,
  buildPactOffer,
  checkPactAction,
  completePact,
  confirmPactBreach,
  standardPactOffers,
} from "./pact-engine";
import type { PactAction, PactActionTag, PactEligibilitySnapshot, PactOffer } from "./pact-schema";
import {
  LIVING_DUNGEON_ORIGIN,
  LIVING_DUNGEON_ENEMIES,
  LIVING_DUNGEON_RESOLVER,
  LIVING_DUNGEON_ROOMS,
  LIVING_DUNGEON_RULES,
  LIVING_DUNGEON_SCHEMA_VERSION,
  type LivingDungeon,
  type LivingDungeonCommand,
  type LivingDungeonEnemy,
  type LivingDungeonEnemyId,
  type LivingDungeonPhase,
  type LivingDungeonVariant,
} from "./model";

export const LIVING_DUNGEON_MAX_POTIONS = 5;
export const LIVING_DUNGEON_BREACH_BOSS_HP = 20;
const POTION_HEAL = 25;
const CRITICAL_CHANCE = 15;
export const LIVING_DUNGEON_CAMP_PRICES = Object.freeze({ BANDAGE: 20, POTION: 25 });

const ROOM_REWARDS: Readonly<Partial<Record<LivingDungeonEnemyId, number>>> = {
  "grave-attendant": 10,
  "oath-hound": 15,
  "dungeon-scrivener": 15,
  "keeper-of-conclusions": 40,
};

function spawnEnemy(id: LivingDungeonEnemyId): LivingDungeonEnemy {
  const enemy = LIVING_DUNGEON_ENEMIES[id];
  return Object.freeze({ ...enemy, hp: enemy.maxHp, turn: 0 });
}

function empowerBossForBreach(enemy: LivingDungeonEnemy): LivingDungeonEnemy {
  const baseMaxHp = LIVING_DUNGEON_ENEMIES["keeper-of-conclusions"].maxHp;
  if (enemy.id !== "keeper-of-conclusions" || enemy.maxHp > baseMaxHp) return enemy;
  return Object.freeze({
    ...enemy,
    hp: enemy.hp + LIVING_DUNGEON_BREACH_BOSS_HP,
    maxHp: enemy.maxHp + LIVING_DUNGEON_BREACH_BOSS_HP,
  });
}

function addFact(run: LivingDungeon, draft: DungeonFactDraft): LivingDungeon["facts"] {
  return appendDungeonFact(run.facts, createDungeonFact(run.runId, draft));
}

const INTENT_VALUE_SEPARATOR = "~";
const IMPROVISATION_VALUE_SEPARATOR = "~";

function encodeIntentSelection(selection: ImprovisationSemanticSelection): string {
  return [
    selection.premiseId,
    selection.goalId,
    selection.methodId,
    selection.targetId,
    selection.objectId,
    selection.boundaryId,
  ].join(INTENT_VALUE_SEPARATOR);
}

function decodeIntentSelection(value: string | null): ImprovisationSemanticSelection | null {
  if (!value) return null;
  const [premiseId, goalId, methodId, targetId, objectId, boundaryId, ...rest] = value.split(INTENT_VALUE_SEPARATOR);
  if (rest.length > 0) return null;
  const selection = {
    premiseId,
    goalId,
    methodId,
    targetId,
    objectId,
    boundaryId,
    needsClarification: false,
  };
  return isImprovisationSemanticSelection(selection) ? selection : null;
}

type RecordedImprovisation = Readonly<{
  outcome: WitnessGateResolution["outcome"];
  effectId: WitnessGateEffectId;
  signalId: WitnessGateBeliefSignalId;
  alarm: number;
  beliefStrength: 1 | 2 | 3;
}>;

function encodeImprovisationResolution(resolution: WitnessGateResolution): string {
  return [
    resolution.outcome,
    resolution.effectId,
    resolution.observedBelief.signalId,
    resolution.nextState.alarm,
    resolution.observedBelief.strength,
  ].join(IMPROVISATION_VALUE_SEPARATOR);
}

function decodeImprovisationResolution(value: string | null): RecordedImprovisation | null {
  if (!value) return null;
  const [outcome, effectId, signalId, alarmText, strengthText, ...rest] = value.split(IMPROVISATION_VALUE_SEPARATOR);
  const alarm = Number(alarmText);
  const beliefStrength = Number(strengthText);
  if (rest.length > 0 || (outcome !== "SUCCESS" && outcome !== "SETBACK")
    || !WITNESS_GATE_EFFECT_IDS.includes(effectId as WitnessGateEffectId)
    || !WITNESS_GATE_BELIEF_SIGNAL_IDS.includes(signalId as WitnessGateBeliefSignalId)
    || !Number.isSafeInteger(alarm) || alarm < 0 || alarm > 3
    || ![1, 2, 3].includes(beliefStrength)) return null;
  return {
    outcome,
    effectId: effectId as WitnessGateEffectId,
    signalId: signalId as WitnessGateBeliefSignalId,
    alarm,
    beliefStrength: beliefStrength as 1 | 2 | 3,
  };
}

/** The world-shaping choice is an append-only fact, so existing save envelopes need no new field. */
export function livingDungeonIntentSelection(run: Pick<LivingDungeon, "facts">): ImprovisationSemanticSelection | null {
  const declared = run.facts.find((fact) => fact.type === "PLAYER_INTENT_DECLARED");
  return declared ? decodeIntentSelection(declared.valueId) : null;
}

/** Canonical adapter between the expedition and the bounded Witness Gate rules engine. */
export function livingDungeonWitnessGateState(run: LivingDungeon): WitnessGateState {
  const execution = run.facts.find((fact) => fact.type === "IMPROVISATION_EXECUTED");
  const recorded = execution ? decodeImprovisationResolution(execution.valueId) : null;
  const manoeuvre = execution && WITNESS_GATE_MANOEUVRES[execution.subjectId as keyof typeof WITNESS_GATE_MANOEUVRES];
  const resolvedPremiseIds = recorded?.outcome === "SUCCESS" && manoeuvre ? [manoeuvre.premiseId] : [];
  const beliefs = recorded ? [{
    observerId: "MASKED_WARDEN" as const,
    signalId: recorded.signalId,
    strength: recorded.beliefStrength,
  }] : [];
  return createWitnessGateState({
    runId: run.runId,
    revision: run.revision,
    sceneSeed: run.seed,
    player: {
      hp: run.player.hp,
      maxHp: run.player.maxHp,
      gold: run.player.gold,
      potions: run.player.potions,
      stormCharges: 0,
      aptitudes: { CUNNING: 1, MERCY: 1, FORCE: 1, RISK: 1 },
    },
    alarm: recorded?.alarm ?? 0,
    resolvedPremiseIds,
    beliefs,
  });
}

/** Cross-check the compact fact representation against the authored compiler and resolver. */
export function livingDungeonImprovisationTimelineMatches(run: LivingDungeon): boolean {
  const intentFacts = run.facts.filter((fact) => fact.type === "PLAYER_INTENT_DECLARED");
  const executionFacts = run.facts.filter((fact) => fact.type === "IMPROVISATION_EXECUTED");
  const bypassFacts = run.facts.filter((fact) => fact.type === "ENCOUNTER_BYPASSED");
  const relayFacts = run.facts.filter((fact) => fact.type === "REPORT_RELAYED");
  if (intentFacts.length > 1 || executionFacts.length > 1 || bypassFacts.length > 1 || relayFacts.length > 1) return false;
  if (intentFacts.length === 0) return executionFacts.length === 0 && bypassFacts.length === 0 && relayFacts.length === 0;

  const intentFact = intentFacts[0];
  const intent = decodeIntentSelection(intentFact.valueId);
  if (!intent || intentFact.revision !== 1 || intentFact.roomId !== "warmup"
    || intentFact.subjectId !== "PLAYER" || intentFact.actionTag !== "INTERACTION"
    || intentFact.actionId !== `${run.runId}:1:declare-intent`
    || intentFact.sourceFactIds.length !== 0
    || WITNESS_GATE_PREMISES[intent.premiseId].goalId !== intent.goalId) return false;
  const declaredManoeuvre = Object.values(WITNESS_GATE_MANOEUVRES).find((manoeuvre) => (
    manoeuvre.premiseId === intent.premiseId
    && manoeuvre.goalId === intent.goalId
    && manoeuvre.methodId === intent.methodId
    && manoeuvre.targetId === intent.targetId
    && manoeuvre.objectId === intent.objectId
  ));
  if (!declaredManoeuvre) return false;
  if (executionFacts.length === 0) return bypassFacts.length === 0 && relayFacts.length === 0;

  const execution = executionFacts[0];
  const recorded = decodeImprovisationResolution(execution.valueId);
  const manoeuvre = WITNESS_GATE_MANOEUVRES[execution.subjectId as keyof typeof WITNESS_GATE_MANOEUVRES];
  if (!recorded || !manoeuvre || execution.revision !== intentFact.revision + 1
    || execution.roomId !== "warmup" || execution.actionId === null
    || !execution.actionId.startsWith(`${run.runId}:${execution.revision}:improvisation-wgplan-`)
    || execution.actionTag !== actionTagForBeliefSignal(recorded.signalId)
    || manoeuvre.premiseId !== intent.premiseId || manoeuvre.goalId !== intent.goalId
    || manoeuvre.beliefSignalId !== recorded.signalId
    || (recorded.outcome === "SUCCESS" && recorded.effectId !== manoeuvre.successEffectId)
    || (recorded.outcome === "SETBACK" && recorded.effectId !== "WARDEN_ALERTED")) return false;

  const planId = execution.actionId.slice(`${run.runId}:${execution.revision}:improvisation-`.length);
  const initialState = createWitnessGateState({
    runId: run.runId,
    revision: intentFact.revision,
    sceneSeed: run.seed,
    player: {
      hp: 100,
      maxHp: 100,
      gold: 30,
      potions: 3,
      stormCharges: 0,
      aptitudes: { CUNNING: 1, MERCY: 1, FORCE: 1, RISK: 1 },
    },
  });
  const compiled = compileWitnessGatePlan({
    premiseId: manoeuvre.premiseId,
    goalId: manoeuvre.goalId,
    methodId: manoeuvre.methodId,
    targetId: manoeuvre.targetId,
    objectId: manoeuvre.objectId,
    boundaryId: intent.boundaryId,
    needsClarification: false,
  }, initialState);
  if (compiled.status !== "compiled" || compiled.plan.planId !== planId) return false;
  const canonicalResolution = resolveWitnessGatePlan(compiled.plan, initialState);
  if (canonicalResolution.status !== "resolved"
    || encodeImprovisationResolution(canonicalResolution.resolution) !== execution.valueId) return false;

  const actionFacts = run.facts.filter((fact) => fact.type === "PLAYER_ACTION" && fact.actionId === execution.actionId);
  const observedFacts = run.facts.filter((fact) => fact.type === "ACTION_OBSERVED"
    && fact.sourceFactIds.length === 1 && fact.sourceFactIds[0] === execution.id);
  if (actionFacts.length !== 1 || actionFacts[0].revision !== execution.revision
    || actionFacts[0].actionTag !== execution.actionTag
    || execution.sourceFactIds.length !== 2
    || execution.sourceFactIds[0] !== intentFact.id
    || execution.sourceFactIds[1] !== actionFacts[0].id
    || observedFacts.length !== 1 || observedFacts[0].subjectId !== "MASKED_WARDEN"
    || observedFacts[0].actionId !== execution.actionId || observedFacts[0].actionTag !== execution.actionTag
    || observedFacts[0].valueId !== recorded.signalId) return false;

  const shouldHaveRelay = run.stageIndex >= LIVING_DUNGEON_ROOMS.findIndex((room) => room.id === "witness");
  if (shouldHaveRelay) {
    const relay = relayFacts[0];
    const witnessEntry = run.facts.find((fact) => fact.type === "ROOM_ENTERED" && fact.valueId === "witness");
    if (!relay || !witnessEntry || relay.revision !== witnessEntry.revision || relay.roomId !== "witness"
      || relay.subjectId !== "dungeon-scrivener" || relay.actionId !== observedFacts[0].actionId
      || relay.actionTag !== observedFacts[0].actionTag || relay.valueId !== observedFacts[0].valueId
      || relay.sourceFactIds.length !== 1 || relay.sourceFactIds[0] !== observedFacts[0].id) return false;
  } else if (relayFacts.length !== 0) return false;

  if (recorded.outcome === "SUCCESS") {
    if (bypassFacts.length !== 1 || bypassFacts[0].subjectId !== "grave-attendant"
      || bypassFacts[0].roomId !== "warmup" || bypassFacts[0].actionId !== execution.actionId
      || bypassFacts[0].actionTag !== execution.actionTag || bypassFacts[0].valueId !== recorded.effectId
      || bypassFacts[0].sourceFactIds.length !== 1 || bypassFacts[0].sourceFactIds[0] !== execution.id) return false;
  } else if (bypassFacts.length !== 0) return false;

  if (run.stageIndex === 0 && run.revision === execution.revision) {
    const expected = canonicalResolution.resolution.nextState.player;
    if (run.player.hp !== expected.hp || run.player.gold !== expected.gold || run.player.potions !== expected.potions) return false;
    if (recorded.outcome === "SUCCESS" && (run.phase !== "room-cleared" || run.encounter?.hp !== 0)) return false;
    if (recorded.outcome === "SETBACK" && !["combat", "lost"].includes(run.phase)) return false;
  }
  return true;
}

function factDraft(
  run: LivingDungeon,
  revision: number,
  type: DungeonFactDraft["type"],
  overrides: Partial<DungeonFactDraft> = {},
): DungeonFactDraft {
  return {
    type,
    revision,
    roomId: run.roomId,
    subjectId: "PLAYER",
    actionId: null,
    actionTag: null,
    valueId: null,
    sourceFactIds: [],
    ...overrides,
  };
}

export function livingDungeonEligibility(run: LivingDungeon, revision = run.revision): PactEligibilitySnapshot {
  const stagesBeforeBoss = Math.max(0, LIVING_DUNGEON_ROOMS.findIndex((room) => room.id === "boss") - run.stageIndex);
  return Object.freeze({
    runId: run.runId,
    revision,
    stormAvailable: true,
    potions: run.player.potions,
    voluntaryHealingOpportunities: stagesBeforeBoss,
    gold: run.player.gold,
    campAhead: run.stageIndex < LIVING_DUNGEON_ROOMS.findIndex((room) => room.id === "camp"),
    campMinimumPrice: LIVING_DUNGEON_CAMP_PRICES.BANDAGE,
    damagingRoomsBeforeBoss: LIVING_DUNGEON_ROOMS.slice(run.stageIndex + 1)
      .filter((room) => room.kind === "combat").length,
  });
}

export const livingDungeonPactEligibility = livingDungeonEligibility;

export function standardLivingDungeonPactOffers(run: LivingDungeon, offerSeed = run.seed): readonly PactOffer[] {
  if (run.phase !== "pact" || run.pact || run.pendingOffer) return [];
  return standardPactOffers(livingDungeonEligibility(run), offerSeed >>> 0);
}

export function createLivingDungeon(
  seed: number,
  runId: string,
  variant: LivingDungeonVariant = "menu",
): LivingDungeon {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Living Dungeon seed must be a uint32.");
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(runId)) throw new Error("Living Dungeon run ID is invalid.");
  const rng = createSeededRandom(seed);
  const encounter = spawnEnemy("grave-attendant");
  const base: LivingDungeon = {
    schemaVersion: LIVING_DUNGEON_SCHEMA_VERSION,
    rulesVersion: LIVING_DUNGEON_RULES,
    resolverVersion: LIVING_DUNGEON_RESOLVER,
    runId,
    seed: seed >>> 0,
    rngState: rng.state(),
    revision: 0,
    phase: "explore",
    stageIndex: 0,
    roomId: "warmup",
    variant,
    originId: LIVING_DUNGEON_ORIGIN,
    player: Object.freeze({ hp: 100, maxHp: 100, potions: 3, gold: 30, weaponLevel: 0, armorLevel: 0 }),
    encounter,
    pact: null,
    pendingOffer: null,
    pactOfferAttempts: 0,
    pactInterpretationAttempts: 0,
    pactClarificationAttempts: 0,
    pendingBreach: null,
    facts: [],
    beliefs: [],
    witness: Object.freeze({ id: "dungeon-scrivener", outcome: "UNMET", observedTags: [] }),
    bossPreparation: "NONE",
    storyBeatId: "arrival",
    stats: Object.freeze({ combatTurns: 0, damageDealt: 0, damageTaken: 0, potionsUsed: 0 }),
    lastCombatOutcome: null,
    lastAction: null,
  };
  return Object.freeze({
    ...base,
    facts: addFact(base, factDraft(base, 0, "ROOM_ENTERED", { valueId: "warmup", key: "warmup" })),
  });
}

export function livingDungeonPhase(run: LivingDungeon): LivingDungeonPhase {
  return run.phase;
}

export type LivingDungeonCombatPreview = Readonly<{
  attack: readonly [number, number];
  storm: readonly [number, number];
  retaliation: readonly [number, number];
  potionRetaliation: readonly [number, number];
  criticalChance: number;
  potionHeal: number;
  flags: Readonly<{
    bossPreparation: BossPreparationId;
    damageBoonPercent: 100 | 115;
    damageBoonUsesRemaining: number;
    retaliationBoonPercent: 50 | 100;
    retaliationBoonUsesRemaining: number;
    potionRetaliationMode: "HALF" | "FULL";
  }>;
}>;

function preparedDamage(preparation: BossPreparationId, tag: "ATTACK" | "STORM", raw: number): number {
  if (preparation === "ANTI_STORM_WARD" && tag === "STORM") return Math.floor(raw * 60 / 100);
  if (preparation === "PHYSICAL_BULWARK" && tag === "ATTACK") return Math.floor(raw * 75 / 100);
  if (preparation === "PHYSICAL_BULWARK" && tag === "STORM") return Math.floor(raw * 125 / 100);
  return raw;
}

export function livingDungeonCombatPreview(run: LivingDungeon): LivingDungeonCombatPreview {
  const base = 10 + run.player.weaponLevel * 2;
  const boss = run.roomId === "boss";
  const attack: [number, number] = [base - 2, base + 2];
  const storm: [number, number] = [0, base * 2];
  const rawRetaliation: [number, number] = run.encounter
    ? [
      Math.max(0, run.encounter.minRetaliation - run.player.armorLevel),
      Math.max(0, run.encounter.maxRetaliation - run.player.armorLevel),
    ]
    : [0, 0];
  const damageBoonActive = boss && run.pact?.status === "ACTIVE"
    && run.pact.terms.boonId === "BOSS_OPENING_FURY" && run.pact.boonUsesRemaining > 0;
  const wardActive = boss && run.pact?.status === "ACTIVE"
    && run.pact.terms.boonId === "BOSS_OPENING_WARD" && run.pact.boonUsesRemaining > 0;
  const prepare = (tag: "ATTACK" | "STORM", raw: number) => boss
    ? preparedDamage(run.bossPreparation, tag, raw)
    : raw;
  const boon = (raw: number) => damageBoonActive ? Math.floor(raw * 115 / 100) : raw;
  const ward = (raw: number) => wardActive ? Math.floor(raw * 50 / 100) : raw;
  const shownAttack: [number, number] = [
    boon(prepare("ATTACK", attack[0])),
    boon(prepare("ATTACK", attack[1])),
  ];
  const shownStorm: [number, number] = [
    boon(prepare("STORM", storm[0])),
    boon(prepare("STORM", storm[1])),
  ];
  const retaliation: [number, number] = [ward(rawRetaliation[0]), ward(rawRetaliation[1])];
  const fullPotionRetaliation = boss && run.bossPreparation === "HEALING_PRESSURE";
  const potionRetaliation: [number, number] = [
    ward(fullPotionRetaliation ? rawRetaliation[0] : Math.ceil(rawRetaliation[0] / 2)),
    ward(fullPotionRetaliation ? rawRetaliation[1] : Math.ceil(rawRetaliation[1] / 2)),
  ];
  return Object.freeze({
    attack: shownAttack,
    storm: shownStorm,
    retaliation,
    potionRetaliation,
    criticalChance: CRITICAL_CHANCE,
    potionHeal: POTION_HEAL,
    flags: Object.freeze({
      bossPreparation: run.bossPreparation,
      damageBoonPercent: damageBoonActive ? 115 : 100,
      damageBoonUsesRemaining: damageBoonActive ? run.pact?.boonUsesRemaining ?? 0 : 0,
      retaliationBoonPercent: wardActive ? 50 : 100,
      retaliationBoonUsesRemaining: wardActive ? run.pact?.boonUsesRemaining ?? 0 : 0,
      potionRetaliationMode: fullPotionRetaliation ? "FULL" : "HALF",
    }),
  });
}

export function availableLivingDungeonActions(run: LivingDungeon): readonly LivingDungeonCommand["type"][] {
  if (run.pendingBreach) return ["confirm-breach", "cancel-breach"];
  if (run.phase === "explore") {
    if (run.roomId !== "warmup") return ["engage"];
    return livingDungeonIntentSelection(run)
      ? ["execute-improvisation", "engage"]
      : ["declare-intent", "engage"];
  }
  if (run.phase === "combat") {
    const actions: LivingDungeonCommand["type"][] = ["attack", "storm"];
    if (run.player.potions > 0 && run.player.hp < run.player.maxHp) actions.push("potion");
    if (run.roomId === "witness" && run.encounter && run.encounter.hp <= Math.ceil(run.encounter.maxHp / 2)) actions.push("spare-witness");
    return actions;
  }
  if (run.phase === "room-cleared") return run.roomId === "boss" ? [] : ["continue"];
  if (run.phase === "pact") return run.pendingOffer ? ["accept-pact", "prepare-pact", "decline-pact"] : ["prepare-pact", "decline-pact"];
  if (run.phase === "camp") return ["camp-buy", "camp-skip"];
  return [];
}

function pactAction(run: LivingDungeon, tag: PactActionTag, command: string, revisionOffset = 1): PactAction {
  return Object.freeze({
    actionId: `${run.runId}:${run.revision + revisionOffset}:${command}`,
    tag,
    source: "PLAYER",
    roomId: run.roomId,
  });
}

function actionTag(
  run: LivingDungeon,
  command: Extract<LivingDungeonCommand, { type: "storm" | "potion" | "camp-buy" }>,
): PactActionTag {
  if (command.type === "storm") return "STORM";
  if (command.type === "potion") return "VOLUNTARY_HEALING";
  if (command.item === "BANDAGE" && run.pact?.terms.restrictionId === "NO_VOLUNTARY_HEALING") {
    return "VOLUNTARY_HEALING";
  }
  return "PURCHASE";
}

function breachableCommandKey(
  command: Extract<LivingDungeonCommand, { type: "storm" | "potion" | "camp-buy" }>,
): string {
  return command.type === "camp-buy"
    ? `camp-buy-${command.item.toLocaleLowerCase("en")}`
    : command.type;
}

function validActionBeforeBreach(run: LivingDungeon, command: Extract<LivingDungeonCommand, { type: "storm" | "potion" | "camp-buy" }>): boolean {
  if (command.type === "storm") return run.phase === "combat" && !!run.encounter;
  if (command.type === "potion") return run.phase === "combat" && !!run.encounter && run.player.potions > 0 && run.player.hp < run.player.maxHp;
  if (run.phase !== "camp" || run.facts.some((fact) => fact.type === "CAMP_PURCHASED")) return false;
  const price = LIVING_DUNGEON_CAMP_PRICES[command.item];
  return run.player.gold >= price && (command.item !== "POTION" || run.player.potions < LIVING_DUNGEON_MAX_POTIONS)
    && (command.item !== "BANDAGE" || run.player.hp < run.player.maxHp);
}

function maybeWarnForBreach(
  run: LivingDungeon,
  command: Extract<LivingDungeonCommand, { type: "storm" | "potion" | "camp-buy" }>,
): LivingDungeon | null {
  if (!validActionBeforeBreach(run, command)) return run;
  // The warning is its own saved revision. Bind the pending action to the
  // following confirmation revision so breach and execution share one ID.
  const action = pactAction(run, actionTag(run, command), breachableCommandKey(command), 2);
  if (!checkPactAction(run.pact, action).requiresBreachConfirmation) return null;
  return Object.freeze({
    ...run,
    revision: run.revision + 1,
    pendingBreach: Object.freeze({ action: command, pactAction: action }),
    lastAction: "breach-warning",
  });
}

function observeWitnessAction(run: LivingDungeon, action: PactAction, facts: LivingDungeon["facts"]): Pick<LivingDungeon, "facts" | "witness"> {
  if (run.roomId !== "witness" || run.witness.outcome !== "FIGHTING") return { facts, witness: run.witness };
  if (!["ATTACK", "STORM", "VOLUNTARY_HEALING"].includes(action.tag)
    || facts.some((fact) => (fact.type === "ACTION_OBSERVED" || fact.type === "REPORT_RELAYED")
      && fact.subjectId === "dungeon-scrivener")) {
    return { facts, witness: run.witness };
  }
  const observed = createDungeonFact(run.runId, {
    type: "ACTION_OBSERVED", revision: run.revision + 1, roomId: "witness", subjectId: "dungeon-scrivener",
    actionId: action.actionId, actionTag: action.tag, valueId: "PLAYER", sourceFactIds: [], key: action.actionId,
  });
  return {
    facts: appendDungeonFact(facts, observed),
    witness: Object.freeze({
      ...run.witness,
      observedTags: Object.freeze([action.tag]),
    }),
  };
}

function applyRetaliation(
  run: LivingDungeon,
  rng: ReturnType<typeof createSeededRandom>,
  pact: LivingDungeon["pact"],
  fraction: 1 | 2,
): Readonly<{ player: LivingDungeon["player"]; pact: LivingDungeon["pact"]; damage: number }> {
  if (!run.encounter) return { player: run.player, pact, damage: 0 };
  const span = run.encounter.maxRetaliation - run.encounter.minRetaliation + 1;
  let damage = run.encounter.minRetaliation + rng.nextInt(span);
  damage = Math.max(0, damage - run.player.armorLevel);
  if (fraction === 2 && !(run.roomId === "boss" && run.bossPreparation === "HEALING_PRESSURE")) damage = Math.ceil(damage / 2);
  if (run.roomId === "boss") {
    const warded = applyBossRetaliationBoon(pact, damage);
    pact = warded.pact;
    damage = warded.damage;
  }
  return { player: Object.freeze({ ...run.player, hp: Math.max(0, run.player.hp - damage) }), pact, damage };
}

function recordPlayerAction(run: LivingDungeon, action: PactAction): LivingDungeon["facts"] {
  return addFact(run, factDraft(run, run.revision + 1, "PLAYER_ACTION", {
    actionId: action.actionId,
    actionTag: action.tag,
    valueId: action.tag,
    key: action.actionId,
  }));
}

function combatAction(run: LivingDungeon, command: "attack" | "storm" | "potion"): LivingDungeon {
  if (run.phase !== "combat" || !run.encounter) return run;
  if (command === "potion" && (run.player.potions < 1 || run.player.hp >= run.player.maxHp)) return run;
  const tag: PactActionTag = command === "attack" ? "ATTACK" : command === "storm" ? "STORM" : "VOLUNTARY_HEALING";
  const action = pactAction(run, tag, command);
  let facts = recordPlayerAction(run, action);
  const observed = observeWitnessAction(run, action, facts);
  facts = observed.facts;
  let witness = observed.witness;
  const rng = createSeededRandom(run.seed, run.rngState);
  let player = run.player;
  let encounter = run.encounter;
  let pact = run.pact;
  let dealt = 0;
  let taken = 0;
  let healing = 0;
  let critical = false;

  if (command === "potion") {
    const healedHp = Math.min(player.maxHp, player.hp + POTION_HEAL);
    healing = healedHp - player.hp;
    player = Object.freeze({ ...player, hp: healedHp, potions: player.potions - 1 });
    const retaliation = applyRetaliation({ ...run, player }, rng, pact, 2);
    player = retaliation.player;
    pact = retaliation.pact;
    taken = retaliation.damage;
  } else {
    const base = 10 + player.weaponLevel * 2;
    let rolled = command === "attack" ? base - 2 + rng.nextInt(5) : rng.nextInt(base * 2 + 1);
    if (command === "attack" && rng.nextInt(100) < CRITICAL_CHANCE) {
      critical = true;
      rolled *= 2;
    }
    if (run.roomId === "boss") rolled = preparedDamage(run.bossPreparation, tag as "ATTACK" | "STORM", rolled);
    if (run.roomId === "boss") {
      const boosted = applyBossDamageBoon(pact, rolled);
      pact = boosted.pact;
      rolled = boosted.damage;
    }
    dealt = Math.min(rolled, encounter.hp);
    encounter = Object.freeze({ ...encounter, hp: Math.max(0, encounter.hp - rolled), turn: encounter.turn + 1 });
    if (encounter.hp > 0) {
      const retaliation = applyRetaliation({ ...run, encounter }, rng, pact, 1);
      player = retaliation.player;
      pact = retaliation.pact;
      taken = retaliation.damage;
    }
  }

  let phase: LivingDungeonPhase = player.hp === 0 ? "lost" : "combat";
  let storyBeatId = run.storyBeatId;
  if (encounter.hp === 0 && player.hp > 0) {
    phase = run.roomId === "boss" ? "won" : "room-cleared";
    player = Object.freeze({ ...player, gold: player.gold + (ROOM_REWARDS[encounter.id] ?? 0) });
    facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, run.revision + 1, "ENEMY_DEFEATED", {
      subjectId: encounter.id, valueId: encounter.id, key: encounter.id,
    })));
    if (run.roomId === "witness") {
      witness = Object.freeze({ ...witness, outcome: "DEFEATED" });
      facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, run.revision + 1, "WITNESS_DEFEATED", {
        subjectId: "dungeon-scrivener", valueId: "DEFEATED", key: "dungeon-scrivener",
      })));
      storyBeatId = "witness-silenced";
    }
    if (run.roomId === "boss") {
      const completed = completePact(pact, run.revision + 1);
      if (completed?.status === "COMPLETED") {
        pact = completed;
        facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, run.revision + 1, "PACT_COMPLETED", {
          subjectId: completed.terms.pactId, valueId: completed.terms.pactId, key: completed.terms.pactId,
        })));
      }
      storyBeatId = "consequence-understood";
    }
  }

  return Object.freeze({
    ...run,
    revision: run.revision + 1,
    rngState: rng.state(),
    phase,
    player,
    encounter,
    pact,
    facts,
    witness,
    storyBeatId,
    stats: Object.freeze({
      combatTurns: run.stats.combatTurns + 1,
      damageDealt: run.stats.damageDealt + dealt,
      damageTaken: run.stats.damageTaken + taken,
      potionsUsed: run.stats.potionsUsed + Number(command === "potion"),
    }),
    lastCombatOutcome: Object.freeze({
      action: command,
      actionId: action.actionId,
      revision: run.revision + 1,
      roomId: run.roomId,
      critical,
      damageDealt: dealt,
      damageTaken: taken,
      healing,
      enemyDefeated: encounter.hp === 0,
      playerDefeated: player.hp === 0,
    }),
    lastAction: command,
  });
}

function enterStage(run: LivingDungeon, stageIndex: number): LivingDungeon {
  const room = LIVING_DUNGEON_ROOMS[stageIndex];
  if (!room) return run;
  const revision = run.revision + 1;
  const phase: LivingDungeonPhase = room.kind === "combat" ? "explore" : room.kind;
  let encounter = room.enemyId ? spawnEnemy(room.enemyId) : null;
  if (room.id === "boss" && run.pact?.status === "BREACHED" && encounter) {
    encounter = empowerBossForBreach(encounter);
  }
  let pact = run.pact;
  let player = run.player;
  let facts = run.facts;
  let bossPreparation = run.bossPreparation;
  let storyBeatId: string = room.id;
  let witness = run.witness;

  const staged: LivingDungeon = { ...run, revision, stageIndex, roomId: room.id, phase, encounter };
  facts = addFact(staged, factDraft(staged, revision, "ROOM_ENTERED", { valueId: room.id, key: room.id }));
  if (room.id === "witness") {
    const priorObservation = facts.find((fact) => (
      fact.type === "ACTION_OBSERVED"
      && fact.subjectId === "MASKED_WARDEN"
      && fact.actionTag !== null
    ));
    let knownAction = facts.find((fact) => (
      (fact.type === "ACTION_OBSERVED" || fact.type === "REPORT_RELAYED")
      && fact.subjectId === "dungeon-scrivener"
      && fact.actionTag !== null
    ));
    if (priorObservation) {
      const relayed = createDungeonFact(run.runId, factDraft(staged, revision, "REPORT_RELAYED", {
        subjectId: "dungeon-scrivener",
        actionId: priorObservation.actionId,
        actionTag: priorObservation.actionTag,
        valueId: priorObservation.valueId,
        sourceFactIds: [priorObservation.id],
        key: priorObservation.id,
      }));
      facts = appendDungeonFact(facts, relayed);
      knownAction = relayed;
    }
    witness = Object.freeze({
      ...witness,
      outcome: "FIGHTING",
      observedTags: knownAction?.actionTag
        ? Object.freeze([knownAction.actionTag])
        : witness.observedTags,
    });
  }
  if (room.id === "boss") {
    bossPreparation = selectBossPreparation(run.beliefs);
    facts = recordBossPreparation(run.runId, facts, run.beliefs, bossPreparation, revision);
    const entry = applyBossEntryBoon(pact, player.hp, player.maxHp);
    pact = entry.pact;
    player = Object.freeze({ ...player, hp: entry.hp });
    if (entry.healed > 0) {
      facts = appendDungeonFact(facts, createDungeonFact(run.runId, {
        type: "PLAYER_ACTION", revision, roomId: "boss", subjectId: "PLAYER",
        actionId: `${run.runId}:${revision}:boss-entry-heal`, actionTag: "AUTOMATIC_HEALING",
        valueId: String(entry.healed), sourceFactIds: [], key: "boss-entry-heal",
      }));
    }
    storyBeatId = `boss-${bossPreparation.toLocaleLowerCase("en")}`;
  }
  return Object.freeze({
    ...run, revision, stageIndex, roomId: room.id, phase, encounter, pact, player, facts,
    bossPreparation, storyBeatId, witness, pendingOffer: null, lastAction: "continue",
  });
}

function spareWitness(run: LivingDungeon): LivingDungeon {
  if (run.phase !== "combat" || run.roomId !== "witness" || !run.encounter
    || run.encounter.hp > Math.ceil(run.encounter.maxHp / 2)) return run;
  const revision = run.revision + 1;
  const action = pactAction(run, "MERCY", "spare-witness");
  let facts = recordPlayerAction(run, action);
  const observed = observeWitnessAction(run, action, facts);
  facts = observed.facts;
  const witness = Object.freeze({ ...observed.witness, outcome: "SPARED" as const });
  facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, revision, "WITNESS_SPARED", {
    subjectId: "dungeon-scrivener", actionId: action.actionId, actionTag: "MERCY", valueId: "SPARED", key: "dungeon-scrivener",
  })));
  const belief = deriveWitnessBelief(facts, revision);
  const beliefs = belief ? appendDungeonBelief(run.beliefs, belief) : run.beliefs;
  return Object.freeze({
    ...run,
    revision,
    phase: "room-cleared",
    encounter: Object.freeze({ ...run.encounter, hp: 0 }),
    facts,
    beliefs,
    witness,
    storyBeatId: belief ? `witness-${belief.claimId.toLocaleLowerCase("en")}` : "witness-spared",
    lastAction: "spare-witness",
  });
}

function campPurchase(run: LivingDungeon, item: "BANDAGE" | "POTION"): LivingDungeon {
  const command = { type: "camp-buy" as const, item };
  if (!validActionBeforeBreach(run, command)) return run;
  const price = LIVING_DUNGEON_CAMP_PRICES[item];
  const revision = run.revision + 1;
  const action = pactAction(run, actionTag(run, command), breachableCommandKey(command));
  const player = { ...run.player, gold: run.player.gold - price };
  if (item === "BANDAGE") player.hp = Math.min(player.maxHp, player.hp + POTION_HEAL);
  else player.potions++;
  let facts = recordPlayerAction(run, action);
  facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, revision, "CAMP_PURCHASED", {
    actionId: action.actionId, actionTag: "PURCHASE", valueId: item, key: item,
  })));
  return Object.freeze({ ...run, revision, player: Object.freeze(player), facts, lastAction: `camp-buy-${item.toLocaleLowerCase("en")}` });
}

function declareLivingDungeonIntent(
  run: LivingDungeon,
  selection: ImprovisationSemanticSelection,
): LivingDungeon {
  if (run.phase !== "explore" || run.roomId !== "warmup" || livingDungeonIntentSelection(run)
    || !isImprovisationSemanticSelection(selection) || selection.needsClarification
    || WITNESS_GATE_PREMISES[selection.premiseId].goalId !== selection.goalId) return run;
  const supported = Object.values(WITNESS_GATE_MANOEUVRES).some((manoeuvre) => (
    manoeuvre.premiseId === selection.premiseId
    && manoeuvre.goalId === selection.goalId
    && manoeuvre.methodId === selection.methodId
    && manoeuvre.targetId === selection.targetId
    && manoeuvre.objectId === selection.objectId
  ));
  if (!supported) return run;
  const revision = run.revision + 1;
  const actionId = `${run.runId}:${revision}:declare-intent`;
  const facts = appendDungeonFact(run.facts, createDungeonFact(run.runId, factDraft(
    run,
    revision,
    "PLAYER_INTENT_DECLARED",
    {
      subjectId: "PLAYER",
      actionId,
      actionTag: "INTERACTION",
      valueId: encodeIntentSelection(selection),
      key: "witness-gate",
    },
  )));
  return Object.freeze({
    ...run,
    revision,
    facts,
    storyBeatId: `intent-${selection.goalId.toLocaleLowerCase("en")}`,
    lastAction: "declare-intent",
  });
}

function actionTagForBeliefSignal(signalId: WitnessGateBeliefSignalId): PactActionTag {
  if (signalId === "GAMBLES_WITH_STORM") return "STORM";
  if (signalId === "PAYS_TO_PROTECT") return "VOLUNTARY_HEALING";
  if (signalId === "BREAKS_OBSTACLES") return "ATTACK";
  return "INTERACTION";
}

function executeLivingDungeonImprovisation(
  run: LivingDungeon,
  plan: Extract<LivingDungeonCommand, { type: "execute-improvisation" }>["plan"],
): LivingDungeon {
  if (run.phase !== "explore" || run.roomId !== "warmup" || !run.encounter) return run;
  const intent = livingDungeonIntentSelection(run);
  if (!intent || plan.premiseId !== intent.premiseId || plan.goalId !== intent.goalId
    || plan.boundaryId !== intent.boundaryId) return run;
  const state = livingDungeonWitnessGateState(run);
  const resolved = resolveWitnessGatePlan(plan, state, "en");
  if (resolved.status !== "resolved") return run;

  const { resolution } = resolved;
  const revision = run.revision + 1;
  const actionTag = actionTagForBeliefSignal(resolution.observedBelief.signalId);
  const actionId = `${run.runId}:${revision}:improvisation-${plan.planId}`;
  const pactAction: PactAction = Object.freeze({
    actionId,
    tag: actionTag,
    source: "PLAYER",
    roomId: run.roomId,
  });
  const intentFact = run.facts.find((fact) => fact.type === "PLAYER_INTENT_DECLARED")!;
  let facts = recordPlayerAction(run, pactAction);
  const executedFact = createDungeonFact(run.runId, factDraft(run, revision, "IMPROVISATION_EXECUTED", {
    subjectId: plan.manoeuvreId,
    actionId,
    actionTag,
    valueId: encodeImprovisationResolution(resolution),
    sourceFactIds: [intentFact.id, facts.at(-1)!.id],
    key: resolution.resolutionId,
  }));
  facts = appendDungeonFact(facts, executedFact);
  facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, revision, "ACTION_OBSERVED", {
    subjectId: "MASKED_WARDEN",
    actionId,
    actionTag,
    valueId: resolution.observedBelief.signalId,
    sourceFactIds: [executedFact.id],
    key: actionId,
  })));

  const succeeded = resolution.outcome === "SUCCESS";
  if (succeeded) {
    facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, revision, "ENCOUNTER_BYPASSED", {
      subjectId: run.encounter.id,
      actionId,
      actionTag,
      valueId: resolution.effectId,
      sourceFactIds: [executedFact.id],
      key: actionId,
    })));
  }
  const player = Object.freeze({
    ...run.player,
    hp: resolution.nextState.player.hp,
    gold: resolution.nextState.player.gold,
    potions: resolution.nextState.player.potions,
  });
  const phase: LivingDungeonPhase = player.hp === 0
    ? "lost"
    : succeeded ? "room-cleared" : "combat";
  return Object.freeze({
    ...run,
    revision,
    phase,
    player,
    encounter: succeeded ? Object.freeze({ ...run.encounter, hp: 0 }) : run.encounter,
    facts,
    witness: run.witness,
    storyBeatId: succeeded ? "witness-gate-success" : "witness-gate-setback",
    stats: Object.freeze({
      ...run.stats,
      damageTaken: run.stats.damageTaken + resolution.costPaid.hp + resolution.setbackDamage,
    }),
    lastCombatOutcome: null,
    lastAction: succeeded ? "improvisation-success" : "improvisation-setback",
  });
}

function executeBreachable(
  run: LivingDungeon,
  command: Extract<LivingDungeonCommand, { type: "storm" | "potion" | "camp-buy" }>,
  skipWarning = false,
): LivingDungeon {
  if (!skipWarning) {
    const warning = maybeWarnForBreach(run, command);
    if (warning) return warning;
  }
  return command.type === "camp-buy" ? campPurchase(run, command.item) : combatAction(run, command.type);
}

export function transitionLivingDungeon(
  run: LivingDungeon,
  command: LivingDungeonCommand,
  expectedRevision = run.revision,
): LivingDungeon {
  if (expectedRevision !== run.revision || run.phase === "won" || run.phase === "lost") return run;
  if (run.pendingBreach) {
    if (command.type === "cancel-breach") {
      return Object.freeze({ ...run, revision: run.revision + 1, pendingBreach: null, lastAction: "breach-cancelled" });
    }
    if (command.type !== "confirm-breach" || !run.pact) return run;
    const pending = run.pendingBreach;
    const pact = confirmPactBreach(run.pact, pending.pactAction, run.revision + 1);
    let facts = run.facts;
    let encounter = run.encounter;
    if (pact !== run.pact) {
      facts = appendDungeonFact(facts, createDungeonFact(run.runId, factDraft(run, run.revision + 1, "PACT_BREACHED", {
        subjectId: pact.terms.pactId, actionId: pending.pactAction.actionId, actionTag: pending.pactAction.tag,
        valueId: pact.terms.breachId, key: pending.pactAction.actionId,
      })));
      if (run.roomId === "boss" && encounter) encounter = empowerBossForBreach(encounter);
    }
    const ready = { ...run, pact, facts, encounter, pendingBreach: null, revision: run.revision };
    return executeBreachable(ready, pending.action, true);
  }

  if (command.type === "declare-intent") return declareLivingDungeonIntent(run, command.selection);
  if (command.type === "execute-improvisation") return executeLivingDungeonImprovisation(run, command.plan);
  if (command.type === "engage") {
    if (run.phase !== "explore" || !run.encounter) return run;
    return Object.freeze({ ...run, revision: run.revision + 1, phase: "combat", lastAction: "engage" });
  }
  if (command.type === "attack") return combatAction(run, "attack");
  if (command.type === "storm" || command.type === "potion" || command.type === "camp-buy") return executeBreachable(run, command);
  if (command.type === "spare-witness") return spareWitness(run);
  if (command.type === "continue") {
    if (run.phase !== "room-cleared" || run.roomId === "boss") return run;
    return enterStage(run, run.stageIndex + 1);
  }
  if (command.type === "prepare-pact") {
    if (run.phase !== "pact" || run.pact || run.pactOfferAttempts >= 2 || !Number.isSafeInteger(command.offerSeed)) return run;
    const boundRevision = run.revision + 1;
    const result = buildPactOffer(command.intent, livingDungeonEligibility(run, boundRevision), command.offerSeed);
    if (result.status !== "offered") return run;
    return Object.freeze({
      ...run,
      revision: boundRevision,
      pendingOffer: result.offer,
      pactOfferAttempts: run.pactOfferAttempts + 1,
      lastAction: result.countered ? "pact-counteroffer" : "pact-offer",
    });
  }
  if (command.type === "record-pact-interpretation") {
    if (run.phase !== "pact" || run.pact || run.pactInterpretationAttempts >= 2) return run;
    const revision = run.revision + 1;
    const attempt = run.pactInterpretationAttempts + 1;
    const facts = appendDungeonFact(run.facts, createDungeonFact(run.runId, factDraft(run, revision, "PACT_INTERPRETATION_REQUESTED", {
      subjectId: "PACT_ROOM", valueId: `ATTEMPT_${attempt}`, key: `attempt-${attempt}`,
    })));
    return Object.freeze({
      ...run,
      revision,
      pactInterpretationAttempts: attempt,
      // A revision-bound offer cannot survive a new interpretation request.
      // The returned intent may build the one permitted revised offer.
      pendingOffer: null,
      facts,
      lastAction: "pact-interpretation",
    });
  }
  if (command.type === "record-pact-clarification") {
    if (run.phase !== "pact" || run.pact || run.pactClarificationAttempts >= 1
      || run.pactInterpretationAttempts <= run.pactClarificationAttempts) return run;
    const revision = run.revision + 1;
    const facts = appendDungeonFact(run.facts, createDungeonFact(run.runId, factDraft(run, revision, "PACT_CLARIFICATION_REQUESTED", {
      subjectId: "PACT_ROOM", valueId: "ONE_CLARIFICATION", key: "pact-room",
    })));
    return Object.freeze({
      ...run,
      revision,
      pactClarificationAttempts: 1,
      pendingOffer: null,
      facts,
      lastAction: "pact-clarification",
    });
  }
  if (command.type === "accept-pact") {
    if (run.phase !== "pact" || run.pact || !run.pendingOffer || run.pendingOffer.terms.pactId !== command.pactId) return run;
    const pact = acceptPactOffer(run.pendingOffer, run.runId, run.revision, livingDungeonEligibility(run), run.revision + 1);
    if (!pact) return run;
    const facts = appendDungeonFact(run.facts, createDungeonFact(run.runId, factDraft(run, run.revision + 1, "PACT_ACCEPTED", {
      subjectId: pact.terms.pactId, valueId: pact.terms.templateId, key: pact.terms.pactId,
    })));
    const accepted = Object.freeze({ ...run, pact, facts, pendingOffer: null, storyBeatId: "pact-accepted" });
    return enterStage(accepted, run.stageIndex + 1);
  }
  if (command.type === "decline-pact") {
    if (run.phase !== "pact" || run.pact) return run;
    const facts = appendDungeonFact(run.facts, createDungeonFact(run.runId, factDraft(run, run.revision + 1, "PACT_DECLINED", {
      valueId: "DECLINED", key: "pact-room",
    })));
    return enterStage(Object.freeze({ ...run, facts, pendingOffer: null, storyBeatId: "pact-declined" }), run.stageIndex + 1);
  }
  if (command.type === "camp-skip") {
    if (run.phase !== "camp") return run;
    return enterStage(run, run.stageIndex + 1);
  }
  return run;
}

export { bossPreparationClue };
