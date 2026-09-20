import {
  WITNESS_GATE_BOUNDARIES,
  WITNESS_GATE_CATALOGUE_HASH,
  WITNESS_GATE_CATALOGUE_VERSION,
  WITNESS_GATE_ENTITIES,
  WITNESS_GATE_MANOEUVRES,
  WITNESS_GATE_METHODS,
  WITNESS_GATE_PREMISES,
  witnessGateManoeuvresForPremise,
  type WitnessGateManoeuvreDefinition,
} from "./catalogue";
import { fnv1a, stableStringify, witnessGateStateDigest } from "./digest";
import {
  IMPROVISATION_BOUNDARY_IDS,
  IMPROVISATION_METHOD_IDS,
  IMPROVISATION_SCHEMA_VERSION,
  WITNESS_GATE_ENTITY_IDS,
  WITNESS_GATE_PREMISE_IDS,
  WITNESS_GATE_SCENE_ID,
  isCanonicalWitnessGatePlan,
  isImprovisationSemanticSelection,
  isWitnessGateState,
  type CanonicalWitnessGatePlan,
  type ImprovisationBoundaryId,
  type ImprovisationLocale,
  type ImprovisationSemanticSelection,
  type LocalizedText,
  type WitnessGateBelief,
  type WitnessGateCost,
  type WitnessGateEntityId,
  type WitnessGatePlanPreview,
  type WitnessGatePremiseId,
  type WitnessGateResolution,
  type WitnessGateResolutionDescription,
  type WitnessGateState,
} from "./schema";

export type CreateWitnessGateStateInput = Readonly<{
  runId: string;
  revision?: number;
  sceneSeed?: number;
  player?: Readonly<{
    hp?: number;
    maxHp?: number;
    gold?: number;
    potions?: number;
    stormCharges?: number;
    aptitudes?: Partial<Record<(typeof IMPROVISATION_METHOD_IDS)[number], number>>;
  }>;
  alarm?: number;
  visibleEntityIds?: readonly WitnessGateEntityId[];
  resolvedPremiseIds?: readonly WitnessGatePremiseId[];
  beliefs?: readonly WitnessGateBelief[];
}>;

export type WitnessGateCompileErrorCode =
  | "INVALID_STATE"
  | "INVALID_SELECTION"
  | "PREMISE_GOAL_MISMATCH"
  | "UNSUPPORTED_COMBINATION"
  | "ENTITY_NOT_VISIBLE"
  | "PREMISE_ALREADY_RESOLVED"
  | "BOUNDARY_CONFLICT"
  | "INSUFFICIENT_RESOURCES";

export type WitnessGateCompileResult =
  | Readonly<{ status: "compiled"; plan: CanonicalWitnessGatePlan; preview: WitnessGatePlanPreview }>
  | Readonly<{ status: "clarification"; reason: string }>
  | Readonly<{ status: "rejected"; code: WitnessGateCompileErrorCode; reason: string }>;

export type WitnessGatePlanValidationCode =
  | "INVALID_STATE"
  | "INVALID_PLAN"
  | "STALE_STATE"
  | "CATALOGUE_MISMATCH"
  | "NON_CANONICAL_PLAN"
  | "NO_LONGER_AVAILABLE";

export type WitnessGatePlanValidation =
  | Readonly<{ valid: true; manoeuvre: WitnessGateManoeuvreDefinition }>
  | Readonly<{ valid: false; code: WitnessGatePlanValidationCode; reason: string }>;

export type WitnessGateDryRunResult =
  | Readonly<{ status: "ready"; preview: WitnessGatePlanPreview }>
  | Readonly<{ status: "invalid"; code: WitnessGatePlanValidationCode; reason: string }>;

export type WitnessGateResolveResult =
  | Readonly<{ status: "resolved"; resolution: WitnessGateResolution }>
  | Readonly<{ status: "invalid"; code: WitnessGatePlanValidationCode; reason: string }>;

