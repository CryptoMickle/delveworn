"use client";

import { track } from "@vercel/analytics/react";
import type { InterpretFallbackReason } from "./ai-contract";
import type { BossPreparationId } from "./beliefs";
import type { LivingDungeonRoomId, LivingDungeonVariant } from "./model";
import type { PactBoonId, PactRestrictionId } from "./pact-schema";
import {
  IMPROVISATION_BOUNDARY_IDS,
  IMPROVISATION_GOAL_IDS,
  IMPROVISATION_METHOD_IDS,
  WITNESS_GATE_BELIEF_SIGNAL_IDS,
  WITNESS_GATE_MANOEUVRE_IDS,
  WITNESS_GATE_PREMISE_IDS,
  type ImprovisationBoundaryId,
  type ImprovisationGoalId,
  type ImprovisationMethodId,
  type WitnessGateBeliefSignalId,
  type WitnessGateManoeuvreId,
  type WitnessGatePremiseId,
} from "./improvisation/schema";

export const LIVING_DUNGEON_ANALYTICS_VERSION = "intent-to-world-v1" as const;

export type LivingDungeonSuggestionId = "protection" | "damage" | "potions";
export type LivingDungeonInputMethod = "free_text" | "suggestion" | "ready_made" | "custom_menu";
export type LivingDungeonInterpretationSource = "ai" | "menu" | "fallback";
export type LivingDungeonLatencyBucket = "under_1s" | "1_to_2_5s" | "2_5_to_4s" | "over_4s";
export type LivingDungeonPactOutcome = "kept" | "broken" | "declined" | "none";
export type LivingDungeonImprovisationSource = "ai" | "authored_fallback";
export type LivingDungeonManeuverCompileResult = "compiled" | "clarification" | "rejected";
export type LivingDungeonManeuverOutcome = "SUCCESS" | "SETBACK";

/**
 * The complete analytics contract for the Living Dungeon.
 *
 * It intentionally has no open string properties. In particular, prompts,
 * generated dialogue, wallet details, save data, IP addresses and run IDs do
 * not have a place in this contract.
 */
export type LivingDungeonAnalyticsProperties = Readonly<{
  living_run_started: Readonly<{
    entry_point: "home" | "direct" | "resume";
    variant: LivingDungeonVariant;
    returning: boolean;
  }>;
  conversation_opened: Readonly<{
    room: LivingDungeonRoomId;
    opened_by: "automatic" | "player";
  }>;
  suggestion_used: Readonly<{
    room: "pact-room";
    suggestion_id: LivingDungeonSuggestionId;
  }>;
  interpretation_returned: Readonly<{
    source: LivingDungeonInterpretationSource;
    input_method: LivingDungeonInputMethod;
    result: "offer" | "clarification" | "fallback";
    attempt: 1 | 2;
    latency: LivingDungeonLatencyBucket;
  }>;
  clarification_requested: Readonly<{
    reason: "missing_boon" | "missing_sacrifice" | "ambiguous" | "unsupported" | "contradictory";
    attempt: 1;
  }>;
  rule_accepted: Readonly<{
    input_method: LivingDungeonInputMethod;
    boon_id: PactBoonId;
    restriction_id: PactRestrictionId;
  }>;
  rule_revised: Readonly<{
    input_method: LivingDungeonInputMethod;
    revision_number: 1;
  }>;
  rule_rejected: Readonly<{
    input_method: LivingDungeonInputMethod;
    reason: "player_choice" | "unavailable" | "invalid" | "stale";
  }>;
  fallback_used: Readonly<{
    reason: InterpretFallbackReason;
    destination: "ready_made" | "retry";
  }>;
  promise_kept: Readonly<{
    restriction_id: PactRestrictionId;
  }>;
  promise_broken: Readonly<{
    restriction_id: PactRestrictionId;
    action: "storm" | "potion" | "camp_purchase";
  }>;
  boss_clue_seen: Readonly<{
    preparation_id: BossPreparationId;
    source: "witness" | "no_witness";
  }>;
  world_shaped: Readonly<{
    objective: ImprovisationGoalId;
    method: ImprovisationMethodId;
    boundary: ImprovisationBoundaryId;
    source: LivingDungeonImprovisationSource;
  }>;
  maneuver_compiled: Readonly<{
    premise_id: WitnessGatePremiseId;
    method_id: ImprovisationMethodId;
    source: LivingDungeonImprovisationSource;
    result: LivingDungeonManeuverCompileResult;
  }>;
  maneuver_committed: Readonly<{
    manoeuvre_id: WitnessGateManoeuvreId;
  }>;
  maneuver_resolved: Readonly<{
    manoeuvre_id: WitnessGateManoeuvreId;
    outcome: LivingDungeonManeuverOutcome;
    belief_signal_id: WitnessGateBeliefSignalId;
  }>;
  living_run_completed: Readonly<{
    outcome: "victory" | "defeat";
    pact_outcome: LivingDungeonPactOutcome;
    variant: LivingDungeonVariant;
    used_ai_interpretation: boolean;
  }>;
  living_run_abandoned: Readonly<{
    room: LivingDungeonRoomId;
    pact_outcome: LivingDungeonPactOutcome;
  }>;
  living_retry_started: Readonly<{
    previous_outcome: "victory" | "defeat" | "abandoned";
  }>;
}>;

