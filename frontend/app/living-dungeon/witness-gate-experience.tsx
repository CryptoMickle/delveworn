"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  LivingRoomOverlay,
  ManeuverComposer,
  ThresholdIntentComposer,
  type AuthoredManeuverChoice,
  type CompiledManeuverPreview,
  type LivingRoomHotspot,
  type LivingRoomPlanPoint,
  type ThresholdIntentSuggestion,
} from "./components/intent-to-world";
import {
  WITNESS_GATE_BOUNDARIES,
  WITNESS_GATE_ENTITIES,
  WITNESS_GATE_METHODS,
  WITNESS_GATE_PREMISES,
  compileWitnessGatePlan,
  isImprovisationSemanticSelection,
  resolveWitnessGatePlan,
  witnessGateManoeuvresForPremise,
  witnessGateSemanticContext,
  witnessGateStateDigest,
  type CanonicalWitnessGatePlan,
  type ImprovisationGoalId,
  type ImprovisationLocale,
  type ImprovisationSemanticSelection,
  type WitnessGateEntityId,
  type WitnessGatePlanPreview,
  type WitnessGatePremiseId,
  type WitnessGateState,
} from "./improvisation";
import {
  isBoundedImprovisationPlan,
  isLivingDungeonWorldShape,
  improvisationRequestDigest,
  type LivingDungeonWorldShape,
  type PlanContext,
  type PlanImprovisationReply,
  type PlanImprovisationRequest,
  type ShapeWorldRequest,
  type ShapeWorldReply,
} from "./improvisation-ai-contract";
import { trackLivingDungeon, type LivingDungeonImprovisationSource } from "./analytics";
import {
  livingDungeonIntentSelection,
  livingDungeonWitnessGateState,
} from "./engine";
import type { LivingDungeon, LivingDungeonCommand } from "./model";

type Command = (command: LivingDungeonCommand) => Promise<boolean>;

type CompiledPlan = Readonly<{
  plan: CanonicalWitnessGatePlan;
  preview: WitnessGatePlanPreview;
  source: LivingDungeonImprovisationSource;
}>;

export type WitnessGateExperience = Readonly<{
  active: boolean;
  shaped: boolean;
  special: boolean;
  presentationOverlay: ReactNode;
  panel: ReactNode;
  roomTitle: string | null;
  interactionsLocked: boolean;
}>;

const PREMISE_FOR_GOAL: Readonly<Record<ImprovisationGoalId, WitnessGatePremiseId>> = {
  RESCUE: "WITNESS_GATE_RESCUE_CARTOGRAPHER",
  ACQUIRE: "WITNESS_GATE_CLAIM_SIGIL",
  DISCOVER: "WITNESS_GATE_READ_MEMORY",
};

const ENTITY_POSITION: Readonly<Record<WitnessGateEntityId | "PLAYER", Readonly<{ x: number; y: number }>>> = {
  PLAYER: { x: 52, y: 84 },
  CHAINED_CARTOGRAPHER: { x: 27, y: 31 },
  MASKED_WARDEN: { x: 55, y: 34 },
  OATH_GATE: { x: 50, y: 12 },
  BRASS_BELL: { x: 35, y: 51 },
  CHAIN_WINCH: { x: 24, y: 47 },
  HEALING_DRAUGHT: { x: 44, y: 68 },
  WARDEN_SIGIL: { x: 61, y: 37 },
  ECHO_BRAZIER: { x: 76, y: 59 },
  MEMORY_RUNES: { x: 69, y: 20 },
};

const WORLD_SUGGESTIONS: Readonly<Record<ImprovisationLocale, readonly ThresholdIntentSuggestion[]>> = {
  en: [
    { id: "rescue", label: "Rescue someone", statement: "I want to free the prisoner through cunning without killing anyone." },
    { id: "acquire", label: "Steal authority", statement: "I want to take the warden's sigil without using Storm." },
    { id: "discover", label: "Learn the room's secret", statement: "I want to discover what the gate remembers by taking a calculated risk." },
  ],
  no: [
    { id: "rescue", label: "Redd noen", statement: "Jeg vil befri fangen med list uten å drepe noen." },
    { id: "acquire", label: "Stjel autoritet", statement: "Jeg vil ta vokterens sigill uten å bruke Storm." },
    { id: "discover", label: "Avslør rommets hemmelighet", statement: "Jeg vil oppdage hva porten husker ved å ta en kalkulert risiko." },
  ],
};