export type WitnessGateSemanticContext = Readonly<{
  sceneId: typeof WITNESS_GATE_SCENE_ID;
  stateDigest: string;
  premiseIds: readonly WitnessGatePremiseId[];
  goalIds: readonly (typeof WITNESS_GATE_PREMISES)[WitnessGatePremiseId]["goalId"][];
  methodIds: readonly (typeof IMPROVISATION_METHOD_IDS)[number][];
  targetIds: readonly string[];
  objectIds: readonly string[];
  boundaryIds: readonly ImprovisationBoundaryId[];
  combinations: readonly Readonly<{
    premiseId: WitnessGatePremiseId;
    goalId: (typeof WITNESS_GATE_PREMISES)[WitnessGatePremiseId]["goalId"];
    methodId: (typeof IMPROVISATION_METHOD_IDS)[number];
    targetId: string;
    objectId: string;
  }>[];
}>;

function text(value: LocalizedText, locale: ImprovisationLocale): string {
  return value[locale];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function immutableState(state: WitnessGateState): WitnessGateState {
  return Object.freeze({
    ...state,
    player: Object.freeze({ ...state.player, aptitudes: Object.freeze({ ...state.player.aptitudes }) }),
    visibleEntityIds: Object.freeze([...state.visibleEntityIds]),
    resolvedPremiseIds: Object.freeze([...state.resolvedPremiseIds]),
    beliefs: Object.freeze(state.beliefs.map((belief) => Object.freeze({ ...belief }))),
  });
}

export function createWitnessGateState(input: CreateWitnessGateStateInput): WitnessGateState {
  const maxHp = input.player?.maxHp ?? 100;
  const state: WitnessGateState = {
    schemaVersion: IMPROVISATION_SCHEMA_VERSION,
    sceneId: WITNESS_GATE_SCENE_ID,
    runId: input.runId,
    revision: input.revision ?? 0,
    sceneSeed: input.sceneSeed ?? 1,
    player: {
      hp: input.player?.hp ?? maxHp,
      maxHp,
      gold: input.player?.gold ?? 12,
      potions: input.player?.potions ?? 2,
      // Living Dungeon has no persistent Storm-charge inventory. Keep the
      // compatibility field at zero; Storm-based manoeuvres pay authored HP.
      stormCharges: input.player?.stormCharges ?? 0,
      aptitudes: {
        CUNNING: input.player?.aptitudes?.CUNNING ?? 1,
        MERCY: input.player?.aptitudes?.MERCY ?? 1,
        FORCE: input.player?.aptitudes?.FORCE ?? 1,
        RISK: input.player?.aptitudes?.RISK ?? 1,
      },
    },
    alarm: input.alarm ?? 0,
    visibleEntityIds: input.visibleEntityIds ?? WITNESS_GATE_ENTITY_IDS,
    resolvedPremiseIds: input.resolvedPremiseIds ?? [],
    beliefs: input.beliefs ?? [],
  };
  if (!isWitnessGateState(state)) throw new TypeError("Invalid Witness Gate state.");
  return immutableState(state);
}

function boundaryConflict(boundaryId: ImprovisationBoundaryId, manoeuvre: WitnessGateManoeuvreDefinition): string | null {
  if (boundaryId === "NO_KILLING" && manoeuvre.isLethal) return "The manoeuvre is lethal.";
  if (boundaryId === "NO_STORM" && manoeuvre.beliefSignalId === "GAMBLES_WITH_STORM") return "The manoeuvre uses Storm.";
  if (boundaryId === "NO_GOLD" && manoeuvre.cost.gold > 0) return "The manoeuvre spends gold.";
  if (boundaryId === "NO_LYING" && manoeuvre.usesDeception) return "The manoeuvre relies on deception.";
  return null;
}

function availabilityReason(state: WitnessGateState, manoeuvre: WitnessGateManoeuvreDefinition): string | null {
  if (state.resolvedPremiseIds.includes(manoeuvre.premiseId)) return "That premise has already been resolved.";
  if (!state.visibleEntityIds.includes(manoeuvre.targetId)
    || !state.visibleEntityIds.includes(manoeuvre.objectId)
    || !state.visibleEntityIds.includes(manoeuvre.observerId)) {
    return "The manoeuvre uses something that is not visible in the scene.";
  }
  const { cost } = manoeuvre;
  if (cost.stormCharges !== 0) return "Storm charges are not a Living Dungeon resource.";
  if (state.player.gold < cost.gold) return `The plan requires ${cost.gold} gold.`;
  if (state.player.potions < cost.potions) return `The plan requires ${cost.potions} potion.`;
  if (state.player.hp <= cost.hp) return `The plan requires ${cost.hp} HP and cannot spend the final hit point.`;
  return null;
}

function successChance(state: WitnessGateState, manoeuvre: WitnessGateManoeuvreDefinition): number {
  return clamp(
    manoeuvre.baseSuccessChance + state.player.aptitudes[manoeuvre.methodId] * 6 - state.alarm * 8,
    25,
    95,
  );
}

function makePlan(
  selection: ImprovisationSemanticSelection,
  manoeuvre: WitnessGateManoeuvreDefinition,
  state: WitnessGateState,
): CanonicalWitnessGatePlan {
  const digest = witnessGateStateDigest(state);
  const identity = [
    WITNESS_GATE_CATALOGUE_HASH,
    state.runId,
    state.revision,
    digest,
    manoeuvre.id,
    selection.boundaryId,
  ].join("|");
  return Object.freeze({
    schemaVersion: IMPROVISATION_SCHEMA_VERSION,
    planId: `wgplan-${fnv1a(identity)}`,
    catalogueVersion: WITNESS_GATE_CATALOGUE_VERSION,
    catalogueHash: WITNESS_GATE_CATALOGUE_HASH,
    sceneId: WITNESS_GATE_SCENE_ID,
    premiseId: manoeuvre.premiseId,
    goalId: manoeuvre.goalId,
    manoeuvreId: manoeuvre.id,
    methodId: manoeuvre.methodId,
    targetId: manoeuvre.targetId,
    objectId: manoeuvre.objectId,
    boundaryId: selection.boundaryId,
    boundRunId: state.runId,
    boundRevision: state.revision,
    stateDigest: digest,
  });
}

function costSummary(cost: WitnessGateCost, locale: ImprovisationLocale): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(locale === "no" ? `${cost.gold} gull` : `${cost.gold} gold`);
  if (cost.potions) parts.push(locale === "no" ? `${cost.potions} helsedrikk` : `${cost.potions} potion`);
  if (cost.hp) parts.push(`${cost.hp} HP`);
  if (cost.stormCharges) parts.push(locale === "no" ? `${cost.stormCharges} Storm-ladning` : `${cost.stormCharges} Storm charge`);
  if (parts.length === 0) return locale === "no" ? "Ingen ressurskostnad." : "No resource cost.";
  return `${locale === "no" ? "Betal" : "Pay"}: ${parts.join(" · ")}.`;
}

