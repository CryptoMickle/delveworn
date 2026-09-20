export const IMPROVISATION_SCHEMA_VERSION = 1 as const;
export const WITNESS_GATE_SCENE_ID = "WITNESS_GATE_V1" as const;

export const IMPROVISATION_GOAL_IDS = ["RESCUE", "ACQUIRE", "DISCOVER"] as const;
export const IMPROVISATION_METHOD_IDS = ["CUNNING", "MERCY", "FORCE", "RISK"] as const;
export const IMPROVISATION_BOUNDARY_IDS = [
  "NO_KILLING",
  "NO_STORM",
  "NO_GOLD",
  "NO_LYING",
  "NONE",
] as const;

export const WITNESS_GATE_PREMISE_IDS = [
  "WITNESS_GATE_RESCUE_CARTOGRAPHER",
  "WITNESS_GATE_CLAIM_SIGIL",
  "WITNESS_GATE_READ_MEMORY",
] as const;

export const WITNESS_GATE_TARGET_IDS = [
  "CHAINED_CARTOGRAPHER",
  "MASKED_WARDEN",
  "OATH_GATE",
] as const;

export const WITNESS_GATE_OBJECT_IDS = [
  "BRASS_BELL",
  "CHAIN_WINCH",
  "HEALING_DRAUGHT",
  "WARDEN_SIGIL",
  "ECHO_BRAZIER",
  "MEMORY_RUNES",
] as const;

export const WITNESS_GATE_ENTITY_IDS = [
  ...WITNESS_GATE_TARGET_IDS,
  ...WITNESS_GATE_OBJECT_IDS,
] as const;

export const WITNESS_GATE_MANOEUVRE_IDS = [
  "RESCUE_BELL_FEINT",
  "RESCUE_HEALING_BARGAIN",
  "RESCUE_BREAK_WINCH",
  "RESCUE_STORM_RELAY",
  "ACQUIRE_BELL_SWITCH",
  "ACQUIRE_DRAUGHT_TRADE",
  "ACQUIRE_WREST_SIGIL",
  "ACQUIRE_OVERCHARGE_SIGIL",
  "DISCOVER_RUNE_PARALLAX",
  "DISCOVER_SHARE_DRAUGHT",
  "DISCOVER_STRESS_GATE",
  "DISCOVER_STORM_ECHO",
] as const;

export const WITNESS_GATE_BELIEF_SIGNAL_IDS = [
  "FAVORS_MISDIRECTION",
  "PAYS_TO_PROTECT",
  "BREAKS_OBSTACLES",
  "GAMBLES_WITH_STORM",
] as const;

export const WITNESS_GATE_EFFECT_IDS = [
  "CARTOGRAPHER_FREED",
  "SIGIL_CLAIMED",
  "GATE_MEMORY_REVEALED",
  "WARDEN_ALERTED",
] as const;

export type ImprovisationLocale = "en" | "no";
export type LocalizedText = Readonly<Record<ImprovisationLocale, string>>;
export type ImprovisationGoalId = (typeof IMPROVISATION_GOAL_IDS)[number];
export type ImprovisationMethodId = (typeof IMPROVISATION_METHOD_IDS)[number];
export type ImprovisationBoundaryId = (typeof IMPROVISATION_BOUNDARY_IDS)[number];
export type WitnessGatePremiseId = (typeof WITNESS_GATE_PREMISE_IDS)[number];
export type WitnessGateTargetId = (typeof WITNESS_GATE_TARGET_IDS)[number];
export type WitnessGateObjectId = (typeof WITNESS_GATE_OBJECT_IDS)[number];
export type WitnessGateEntityId = (typeof WITNESS_GATE_ENTITY_IDS)[number];
export type WitnessGateManoeuvreId = (typeof WITNESS_GATE_MANOEUVRE_IDS)[number];
export type WitnessGateBeliefSignalId = (typeof WITNESS_GATE_BELIEF_SIGNAL_IDS)[number];
export type WitnessGateEffectId = (typeof WITNESS_GATE_EFFECT_IDS)[number];
export type WitnessGateRiskLevel = "LOW" | "MODERATE" | "HIGH";

/**
 * The complete shape an untrusted interpreter may return. Every semantic field is
 * a bounded identifier. Numbers, costs, odds, effects and prose are engine-owned.
 */
export type ImprovisationSemanticSelection = Readonly<{
  premiseId: WitnessGatePremiseId;
  goalId: ImprovisationGoalId;
  methodId: ImprovisationMethodId;
  targetId: WitnessGateTargetId;
  objectId: WitnessGateObjectId;
  boundaryId: ImprovisationBoundaryId;
  needsClarification: boolean;
}>;