const COPY = {
  en: {
    unclearIntent: "Name one outcome and one approach: rescue, acquire or discover — through cunning, mercy, force or risk.",
    shapeUnavailable: "The interpreter is unavailable. Choose an authored objective and keep playing.",
    stale: "The room changed before the plan was ready. Describe it again.",
    planUnclear: "The plan needs a clearer use of one named object in the room.",
    planUnavailable: "The interpreter is unavailable. Choose one of the engine-authored maneuvers below.",
    planRejected: "That combination is outside this room's mechanics. Revise it or choose an authored maneuver.",
    executeRejected: "The room changed before the maneuver could run. Preview it again.",
    objective: "Choose an authored objective",
    witness: "The warden's sightline",
    witnessDetail: "Visible actions can become a belief used later in the expedition.",
    scene: "The Witness Gate",
    fight: "Fight normally instead",
  },
  no: {
    unclearIntent: "Nevn ett mål og én fremgangsmåte: redd, skaff eller oppdag — med list, barmhjertighet, makt eller risiko.",
    shapeUnavailable: "Tolkeren er utilgjengelig. Velg et håndskrevet mål og fortsett spillet.",
    stale: "Rommet endret seg før planen var klar. Beskriv den på nytt.",
    planUnclear: "Planen må bruke én av de navngitte tingene i rommet tydeligere.",
    planUnavailable: "Tolkeren er utilgjengelig. Velg en av manøvrene spillmotoren har skrevet under.",
    planRejected: "Kombinasjonen finnes ikke i dette rommets mekanikk. Endre planen eller velg en håndskrevet manøver.",
    executeRejected: "Rommet endret seg før manøveren kunne utføres. Forhåndsvis den på nytt.",
    objective: "Velg et håndskrevet mål",
    witness: "Vokterens synsfelt",
    witnessDetail: "Synlige handlinger kan bli til en oppfatning som brukes senere i ekspedisjonen.",
    scene: "Vitneporten",
    fight: "Slåss som normalt i stedet",
  },
} as const;

function browserLocale(): ImprovisationLocale {
  if (typeof navigator === "undefined") return "en";
  return /^(nb|nn|no)(-|$)/iu.test(navigator.language) ? "no" : "en";
}

function subscribeToLocale(): () => void {
  return () => undefined;
}

function serverLocale(): ImprovisationLocale {
  return "en";
}

function localized(value: Readonly<Record<ImprovisationLocale, string>>, locale: ImprovisationLocale): string {
  return value[locale];
}

function legalSelectionForShape(shape: LivingDungeonWorldShape, state: WitnessGateState): ImprovisationSemanticSelection | null {
  const premiseId = PREMISE_FOR_GOAL[shape.objective];
  const manoeuvre = witnessGateManoeuvresForPremise(premiseId)
    .find((candidate) => candidate.methodId === shape.method);
  if (!manoeuvre) return null;
  const selection: ImprovisationSemanticSelection = {
    premiseId,
    goalId: manoeuvre.goalId,
    methodId: manoeuvre.methodId,
    targetId: manoeuvre.targetId,
    objectId: manoeuvre.objectId,
    boundaryId: shape.boundary,
    needsClarification: false,
  };
  return compileWitnessGatePlan(selection, state).status === "compiled" ? selection : null;
}

function responseRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isShapeReply(value: unknown): value is ShapeWorldReply {
  if (!responseRecord(value) || !["interpreted", "fallback"].includes(String(value.status))
    || !isLivingDungeonWorldShape(value.shape) || !responseRecord(value.binding)) return false;
  return Number.isSafeInteger(value.binding.runRevision)
    && typeof value.binding.stateDigest === "string"
    && typeof value.binding.requestDigest === "string";
}

function isPlanReply(value: unknown, request: PlanImprovisationRequest): value is PlanImprovisationReply {
  if (!responseRecord(value) || !["interpreted", "fallback"].includes(String(value.status))
    || !isBoundedImprovisationPlan(value.plan, request) || !responseRecord(value.binding)) return false;
  return Number.isSafeInteger(value.binding.runRevision)
    && typeof value.binding.stateDigest === "string"
    && typeof value.binding.requestDigest === "string";
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error("request_failed");
  return response.json() as Promise<unknown>;
}