export type LivingDungeonAnalyticsEvent = keyof LivingDungeonAnalyticsProperties;
export type LivingDungeonAnalyticsValue = string | number | boolean | null;
export type LivingDungeonAnalyticsPayload = Readonly<Record<string, LivingDungeonAnalyticsValue>>;

export type LivingDungeonAnalyticsSender = (
  event: string,
  properties: Record<string, LivingDungeonAnalyticsValue>,
) => void | Promise<void>;

const ROOM_IDS = ["warmup", "pact-room", "pressure", "witness", "camp", "boss"] as const;
const VARIANTS = ["menu", "ai"] as const;
const SUGGESTIONS = ["protection", "damage", "potions"] as const;
const INPUT_METHODS = ["free_text", "suggestion", "ready_made", "custom_menu"] as const;
const BOON_IDS = ["BOSS_OPENING_WARD", "BOSS_OPENING_FURY", "BOSS_ENTRY_RESTORE"] as const;
const RESTRICTION_IDS = ["NO_STORM", "NO_VOLUNTARY_HEALING", "NO_CAMP_PURCHASE"] as const;
const PREPARATION_IDS = ["NONE", "ANTI_STORM_WARD", "PHYSICAL_BULWARK", "HEALING_PRESSURE"] as const;
const FALLBACK_REASONS = [
  "disabled",
  "not_configured",
  "timed_out",
  "rate_limited",
  "provider_unavailable",
  "invalid_provider_response",
] as const;

function member<T extends readonly string[]>(allowed: T, value: unknown): value is T[number] {
  return typeof value === "string" && allowed.includes(value as T[number]);
}

function setMember(
  target: Record<string, LivingDungeonAnalyticsValue>,
  key: string,
  value: unknown,
  allowed: readonly string[],
): void {
  if (member(allowed, value)) target[key] = value;
}

function setBoolean(
  target: Record<string, LivingDungeonAnalyticsValue>,
  key: string,
  value: unknown,
): void {
  if (typeof value === "boolean") target[key] = value;
}

/**
 * Rebuilds every payload from a closed allowlist. This is deliberately more
 * defensive than TypeScript alone: casted JavaScript objects cannot smuggle
 * prompt text or identifiers into Vercel Analytics as extra properties.
 */