export type WitnessGateAptitudes = Readonly<Record<ImprovisationMethodId, number>>;

export type WitnessGateBelief = Readonly<{
  observerId: "MASKED_WARDEN";
  signalId: WitnessGateBeliefSignalId;
  strength: 1 | 2 | 3;
}>;

export type WitnessGatePlayerState = Readonly<{
  hp: number;
  maxHp: number;
  gold: number;
  potions: number;
  stormCharges: number;
  aptitudes: WitnessGateAptitudes;
}>;

export type WitnessGateState = Readonly<{
  schemaVersion: typeof IMPROVISATION_SCHEMA_VERSION;
  sceneId: typeof WITNESS_GATE_SCENE_ID;
  runId: string;
  revision: number;
  sceneSeed: number;
  player: WitnessGatePlayerState;
  alarm: number;
  visibleEntityIds: readonly WitnessGateEntityId[];
  resolvedPremiseIds: readonly WitnessGatePremiseId[];
  beliefs: readonly WitnessGateBelief[];
}>;

export type WitnessGateCost = Readonly<{
  gold: number;
  potions: number;
  hp: number;
  stormCharges: number;
}>;

export type CanonicalWitnessGatePlan = Readonly<{
  schemaVersion: typeof IMPROVISATION_SCHEMA_VERSION;
  planId: string;
  catalogueVersion: string;
  catalogueHash: string;
  sceneId: typeof WITNESS_GATE_SCENE_ID;
  premiseId: WitnessGatePremiseId;
  goalId: ImprovisationGoalId;
  manoeuvreId: WitnessGateManoeuvreId;
  methodId: ImprovisationMethodId;
  targetId: WitnessGateTargetId;
  objectId: WitnessGateObjectId;
  boundaryId: ImprovisationBoundaryId;
  boundRunId: string;
  boundRevision: number;
  stateDigest: string;
}>;

export type WitnessGatePreviewStep = Readonly<{
  stepId: string;
  label: string;
}>;

export type WitnessGatePlanPreview = Readonly<{
  planId: string;
  title: string;
  premise: Readonly<{ id: WitnessGatePremiseId; label: string }>;
  method: Readonly<{ id: ImprovisationMethodId; label: string }>;
  boundary: Readonly<{ id: ImprovisationBoundaryId; label: string }>;
  target: Readonly<{ id: WitnessGateTargetId; label: string }>;
  object: Readonly<{ id: WitnessGateObjectId; label: string }>;
  steps: readonly WitnessGatePreviewStep[];
  cost: WitnessGateCost & Readonly<{ summary: string }>;
  risk: Readonly<{
    level: WitnessGateRiskLevel;
    successChancePercent: number;
    setbackHp: number;
    alarmOnSetback: number;
    summary: string;
  }>;
  observer: Readonly<{ entityId: "MASKED_WARDEN"; label: string }>;
  beliefSignal: Readonly<{ id: WitnessGateBeliefSignalId; label: string }>;
  resultOnSuccess: Readonly<{ effectId: Exclude<WitnessGateEffectId, "WARDEN_ALERTED">; label: string }>;
  trustStatement: string;
}>;

export type WitnessGateResolutionDescription = Readonly<{
  headline: string;
  narration: string;
  consequence: string;
  observerNote: string;
}>;