function riskSummary(
  chance: number,
  manoeuvre: WitnessGateManoeuvreDefinition,
  locale: ImprovisationLocale,
): string {
  if (locale === "no") {
    const damage = manoeuvre.setbackHp ? ` og ${manoeuvre.setbackHp} HP i tilbakeslag` : "";
    return `${chance} % sjanse. Feil gir +${manoeuvre.alarmOnSetback} alarm${damage}.`;
  }
  const damage = manoeuvre.setbackHp ? ` and ${manoeuvre.setbackHp} setback damage` : "";
  return `${chance}% chance. Failure adds ${manoeuvre.alarmOnSetback} alarm${damage}.`;
}

function buildPreview(
  plan: CanonicalWitnessGatePlan,
  state: WitnessGateState,
  manoeuvre: WitnessGateManoeuvreDefinition,
  locale: ImprovisationLocale,
): WitnessGatePlanPreview {
  const premise = WITNESS_GATE_PREMISES[manoeuvre.premiseId];
  const method = WITNESS_GATE_METHODS[manoeuvre.methodId];
  const boundary = WITNESS_GATE_BOUNDARIES[plan.boundaryId];
  const chance = successChance(state, manoeuvre);
  return Object.freeze({
    planId: plan.planId,
    title: text(manoeuvre.title, locale),
    premise: Object.freeze({ id: premise.id, label: text(premise.title, locale) }),
    method: Object.freeze({ id: method.id, label: text(method.label, locale) }),
    boundary: Object.freeze({ id: boundary.id, label: text(boundary.label, locale) }),
    target: Object.freeze({ id: manoeuvre.targetId, label: text(WITNESS_GATE_ENTITIES[manoeuvre.targetId].label, locale) }),
    object: Object.freeze({ id: manoeuvre.objectId, label: text(WITNESS_GATE_ENTITIES[manoeuvre.objectId].label, locale) }),
    steps: Object.freeze(manoeuvre.steps.map((step, index) => Object.freeze({
      stepId: `${manoeuvre.id}:STEP_${index + 1}`,
      label: text(step, locale),
    }))),
    cost: Object.freeze({ ...manoeuvre.cost, summary: costSummary(manoeuvre.cost, locale) }),
    risk: Object.freeze({
      level: manoeuvre.riskLevel,
      successChancePercent: chance,
      setbackHp: manoeuvre.setbackHp,
      alarmOnSetback: manoeuvre.alarmOnSetback,
      summary: riskSummary(chance, manoeuvre, locale),
    }),
    observer: Object.freeze({ entityId: manoeuvre.observerId, label: text(WITNESS_GATE_ENTITIES[manoeuvre.observerId].label, locale) }),
    beliefSignal: Object.freeze({ id: manoeuvre.beliefSignalId, label: text(method.beliefLabel, locale) }),
    resultOnSuccess: Object.freeze({ effectId: manoeuvre.successEffectId, label: text(premise.successLabel, locale) }),
    trustStatement: locale === "no"
      ? "Dette er den nøyaktige planen spillmotoren vil kjøre. Modellen kan ikke endre kostnad, odds eller effekt."
      : "This is the exact plan the game engine will execute. The model cannot change its cost, odds or effect.",
  });
}