export function livingDungeonAnalyticsPayload(
  event: LivingDungeonAnalyticsEvent,
  properties: LivingDungeonAnalyticsProperties[LivingDungeonAnalyticsEvent],
): LivingDungeonAnalyticsPayload {
  const input = properties as unknown as Record<string, unknown>;
  const payload: Record<string, LivingDungeonAnalyticsValue> = {
    analytics_version: LIVING_DUNGEON_ANALYTICS_VERSION,
  };

  switch (event) {
    case "living_run_started":
      setMember(payload, "entry_point", input.entry_point, ["home", "direct", "resume"]);
      setMember(payload, "variant", input.variant, VARIANTS);
      setBoolean(payload, "returning", input.returning);
      break;
    case "conversation_opened":
      setMember(payload, "room", input.room, ROOM_IDS);
      setMember(payload, "opened_by", input.opened_by, ["automatic", "player"]);
      break;
    case "suggestion_used":
      setMember(payload, "room", input.room, ["pact-room"]);
      setMember(payload, "suggestion_id", input.suggestion_id, SUGGESTIONS);
      break;
    case "interpretation_returned":
      setMember(payload, "source", input.source, ["ai", "menu", "fallback"]);
      setMember(payload, "input_method", input.input_method, INPUT_METHODS);
      setMember(payload, "result", input.result, ["offer", "clarification", "fallback"]);
      if (input.attempt === 1 || input.attempt === 2) payload.attempt = input.attempt;
      setMember(payload, "latency", input.latency, ["under_1s", "1_to_2_5s", "2_5_to_4s", "over_4s"]);
      break;
    case "clarification_requested":
      setMember(payload, "reason", input.reason, ["missing_boon", "missing_sacrifice", "ambiguous", "unsupported", "contradictory"]);
      if (input.attempt === 1) payload.attempt = 1;
      break;
    case "rule_accepted":
      setMember(payload, "input_method", input.input_method, INPUT_METHODS);
      setMember(payload, "boon_id", input.boon_id, BOON_IDS);
      setMember(payload, "restriction_id", input.restriction_id, RESTRICTION_IDS);
      break;
    case "rule_revised":
      setMember(payload, "input_method", input.input_method, INPUT_METHODS);
      if (input.revision_number === 1) payload.revision_number = 1;
      break;
    case "rule_rejected":
      setMember(payload, "input_method", input.input_method, INPUT_METHODS);
      setMember(payload, "reason", input.reason, ["player_choice", "unavailable", "invalid", "stale"]);
      break;
    case "fallback_used":
      setMember(payload, "reason", input.reason, FALLBACK_REASONS);
      setMember(payload, "destination", input.destination, ["ready_made", "retry"]);
      break;
    case "promise_kept":
      setMember(payload, "restriction_id", input.restriction_id, RESTRICTION_IDS);
      break;
    case "promise_broken":
      setMember(payload, "restriction_id", input.restriction_id, RESTRICTION_IDS);
      setMember(payload, "action", input.action, ["storm", "potion", "camp_purchase"]);
      break;
    case "boss_clue_seen":
      setMember(payload, "preparation_id", input.preparation_id, PREPARATION_IDS);
      setMember(payload, "source", input.source, ["witness", "no_witness"]);
      break;
    case "world_shaped":
      setMember(payload, "objective", input.objective, IMPROVISATION_GOAL_IDS);
      setMember(payload, "method", input.method, IMPROVISATION_METHOD_IDS);
      setMember(payload, "boundary", input.boundary, IMPROVISATION_BOUNDARY_IDS);
      setMember(payload, "source", input.source, ["ai", "authored_fallback"]);
      break;
    case "maneuver_compiled":
      setMember(payload, "premise_id", input.premise_id, WITNESS_GATE_PREMISE_IDS);
      setMember(payload, "method_id", input.method_id, IMPROVISATION_METHOD_IDS);
      setMember(payload, "source", input.source, ["ai", "authored_fallback"]);
      setMember(payload, "result", input.result, ["compiled", "clarification", "rejected"]);
      break;
    case "maneuver_committed":
      setMember(payload, "manoeuvre_id", input.manoeuvre_id, WITNESS_GATE_MANOEUVRE_IDS);
      break;
    case "maneuver_resolved":
      setMember(payload, "manoeuvre_id", input.manoeuvre_id, WITNESS_GATE_MANOEUVRE_IDS);
      setMember(payload, "outcome", input.outcome, ["SUCCESS", "SETBACK"]);
      setMember(payload, "belief_signal_id", input.belief_signal_id, WITNESS_GATE_BELIEF_SIGNAL_IDS);
      break;
    case "living_run_completed":
      setMember(payload, "outcome", input.outcome, ["victory", "defeat"]);
      setMember(payload, "pact_outcome", input.pact_outcome, ["kept", "broken", "declined", "none"]);
      setMember(payload, "variant", input.variant, VARIANTS);
      setBoolean(payload, "used_ai_interpretation", input.used_ai_interpretation);
      break;
    case "living_run_abandoned":
      setMember(payload, "room", input.room, ROOM_IDS);
      setMember(payload, "pact_outcome", input.pact_outcome, ["kept", "broken", "declined", "none"]);
      break;
    case "living_retry_started":
      setMember(payload, "previous_outcome", input.previous_outcome, ["victory", "defeat", "abandoned"]);
      break;
  }

  return Object.freeze(payload);
}

export function createLivingDungeonAnalytics(sender: LivingDungeonAnalyticsSender) {
  return function trackLivingDungeon<E extends LivingDungeonAnalyticsEvent>(
    event: E,
    properties: LivingDungeonAnalyticsProperties[E],
  ): void {
    try {
      const pending = sender(event, { ...livingDungeonAnalyticsPayload(event, properties) });
      if (pending && typeof pending.then === "function") {
        void Promise.resolve(pending).catch(() => undefined);
      }
    } catch {
      // Measurement is optional and never blocks a room, action or run.
    }
  };
}

export const trackLivingDungeon = createLivingDungeonAnalytics(track);