export type WitnessGateResolution = Readonly<{
  resolutionId: string;
  planId: string;
  stateDigest: string;
  outcome: "SUCCESS" | "SETBACK";
  roll: number;
  threshold: number;
  costPaid: WitnessGateCost;
  setbackDamage: number;
  effectId: WitnessGateEffectId;
  observedBelief: WitnessGateBelief;
  nextState: WitnessGateState;
  description: WitnessGateResolutionDescription;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function member<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function boundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function uniqueMembers<T extends readonly string[]>(values: T, input: unknown): input is readonly T[number][] {
  return Array.isArray(input)
    && input.every((entry) => member(values, entry))
    && new Set(input).size === input.length;
}

export function isImprovisationSemanticSelection(value: unknown): value is ImprovisationSemanticSelection {
  if (!isRecord(value) || !exactKeys(value, [
    "premiseId", "goalId", "methodId", "targetId", "objectId", "boundaryId", "needsClarification",
  ])) return false;
  return member(WITNESS_GATE_PREMISE_IDS, value.premiseId)
    && member(IMPROVISATION_GOAL_IDS, value.goalId)
    && member(IMPROVISATION_METHOD_IDS, value.methodId)
    && member(WITNESS_GATE_TARGET_IDS, value.targetId)
    && member(WITNESS_GATE_OBJECT_IDS, value.objectId)
    && member(IMPROVISATION_BOUNDARY_IDS, value.boundaryId)
    && typeof value.needsClarification === "boolean";
}

function isAptitudes(value: unknown): value is WitnessGateAptitudes {
  if (!isRecord(value) || !exactKeys(value, IMPROVISATION_METHOD_IDS)) return false;
  return IMPROVISATION_METHOD_IDS.every((id) => boundedInteger(value[id], 0, 3));
}

function isBelief(value: unknown): value is WitnessGateBelief {
  if (!isRecord(value) || !exactKeys(value, ["observerId", "signalId", "strength"])) return false;
  return value.observerId === "MASKED_WARDEN"
    && member(WITNESS_GATE_BELIEF_SIGNAL_IDS, value.signalId)
    && boundedInteger(value.strength, 1, 3);
}

export function isWitnessGateState(value: unknown): value is WitnessGateState {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion", "sceneId", "runId", "revision", "sceneSeed", "player", "alarm",
    "visibleEntityIds", "resolvedPremiseIds", "beliefs",
  ])) return false;
  if (!isRecord(value.player) || !exactKeys(value.player, [
    "hp", "maxHp", "gold", "potions", "stormCharges", "aptitudes",
  ])) return false;
  const player = value.player;
  if (value.schemaVersion !== IMPROVISATION_SCHEMA_VERSION
    || value.sceneId !== WITNESS_GATE_SCENE_ID
    || typeof value.runId !== "string"
    || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.runId)
    || !boundedInteger(value.revision, 0, 1_000_000)
    || !boundedInteger(value.sceneSeed, 0, 0xffffffff)
    || !boundedInteger(value.alarm, 0, 3)
    || !boundedInteger(player.maxHp, 1, 999)
    || !boundedInteger(player.hp, 0, Number(player.maxHp))
    || !boundedInteger(player.gold, 0, 999_999)
    || !boundedInteger(player.potions, 0, 99)
    || !boundedInteger(player.stormCharges, 0, 9)
    || !isAptitudes(player.aptitudes)
    || !uniqueMembers(WITNESS_GATE_ENTITY_IDS, value.visibleEntityIds)
    || !uniqueMembers(WITNESS_GATE_PREMISE_IDS, value.resolvedPremiseIds)
    || !Array.isArray(value.beliefs)
    || !value.beliefs.every(isBelief)) return false;
  const beliefKeys = value.beliefs.map((belief) => `${belief.observerId}:${belief.signalId}`);
  return new Set(beliefKeys).size === beliefKeys.length;
}

export function isCanonicalWitnessGatePlan(value: unknown): value is CanonicalWitnessGatePlan {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion", "planId", "catalogueVersion", "catalogueHash", "sceneId", "premiseId",
    "goalId", "manoeuvreId", "methodId", "targetId", "objectId", "boundaryId", "boundRunId",
    "boundRevision", "stateDigest",
  ])) return false;
  return value.schemaVersion === IMPROVISATION_SCHEMA_VERSION
    && typeof value.planId === "string" && /^wgplan-[a-f0-9]{8}$/.test(value.planId)
    && typeof value.catalogueVersion === "string" && value.catalogueVersion.length <= 80
    && typeof value.catalogueHash === "string" && /^wgcatalogue-[a-f0-9]{8}$/.test(value.catalogueHash)
    && value.sceneId === WITNESS_GATE_SCENE_ID
    && member(WITNESS_GATE_PREMISE_IDS, value.premiseId)
    && member(IMPROVISATION_GOAL_IDS, value.goalId)
    && member(WITNESS_GATE_MANOEUVRE_IDS, value.manoeuvreId)
    && member(IMPROVISATION_METHOD_IDS, value.methodId)
    && member(WITNESS_GATE_TARGET_IDS, value.targetId)
    && member(WITNESS_GATE_OBJECT_IDS, value.objectId)
    && member(IMPROVISATION_BOUNDARY_IDS, value.boundaryId)
    && typeof value.boundRunId === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value.boundRunId)
    && boundedInteger(value.boundRevision, 0, 1_000_000)
    && typeof value.stateDigest === "string" && /^wgstate-[a-f0-9]{8}$/.test(value.stateDigest);
}