function normalizedSubmittedProse(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function isAborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function semanticPlanContext(
  state: WitnessGateState,
  selection: ImprovisationSemanticSelection,
  locale: ImprovisationLocale,
): PlanContext {
  const context = witnessGateSemanticContext(state, selection.boundaryId);
  const legalTuples = new Set(context.combinations
    .filter((combination) => (
      combination.premiseId === selection.premiseId
      && combination.methodId === selection.methodId
    ))
    .map((combination) => [
      combination.goalId,
      combination.methodId,
      combination.targetId,
      combination.objectId,
    ].join("|")));
  return {
    manoeuvres: witnessGateManoeuvresForPremise(selection.premiseId)
      .filter((manoeuvre) => legalTuples.has([
        manoeuvre.goalId,
        manoeuvre.methodId,
        manoeuvre.targetId,
        manoeuvre.objectId,
      ].join("|")))
      .map((manoeuvre) => ({
        id: manoeuvre.id,
        goalId: manoeuvre.goalId,
        methodId: manoeuvre.methodId,
        targetId: manoeuvre.targetId,
        objectId: manoeuvre.objectId,
        boundaryId: selection.boundaryId,
        description: [
          localized(manoeuvre.title, locale),
          localized(WITNESS_GATE_ENTITIES[manoeuvre.targetId].label, locale),
          localized(WITNESS_GATE_ENTITIES[manoeuvre.objectId].label, locale),
        ].join(" · "),
      })),
  };
}

function maneuverPreview(preview: WitnessGatePlanPreview, locale: ImprovisationLocale): CompiledManeuverPreview {
  const costs = [
    preview.cost.gold > 0 ? { label: locale === "no" ? "Gull" : "Gold", value: String(preview.cost.gold) } : null,
    preview.cost.potions > 0 ? { label: locale === "no" ? "Helsedrikk" : "Potion", value: String(preview.cost.potions) } : null,
    preview.cost.hp > 0 ? { label: "HP", value: String(preview.cost.hp) } : null,
    preview.cost.stormCharges > 0 ? { label: locale === "no" ? "Storm-ladning" : "Storm charge", value: String(preview.cost.stormCharges) } : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  return {
    title: preview.title,
    summary: `${preview.resultOnSuccess.label} ${preview.trustStatement}`,
    steps: preview.steps.map(step => ({ id: step.stepId, title: step.label })),
    costs,
    risk: {
      level: preview.risk.level === "MODERATE" ? "medium" : preview.risk.level.toLocaleLowerCase("en") as "low" | "high",
      label: `${preview.risk.successChancePercent}%`,
      detail: preview.risk.summary,
    },
    watcher: {
      name: preview.observer.label,
      observation: locale === "no" ? "Ser metoden, men kjenner ikke hensikten din." : "Sees the method, but not your hidden intent.",
      possibleBelief: preview.beliefSignal.label,
    },
  };
}

function fallbackChoices(
  state: WitnessGateState,
  selection: ImprovisationSemanticSelection,
  locale: ImprovisationLocale,
): readonly AuthoredManeuverChoice[] {
  return witnessGateManoeuvresForPremise(selection.premiseId).flatMap((manoeuvre) => {
    const result = compileWitnessGatePlan({
      premiseId: manoeuvre.premiseId,
      goalId: manoeuvre.goalId,
      methodId: manoeuvre.methodId,
      targetId: manoeuvre.targetId,
      objectId: manoeuvre.objectId,
      boundaryId: selection.boundaryId,
      needsClarification: false,
    }, state, locale);
    if (result.status !== "compiled") return [];
    return [{
      id: manoeuvre.id,
      title: result.preview.title,
      description: `${localized(WITNESS_GATE_METHODS[manoeuvre.methodId].label, locale)} · ${result.preview.cost.summary} · ${result.preview.risk.successChancePercent}%`,
    }];
  });
}

function roomHotspots(selection: ImprovisationSemanticSelection, compiled: CompiledPlan | null, locale: ImprovisationLocale): readonly LivingRoomHotspot[] {
  const manoeuvres = witnessGateManoeuvresForPremise(selection.premiseId);
  const ids = [...new Set<WitnessGateEntityId>([
    ...manoeuvres.map(manoeuvre => manoeuvre.targetId),
    ...manoeuvres.map(manoeuvre => manoeuvre.objectId),
    "MASKED_WARDEN",
    "OATH_GATE",
  ])];
  return ids.map((id) => {
    const entity = WITNESS_GATE_ENTITIES[id];
    return {
      id,
      name: localized(entity.label, locale),
      description: localized(entity.description, locale),
      ...ENTITY_POSITION[id],
      kind: id === "OATH_GATE" ? "exit" as const
        : entity.kind === "CHARACTER" ? "witness" as const
          : id === "ECHO_BRAZIER" ? "hazard" as const : "object" as const,
      icon: entity.kind === "CHARACTER" ? "◉" : id === "OATH_GATE" ? "↑" : "✦",
      selected: compiled ? compiled.plan.objectId === id || compiled.plan.targetId === id : false,
    };
  });
}

function roomPlanPath(compiled: CompiledPlan | null): readonly LivingRoomPlanPoint[] {
  if (!compiled) return [];
  const ids: readonly (WitnessGateEntityId | "PLAYER")[] = ["PLAYER", compiled.plan.objectId, compiled.plan.targetId];
  return ids.map((id, index) => ({
    id: `${index}:${id}`,
    ...ENTITY_POSITION[id],
    label: id === "PLAYER" ? "Start" : WITNESS_GATE_ENTITIES[id].label.en,
  }));
}

export function useWitnessGateExperience(run: LivingDungeon | null, command: Command): WitnessGateExperience {
  const locale = useSyncExternalStore(subscribeToLocale, browserLocale, serverLocale);
  const [shapeLoading, setShapeLoading] = useState(false);
  const [shapeError, setShapeError] = useState<string | null>(null);
  const [showShapeFallback, setShowShapeFallback] = useState(false);
  const [plan, setPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [compiled, setCompiled] = useState<CompiledPlan | null>(null);
  const [executing, setExecuting] = useState(false);
  const currentRunId = run?.runId ?? null;
  const [stateRunId, setStateRunId] = useState(currentRunId);
  const shapeGeneration = useRef(0);
  const planGeneration = useRef(0);
  const executionGeneration = useRef(0);
  const shapeController = useRef<AbortController | null>(null);
  const planController = useRef<AbortController | null>(null);
  const shapeRequestKey = useRef<string | null>(null);
  const planRequestKey = useRef<string | null>(null);
  const currentRunIdRef = useRef(currentRunId);

  if (stateRunId !== currentRunId) {
    setStateRunId(currentRunId);
    setShapeLoading(false);
    setShapeError(null);
    setShowShapeFallback(false);
    setPlan("");
    setPlanLoading(false);
    setPlanError(null);
    setCompiled(null);
    setExecuting(false);
  }

  const gateState = useMemo(() => run ? livingDungeonWitnessGateState(run) : null, [run]);
  const selection = useMemo(() => run ? livingDungeonIntentSelection(run) : null, [run]);
  const active = Boolean(run && gateState && run.roomId === "warmup" && run.phase === "explore");
  const copy = COPY[locale];
  const interactionsLocked = shapeLoading || planLoading || executing;

  useLayoutEffect(() => {
    currentRunIdRef.current = currentRunId;
    shapeGeneration.current += 1;
    planGeneration.current += 1;
    executionGeneration.current += 1;
    shapeController.current?.abort();
    planController.current?.abort();
    shapeController.current = null;
    planController.current = null;
    shapeRequestKey.current = null;
    planRequestKey.current = null;
  }, [currentRunId]);

  const latestBinding = useRef({ revision: gateState?.revision ?? -1, digest: gateState ? witnessGateStateDigest(gateState) : "" });
  useLayoutEffect(() => {
    latestBinding.current = {
      revision: gateState?.revision ?? -1,
      digest: gateState ? witnessGateStateDigest(gateState) : "",
    };
  }, [gateState]);

  const declare = useCallback(async (shape: LivingDungeonWorldShape, source: LivingDungeonImprovisationSource) => {
    if (!gateState) return;
    const nextSelection = legalSelectionForShape({ ...shape, needsClarification: false }, gateState);
    if (!nextSelection) {
      setShapeError(copy.unclearIntent);
      setShowShapeFallback(true);
      return;
    }
    const accepted = await command({ type: "declare-intent", selection: nextSelection });
    if (!accepted) {
      setShapeError(copy.stale);
      return;
    }
    trackLivingDungeon("world_shaped", {
      objective: nextSelection.goalId,
      method: nextSelection.methodId,
      boundary: nextSelection.boundaryId,
      source,
    });
  }, [command, copy, gateState]);

  const shapeWorld = useCallback(async (statement: string) => {
    if (!gateState || !currentRunId || shapeLoading) return;
    const digest = witnessGateStateDigest(gateState);
    const revision = gateState.revision;
    const request: ShapeWorldRequest = {
      statement: normalizedSubmittedProse(statement),
      runRevision: revision,
      stateDigest: digest,
    };
    if (!request.statement) return;
    const requestKey = `${currentRunId}|${improvisationRequestDigest(request)}`;
    const generation = shapeGeneration.current + 1;
    shapeGeneration.current = generation;
    shapeController.current?.abort();
    const controller = new AbortController();
    shapeController.current = controller;
    shapeRequestKey.current = requestKey;
    setShapeLoading(true);
    setShapeError(null);
    setShowShapeFallback(false);
    try {
      const response = await fetch("/api/living-dungeon/shape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const reply = await responseJson(response);
      if (!isShapeReply(reply)) throw new Error("invalid_reply");
      if (shapeGeneration.current !== generation
        || shapeRequestKey.current !== requestKey
        || currentRunIdRef.current !== currentRunId) return;
      if (reply.binding.runRevision !== revision || reply.binding.stateDigest !== digest
        || reply.binding.requestDigest !== improvisationRequestDigest(request)
        || latestBinding.current.revision !== revision || latestBinding.current.digest !== digest) {
        setShapeError(copy.stale);
        return;
      }
      if (reply.status === "fallback") {
        setShapeError(copy.shapeUnavailable);
        setShowShapeFallback(true);
        return;
      }
      if (reply.shape.needsClarification) {
        setShapeError(copy.unclearIntent);
        return;
      }
      await declare(reply.shape, "ai");
    } catch (error) {
      if (isAborted(error)
        || shapeGeneration.current !== generation
        || shapeRequestKey.current !== requestKey
        || currentRunIdRef.current !== currentRunId) return;
      setShapeError(copy.shapeUnavailable);
      setShowShapeFallback(true);
    } finally {
      if (shapeGeneration.current === generation
        && shapeRequestKey.current === requestKey
        && currentRunIdRef.current === currentRunId) {
        shapeController.current = null;
        setShapeLoading(false);
      }
    }
  }, [copy, currentRunId, declare, gateState, shapeLoading]);

  const compilePlan = useCallback(async (playerPlan: string) => {
    if (!gateState || !selection || !currentRunId || planLoading) return;
    const digest = witnessGateStateDigest(gateState);
    const revision = gateState.revision;
    const context = semanticPlanContext(gateState, selection, locale);
    if (context.manoeuvres.length < 1) {
      setPlanError(copy.planRejected);
      return;
    }
    const premise = {
      id: selection.premiseId,
      description: localized(WITNESS_GATE_PREMISES[selection.premiseId].situation, locale),
    };
    const request: PlanImprovisationRequest = {
      premise,
      context,
      playerPlan: normalizedSubmittedProse(playerPlan),
      runRevision: revision,
      stateDigest: digest,
    };
    if (!request.playerPlan) return;
    const requestDigest = improvisationRequestDigest(request);
    const requestKey = `${currentRunId}|${requestDigest}`;
    const generation = planGeneration.current + 1;
    planGeneration.current = generation;
    planController.current?.abort();
    const controller = new AbortController();
    planController.current = controller;
    planRequestKey.current = requestKey;
    setPlanLoading(true);
    setPlanError(null);
    setCompiled(null);
    try {
      const response = await fetch("/api/living-dungeon/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const reply = await responseJson(response);
      if (!isPlanReply(reply, request)) throw new Error("invalid_reply");
      if (planGeneration.current !== generation
        || planRequestKey.current !== requestKey
        || currentRunIdRef.current !== currentRunId) return;
      if (reply.binding.runRevision !== revision || reply.binding.stateDigest !== digest
        || reply.binding.requestDigest !== requestDigest
        || latestBinding.current.revision !== revision || latestBinding.current.digest !== digest) {
        setPlanError(copy.stale);
        return;
      }
      if (reply.status === "fallback") {
        setPlanError(copy.planUnavailable);
        trackLivingDungeon("maneuver_compiled", {
          premise_id: selection.premiseId,
          method_id: selection.methodId,
          source: "authored_fallback",
          result: "clarification",
        });
        return;
      }
      const chosen = request.context.manoeuvres.find((manoeuvre) => manoeuvre.id === reply.plan.manoeuvreId);
      if (!chosen || reply.plan.needsClarification) {
        setPlanError(copy.planUnclear);
        trackLivingDungeon("maneuver_compiled", {
          premise_id: selection.premiseId,
          method_id: selection.methodId,
          source: "ai",
          result: "clarification",
        });
        return;
      }
      const semantic: ImprovisationSemanticSelection = {
        premiseId: selection.premiseId,
        goalId: chosen.goalId as ImprovisationSemanticSelection["goalId"],
        methodId: chosen.methodId as ImprovisationSemanticSelection["methodId"],
        targetId: chosen.targetId as ImprovisationSemanticSelection["targetId"],
        objectId: chosen.objectId as ImprovisationSemanticSelection["objectId"],
        boundaryId: chosen.boundaryId as ImprovisationSemanticSelection["boundaryId"],
        needsClarification: false,
      };
      if (!isImprovisationSemanticSelection(semantic)) {
        setPlanError(copy.planRejected);
        return;
      }
      const result = compileWitnessGatePlan(semantic, gateState, locale);
      if (result.status !== "compiled") {
        setPlanError(result.status === "clarification" ? copy.planUnclear : copy.planRejected);
        trackLivingDungeon("maneuver_compiled", {
          premise_id: selection.premiseId,
          method_id: semantic.methodId,
          source: "ai",
          result: result.status === "clarification" ? "clarification" : "rejected",
        });
        return;
      }
      setCompiled({ plan: result.plan, preview: result.preview, source: "ai" });
      trackLivingDungeon("maneuver_compiled", {
        premise_id: result.plan.premiseId,
        method_id: result.plan.methodId,
        source: "ai",
        result: "compiled",
      });
    } catch (error) {
      if (isAborted(error)
        || planGeneration.current !== generation
        || planRequestKey.current !== requestKey
        || currentRunIdRef.current !== currentRunId) return;
      setPlanError(copy.planUnavailable);
    } finally {
      if (planGeneration.current === generation
        && planRequestKey.current === requestKey
        && currentRunIdRef.current === currentRunId) {
        planController.current = null;
        setPlanLoading(false);
      }
    }
  }, [copy, currentRunId, gateState, locale, planLoading, selection]);

  const chooseFallback = useCallback((manoeuvreId: string) => {
    if (!gateState || !selection || interactionsLocked) return;
    const manoeuvre = witnessGateManoeuvresForPremise(selection.premiseId).find(entry => entry.id === manoeuvreId);
    if (!manoeuvre) return;
    const result = compileWitnessGatePlan({
      premiseId: manoeuvre.premiseId,
      goalId: manoeuvre.goalId,
      methodId: manoeuvre.methodId,
      targetId: manoeuvre.targetId,
      objectId: manoeuvre.objectId,
      boundaryId: selection.boundaryId,
      needsClarification: false,
    }, gateState, locale);
    if (result.status !== "compiled") {
      setPlanError(copy.planRejected);
      return;
    }
    setPlanError(null);
    setCompiled({ plan: result.plan, preview: result.preview, source: "authored_fallback" });
    trackLivingDungeon("maneuver_compiled", {
      premise_id: result.plan.premiseId,
      method_id: result.plan.methodId,
      source: "authored_fallback",
      result: "compiled",
    });
  }, [copy, gateState, interactionsLocked, locale, selection]);

  const play = useCallback(async () => {
    if (!compiled || !gateState || !currentRunId || executing) return;
    const generation = executionGeneration.current + 1;
    executionGeneration.current = generation;
    setExecuting(true);
    const resolved = resolveWitnessGatePlan(compiled.plan, gateState, locale);
    try {
      const accepted = await command({ type: "execute-improvisation", plan: compiled.plan });
      if (executionGeneration.current !== generation || currentRunIdRef.current !== currentRunId) return;
      if (!accepted) {
        setPlanError(copy.executeRejected);
      } else {
        trackLivingDungeon("maneuver_committed", { manoeuvre_id: compiled.plan.manoeuvreId });
        if (resolved.status === "resolved") {
          trackLivingDungeon("maneuver_resolved", {
            manoeuvre_id: compiled.plan.manoeuvreId,
            outcome: resolved.resolution.outcome,
            belief_signal_id: resolved.resolution.observedBelief.signalId,
          });
        }
      }
    } finally {
      if (executionGeneration.current === generation && currentRunIdRef.current === currentRunId) {
        setExecuting(false);
      }
    }
  }, [command, compiled, copy, currentRunId, executing, gateState, locale]);

  const fightNormally = useCallback(async () => {
    if (interactionsLocked) return;
    await command({ type: "engage" });
  }, [command, interactionsLocked]);

  if (!active || !gateState) {
    return {
      active: false,
      shaped: false,
      special: false,
      presentationOverlay: null,
      panel: null,
      roomTitle: null,
      interactionsLocked,
    };
  }

  if (!selection) {
    const fallback = showShapeFallback ? <section className="living-intent-fallback" aria-label={copy.objective}>
      <strong>{copy.objective}</strong>
      <div data-keyboard-actions>
        {(["RESCUE", "ACQUIRE", "DISCOVER"] as const).flatMap(objective => (
          witnessGateManoeuvresForPremise(PREMISE_FOR_GOAL[objective]).flatMap((manoeuvre) => {
            const shape: LivingDungeonWorldShape = {
              objective,
              method: manoeuvre.methodId,
              boundary: "NONE",
              needsClarification: false,
            };
            if (!legalSelectionForShape(shape, gateState)) return [];
            return <button
              key={`${objective}:${manoeuvre.methodId}`}
              type="button"
              disabled={interactionsLocked}
              onClick={() => void declare(shape, "authored_fallback")}
            >
              {localized(WITNESS_GATE_PREMISES[PREMISE_FOR_GOAL[objective]].title, locale)} · {localized(WITNESS_GATE_METHODS[manoeuvre.methodId].label, locale)} · {localized(WITNESS_GATE_BOUNDARIES.NONE.label, locale)}
            </button>;
          })
        ))}
      </div>
    </section> : null;
    return {
      active: true,
      shaped: false,
      special: true,
      presentationOverlay: null,
      panel: <div className="living-intent-stage">
        <ThresholdIntentComposer
          language={locale}
          suggestions={WORLD_SUGGESTIONS[locale]}
          loading={shapeLoading}
          error={shapeError}
          onSubmit={shapeWorld}
        />
        {fallback}
        <div className="living-intent-direct-combat" data-keyboard-actions>
          <button type="button" className="living-secondary" data-keyboard-default="true" disabled={shapeLoading} onClick={() => void fightNormally()}>{copy.fight}</button>
        </div>
      </div>,
      roomTitle: copy.scene,
      interactionsLocked,
    };
  }

  const premise = WITNESS_GATE_PREMISES[selection.premiseId];
  const choices = fallbackChoices(gateState, selection, locale);
  const hotspots = roomHotspots(selection, compiled, locale);
  const path = roomPlanPath(compiled);
  const overlay = <LivingRoomOverlay
    className="living-world-overlay"
    roomLabel={copy.scene}
    premise={{ name: localized(premise.title, locale), description: localized(premise.situation, locale) }}
    hotspots={hotspots}
    planPath={path}
    observerFootprint={{ x: 55, y: 34, width: 32, height: 30, label: copy.witness, detail: copy.witnessDetail }}
    onHotspotSelect={interactionsLocked ? undefined : (id) => {
      const entity = WITNESS_GATE_ENTITIES[id as WitnessGateEntityId];
      if (!entity || compiled) return;
      const label = localized(entity.label, locale);
      setPlan(current => current.trim() ? `${current.trim()} ${label}` : label);
    }}
  />;
  const panel = <div className="living-intent-stage">
    <ManeuverComposer
      language={locale}
      plan={plan}
      preview={compiled ? maneuverPreview(compiled.preview, locale) : null}
      compiling={planLoading || executing}
      error={planError}
      fallbackChoices={choices}
      onPlanChange={(next) => {
        if (interactionsLocked) return;
        setPlan(next);
        setCompiled(null);
        setPlanError(null);
      }}
      onCompile={compilePlan}
      onPlay={play}
      onRevise={() => setCompiled(null)}
      onFightNormally={fightNormally}
      onFallbackChoice={chooseFallback}
    />
  </div>;

  return {
    active: true,
    shaped: true,
    special: true,
    presentationOverlay: overlay,
    panel,
    roomTitle: localized(premise.title, locale),
    interactionsLocked,
  };
}