export function witnessGateSemanticContext(
  state: WitnessGateState,
  boundaryId: ImprovisationBoundaryId = "NONE",
): WitnessGateSemanticContext {
  if (!isWitnessGateState(state)) throw new TypeError("Invalid Witness Gate state.");
  const availablePremises = WITNESS_GATE_PREMISE_IDS.filter((id) => !state.resolvedPremiseIds.includes(id));
  const candidates = availablePremises
    .flatMap(witnessGateManoeuvresForPremise)
    .filter((manoeuvre) => !boundaryConflict(boundaryId, manoeuvre))
    .filter((manoeuvre) => availabilityReason(state, manoeuvre) === null);
  return Object.freeze({
    sceneId: WITNESS_GATE_SCENE_ID,
    stateDigest: witnessGateStateDigest(state),
    premiseIds: Object.freeze([...new Set(candidates.map((entry) => entry.premiseId))]),
    goalIds: Object.freeze([...new Set(candidates.map((entry) => entry.goalId))]),
    methodIds: Object.freeze([...new Set(candidates.map((entry) => entry.methodId))]),
    targetIds: Object.freeze([...new Set(candidates.map((entry) => entry.targetId))]),
    objectIds: Object.freeze([...new Set(candidates.map((entry) => entry.objectId))]),
    boundaryIds: IMPROVISATION_BOUNDARY_IDS,
    combinations: Object.freeze(candidates.map((entry) => Object.freeze({
      premiseId: entry.premiseId,
      goalId: entry.goalId,
      methodId: entry.methodId,
      targetId: entry.targetId,
      objectId: entry.objectId,
    }))),
  });
}

export function compileWitnessGatePlan(
  selection: unknown,
  state: unknown,
  locale: ImprovisationLocale = "en",
): WitnessGateCompileResult {
  if (!isWitnessGateState(state)) return { status: "rejected", code: "INVALID_STATE", reason: "The scene state is invalid." };
  if (!isImprovisationSemanticSelection(selection)) {
    return { status: "rejected", code: "INVALID_SELECTION", reason: "The interpretation contains unsupported values or fields." };
  }
  if (selection.needsClarification) {
    return {
      status: "clarification",
      reason: locale === "no"
        ? "Forslaget trenger ett tydeligere mål eller én tydeligere metode før det kan bli en regel."
        : "The proposal needs one clearer goal or method before it can become a rule.",
    };
  }
  const premise = WITNESS_GATE_PREMISES[selection.premiseId];
  if (premise.goalId !== selection.goalId) {
    return { status: "rejected", code: "PREMISE_GOAL_MISMATCH", reason: "The selected goal does not belong to that premise." };
  }
  const manoeuvre = witnessGateManoeuvresForPremise(selection.premiseId).find((entry) => (
    entry.goalId === selection.goalId
    && entry.methodId === selection.methodId
    && entry.targetId === selection.targetId
    && entry.objectId === selection.objectId
  ));
  if (!manoeuvre) {
    return { status: "rejected", code: "UNSUPPORTED_COMBINATION", reason: "That combination is not a supported action in this room." };
  }
  if (!state.visibleEntityIds.includes(manoeuvre.targetId)
    || !state.visibleEntityIds.includes(manoeuvre.objectId)
    || !state.visibleEntityIds.includes(manoeuvre.observerId)) {
    return { status: "rejected", code: "ENTITY_NOT_VISIBLE", reason: "The plan uses something that is not visible in the scene." };
  }
  if (state.resolvedPremiseIds.includes(manoeuvre.premiseId)) {
    return { status: "rejected", code: "PREMISE_ALREADY_RESOLVED", reason: "That premise has already been resolved." };
  }
  const conflict = boundaryConflict(selection.boundaryId, manoeuvre);
  if (conflict) return { status: "rejected", code: "BOUNDARY_CONFLICT", reason: conflict };
  const unavailable = availabilityReason(state, manoeuvre);
  if (unavailable) return { status: "rejected", code: "INSUFFICIENT_RESOURCES", reason: unavailable };
  const plan = makePlan(selection, manoeuvre, state);
  return { status: "compiled", plan, preview: buildPreview(plan, state, manoeuvre, locale) };
}

export function validateCanonicalWitnessGatePlan(plan: unknown, state: unknown): WitnessGatePlanValidation {
  if (!isWitnessGateState(state)) return { valid: false, code: "INVALID_STATE", reason: "The scene state is invalid." };
  if (!isCanonicalWitnessGatePlan(plan)) return { valid: false, code: "INVALID_PLAN", reason: "The plan shape is invalid." };
  if (plan.boundRunId !== state.runId
    || plan.boundRevision !== state.revision
    || plan.stateDigest !== witnessGateStateDigest(state)) {
    return { valid: false, code: "STALE_STATE", reason: "The plan was compiled for a different scene state." };
  }
  if (plan.catalogueVersion !== WITNESS_GATE_CATALOGUE_VERSION || plan.catalogueHash !== WITNESS_GATE_CATALOGUE_HASH) {
    return { valid: false, code: "CATALOGUE_MISMATCH", reason: "The plan belongs to a different rules catalogue." };
  }
  const manoeuvre = WITNESS_GATE_MANOEUVRES[plan.manoeuvreId];
  const selection: ImprovisationSemanticSelection = {
    premiseId: plan.premiseId,
    goalId: plan.goalId,
    methodId: plan.methodId,
    targetId: plan.targetId,
    objectId: plan.objectId,
    boundaryId: plan.boundaryId,
    needsClarification: false,
  };
  const expected = makePlan(selection, manoeuvre, state);
  if (stableStringify(plan) !== stableStringify(expected)) {
    return { valid: false, code: "NON_CANONICAL_PLAN", reason: "The plan does not match an engine-authored manoeuvre." };
  }
  const conflict = boundaryConflict(plan.boundaryId, manoeuvre);
  const unavailable = availabilityReason(state, manoeuvre);
  if (conflict || unavailable) {
    return { valid: false, code: "NO_LONGER_AVAILABLE", reason: conflict ?? unavailable ?? "The plan is no longer available." };
  }
  return { valid: true, manoeuvre };
}

export function dryRunWitnessGatePlan(
  plan: unknown,
  state: unknown,
  locale: ImprovisationLocale = "en",
): WitnessGateDryRunResult {
  const validation = validateCanonicalWitnessGatePlan(plan, state);
  if (!validation.valid) return { status: "invalid", code: validation.code, reason: validation.reason };
  return { status: "ready", preview: buildPreview(plan as CanonicalWitnessGatePlan, state as WitnessGateState, validation.manoeuvre, locale) };
}

function mergeBelief(
  beliefs: readonly WitnessGateBelief[],
  observed: WitnessGateBelief,
): readonly WitnessGateBelief[] {
  const existing = beliefs.find((belief) => belief.observerId === observed.observerId && belief.signalId === observed.signalId);
  if (!existing) return [...beliefs, observed];
  return beliefs.map((belief) => belief === existing
    ? { ...belief, strength: Math.max(belief.strength, observed.strength) as 1 | 2 | 3 }
    : belief);
}

function resolutionDescription(
  outcome: "SUCCESS" | "SETBACK",
  manoeuvre: WitnessGateManoeuvreDefinition,
  locale: ImprovisationLocale,
  effectLabel: string,
): WitnessGateResolutionDescription {
  const method = WITNESS_GATE_METHODS[manoeuvre.methodId];
  if (outcome === "SUCCESS") {
    return Object.freeze({
      headline: locale === "no" ? "Planen lykkes" : "The plan succeeds",
      narration: text(manoeuvre.successNarration, locale),
      consequence: effectLabel,
      observerNote: text(method.beliefLabel, locale),
    });
  }
  return Object.freeze({
    headline: locale === "no" ? "Planen møter motstand" : "The plan meets resistance",
    narration: text(manoeuvre.setbackNarration, locale),
    consequence: locale === "no"
      ? `Målet er ikke nådd. Vokterens alarm øker med ${manoeuvre.alarmOnSetback}.`
      : `The goal is not completed. Warden alarm rises by ${manoeuvre.alarmOnSetback}.`,
    observerNote: text(method.beliefLabel, locale),
  });
}

export function resolveWitnessGatePlan(
  plan: unknown,
  state: unknown,
  locale: ImprovisationLocale = "en",
): WitnessGateResolveResult {
  const validation = validateCanonicalWitnessGatePlan(plan, state);
  if (!validation.valid) return { status: "invalid", code: validation.code, reason: validation.reason };
  const canonicalPlan = plan as CanonicalWitnessGatePlan;
  const current = state as WitnessGateState;
  const manoeuvre = validation.manoeuvre;
  const chance = successChance(current, manoeuvre);
  const roll = (Number.parseInt(fnv1a([
    current.sceneSeed,
    current.runId,
    current.revision,
    canonicalPlan.planId,
    canonicalPlan.stateDigest,
    "resolve",
  ].join("|")), 16) % 100) + 1;
  const outcome = roll <= chance ? "SUCCESS" : "SETBACK";
  const setbackDamage = outcome === "SETBACK" ? manoeuvre.setbackHp : 0;
  const observedBelief: WitnessGateBelief = Object.freeze({
    observerId: manoeuvre.observerId,
    signalId: manoeuvre.beliefSignalId,
    strength: outcome === "SUCCESS" ? 2 : 3,
  });
  const nextState = immutableState({
    ...current,
    revision: current.revision + 1,
    player: {
      ...current.player,
      hp: Math.max(0, current.player.hp - manoeuvre.cost.hp - setbackDamage),
      gold: current.player.gold - manoeuvre.cost.gold,
      potions: current.player.potions - manoeuvre.cost.potions,
      stormCharges: current.player.stormCharges - manoeuvre.cost.stormCharges,
    },
    alarm: clamp(current.alarm + (outcome === "SUCCESS" ? manoeuvre.alarmOnSuccess : manoeuvre.alarmOnSetback), 0, 3),
    resolvedPremiseIds: outcome === "SUCCESS"
      ? [...current.resolvedPremiseIds, manoeuvre.premiseId]
      : current.resolvedPremiseIds,
    beliefs: mergeBelief(current.beliefs, observedBelief),
  });
  const premise = WITNESS_GATE_PREMISES[manoeuvre.premiseId];
  const effectId = outcome === "SUCCESS" ? manoeuvre.successEffectId : "WARDEN_ALERTED";
  const resolutionId = `wgresolution-${fnv1a([
    canonicalPlan.planId,
    canonicalPlan.stateDigest,
    roll,
    outcome,
    effectId,
  ].join("|"))}`;
  const resolution: WitnessGateResolution = Object.freeze({
    resolutionId,
    planId: canonicalPlan.planId,
    stateDigest: canonicalPlan.stateDigest,
    outcome,
    roll,
    threshold: chance,
    costPaid: Object.freeze({ ...manoeuvre.cost }),
    setbackDamage,
    effectId,
    observedBelief,
    nextState,
    description: resolutionDescription(outcome, manoeuvre, locale, text(premise.successLabel, locale)),
  });
  return { status: "resolved", resolution };
}
