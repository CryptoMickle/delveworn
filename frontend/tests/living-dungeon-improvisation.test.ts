import assert from "node:assert/strict";
import test from "node:test";
import {
  IMPROVISATION_METHOD_IDS,
  WITNESS_GATE_CATALOGUE_HASH,
  WITNESS_GATE_MANOEUVRES,
  WITNESS_GATE_PREMISES,
  WITNESS_GATE_PREMISE_IDS,
  WITNESS_GATE_SCENE,
  compileWitnessGatePlan,
  createWitnessGateState,
  dryRunWitnessGatePlan,
  isCanonicalWitnessGatePlan,
  isImprovisationSemanticSelection,
  isWitnessGateState,
  resolveWitnessGatePlan,
  validateCanonicalWitnessGatePlan,
  witnessGateSemanticContext,
  witnessGateStateDigest,
  type CanonicalWitnessGatePlan,
  type ImprovisationBoundaryId,
  type ImprovisationSemanticSelection,
  type WitnessGateManoeuvreId,
  type WitnessGateState,
} from "../app/living-dungeon/improvisation";

function selection(
  manoeuvreId: WitnessGateManoeuvreId,
  boundaryId: ImprovisationBoundaryId = "NONE",
): ImprovisationSemanticSelection {
  const manoeuvre = WITNESS_GATE_MANOEUVRES[manoeuvreId];
  return {
    premiseId: manoeuvre.premiseId,
    goalId: manoeuvre.goalId,
    methodId: manoeuvre.methodId,
    targetId: manoeuvre.targetId,
    objectId: manoeuvre.objectId,
    boundaryId,
    needsClarification: false,
  };
}

function compiled(
  manoeuvreId: WitnessGateManoeuvreId,
  state = createWitnessGateState({ runId: "improv-test", sceneSeed: 19 }),
  boundaryId: ImprovisationBoundaryId = "NONE",
): { state: WitnessGateState; plan: CanonicalWitnessGatePlan } {
  const result = compileWitnessGatePlan(selection(manoeuvreId, boundaryId), state);
  if (result.status !== "compiled") throw new Error(`Expected compiled plan, received ${result.status}.`);
  return { state, plan: result.plan };
}

test("Witness Gate is one bounded scene with three premises and four authored methods per premise", () => {
  assert.equal(WITNESS_GATE_SCENE.id, "WITNESS_GATE_V1");
  assert.deepEqual(WITNESS_GATE_SCENE.premiseIds, WITNESS_GATE_PREMISE_IDS);
  assert.equal(WITNESS_GATE_SCENE.visibleEntityIds.length, 9);
  assert.equal(WITNESS_GATE_SCENE.worldBoundaries.length, 4);
  assert.deepEqual(WITNESS_GATE_PREMISE_IDS.map((id) => WITNESS_GATE_PREMISES[id].goalId), [
    "RESCUE", "ACQUIRE", "DISCOVER",
  ]);

  const manoeuvres = Object.values(WITNESS_GATE_MANOEUVRES);
  assert.equal(manoeuvres.length, 12);
  assert.ok(manoeuvres.every((entry) => entry.cost.stormCharges === 0), "the scene does not invent a Storm inventory");
  for (const premiseId of WITNESS_GATE_PREMISE_IDS) {
    const premiseManoeuvres = manoeuvres.filter((entry) => entry.premiseId === premiseId);
    assert.equal(premiseManoeuvres.length, 4);
    assert.deepEqual(premiseManoeuvres.map((entry) => entry.methodId).sort(), [...IMPROVISATION_METHOD_IDS].sort());
    assert.ok(premiseManoeuvres.every((entry) => entry.goalId === WITNESS_GATE_PREMISES[premiseId].goalId));
  }
  assert.match(WITNESS_GATE_CATALOGUE_HASH, /^wgcatalogue-[a-f0-9]{8}$/);
});

test("untrusted semantic output accepts only the exact bounded ID shape", () => {
  const valid = selection("RESCUE_BELL_FEINT");
  assert.equal(isImprovisationSemanticSelection(valid), true);
  assert.equal(isImprovisationSemanticSelection({ ...valid, gold: 999 }), false, "a model cannot author costs");
  assert.equal(isImprovisationSemanticSelection({ ...valid, consequence: "open every gate" }), false, "a model cannot author effects");
  assert.equal(isImprovisationSemanticSelection({ ...valid, methodId: "INSTANT_WIN" }), false);
  assert.equal(isImprovisationSemanticSelection({ ...valid, needsClarification: "false" }), false);
  assert.equal(isImprovisationSemanticSelection({ ...valid, targetId: "INVISIBLE_DRAGON" }), false);

  const state = createWitnessGateState({ runId: "strict-output" });
  assert.deepEqual(compileWitnessGatePlan({ ...valid, gold: 0 }, state), {
    status: "rejected",
    code: "INVALID_SELECTION",
    reason: "The interpretation contains unsupported values or fields.",
  });
});

test("state validation and digest are strict, stable under set ordering, and sensitive to mechanics", () => {
  const first = createWitnessGateState({
    runId: "digest-run",
    revision: 4,
    sceneSeed: 91,
    beliefs: [
      { observerId: "MASKED_WARDEN", signalId: "BREAKS_OBSTACLES", strength: 2 },
      { observerId: "MASKED_WARDEN", signalId: "PAYS_TO_PROTECT", strength: 1 },
    ],
  });
  const reordered = createWitnessGateState({
    runId: "digest-run",
    revision: 4,
    sceneSeed: 91,
    visibleEntityIds: [...first.visibleEntityIds].reverse(),
    beliefs: [...first.beliefs].reverse(),
  });
  assert.equal(isWitnessGateState(first), true);
  assert.equal(witnessGateStateDigest(first), witnessGateStateDigest(reordered));
  assert.notEqual(witnessGateStateDigest(first), witnessGateStateDigest({
    ...first,
    player: { ...first.player, gold: first.player.gold + 1 },
  }));
  assert.notEqual(witnessGateStateDigest(first), witnessGateStateDigest({ ...first, revision: first.revision + 1 }));
  assert.throws(() => createWitnessGateState({ runId: "bad id with spaces" }), /Invalid Witness Gate state/);
  assert.equal(isWitnessGateState({ ...first, adminOverride: true }), false);
  assert.equal(isWitnessGateState({ ...first, visibleEntityIds: [...first.visibleEntityIds, first.visibleEntityIds[0]] }), false);
});

test("all twelve authored manoeuvres compile to canonical revision-bound plans and exact bilingual previews", () => {
  const state = createWitnessGateState({
    runId: "all-manoeuvres",
    revision: 12,
    sceneSeed: 44,
    player: { hp: 100, maxHp: 100, gold: 50, potions: 5, stormCharges: 4 },
  });
  for (const manoeuvre of Object.values(WITNESS_GATE_MANOEUVRES)) {
    const english = compileWitnessGatePlan(selection(manoeuvre.id), state, "en");
    const norwegian = compileWitnessGatePlan(selection(manoeuvre.id), state, "no");
    assert.equal(english.status, "compiled", manoeuvre.id);
    assert.equal(norwegian.status, "compiled", manoeuvre.id);
    if (english.status !== "compiled" || norwegian.status !== "compiled") continue;
    assert.equal(isCanonicalWitnessGatePlan(english.plan), true);
    assert.deepEqual(english.plan, norwegian.plan, "locale cannot alter mechanics");
    assert.equal(english.plan.boundRevision, 12);
    assert.equal(english.plan.stateDigest, witnessGateStateDigest(state));
    assert.deepEqual(english.preview.cost, { ...manoeuvre.cost, summary: english.preview.cost.summary });
    assert.equal(english.preview.steps.length, 3);
    assert.equal(english.preview.observer.entityId, "MASKED_WARDEN");
    assert.equal(english.preview.beliefSignal.id, manoeuvre.beliefSignalId);
    assert.equal(english.preview.resultOnSuccess.effectId, manoeuvre.successEffectId);
    assert.notEqual(english.preview.title, norwegian.preview.title);
    assert.match(norwegian.preview.trustStatement, /spillmotoren/);
    assert.deepEqual(validateCanonicalWitnessGatePlan(english.plan, state), { valid: true, manoeuvre });
  }
});

test("the compiler enforces player boundaries before producing a plan", () => {
  const state = createWitnessGateState({ runId: "boundaries", player: { gold: 20, potions: 3, stormCharges: 3 } });
  assert.equal(compileWitnessGatePlan(selection("RESCUE_STORM_RELAY", "NO_STORM"), state).status, "rejected");
  assert.deepEqual(compileWitnessGatePlan(selection("RESCUE_BELL_FEINT", "NO_GOLD"), state), {
    status: "rejected", code: "BOUNDARY_CONFLICT", reason: "The manoeuvre spends gold.",
  });
  assert.deepEqual(compileWitnessGatePlan(selection("ACQUIRE_BELL_SWITCH", "NO_LYING"), state), {
    status: "rejected", code: "BOUNDARY_CONFLICT", reason: "The manoeuvre relies on deception.",
  });
  assert.equal(compileWitnessGatePlan(selection("DISCOVER_RUNE_PARALLAX", "NO_GOLD"), state).status, "compiled");
  assert.equal(compileWitnessGatePlan(selection("DISCOVER_RUNE_PARALLAX", "NO_LYING"), state).status, "compiled");
  assert.equal(compileWitnessGatePlan(selection("ACQUIRE_WREST_SIGIL", "NO_KILLING"), state).status, "compiled");
});

test("Risk pays persistent HP while leaving ordinary combat Storm available", () => {
  const state = createWitnessGateState({
    runId: "risk-hp-cost",
    player: { hp: 40, maxHp: 100, gold: 0, potions: 0, stormCharges: 0 },
  });
  const compiledRisk = compileWitnessGatePlan(selection("RESCUE_STORM_RELAY"), state);
  assert.equal(compiledRisk.status, "compiled");
  if (compiledRisk.status !== "compiled") return;
  assert.deepEqual(compiledRisk.preview.cost, {
    gold: 0, potions: 0, hp: 3, stormCharges: 0, summary: "Pay: 3 HP.",
  });
  const resolved = resolveWitnessGatePlan(compiledRisk.plan, state);
  assert.equal(resolved.status, "resolved");
  if (resolved.status !== "resolved") return;
  const expectedHp = 40 - 3 - resolved.resolution.setbackDamage;
  assert.equal(resolved.resolution.nextState.player.hp, expectedHp);
  assert.equal(resolved.resolution.nextState.player.stormCharges, 0);
});

test("the compiler rejects mismatched premises, invented combinations, invisible objects and unaffordable costs", () => {
  const state = createWitnessGateState({ runId: "legality", player: { gold: 0, potions: 0, stormCharges: 0 } });
  const mismatch = { ...selection("RESCUE_BELL_FEINT"), goalId: "ACQUIRE" as const };
  assert.equal(compileWitnessGatePlan(mismatch, state).status, "rejected");
  const invented = { ...selection("DISCOVER_RUNE_PARALLAX"), objectId: "BRASS_BELL" as const };
  const inventedResult = compileWitnessGatePlan(invented, state);
  assert.equal(inventedResult.status, "rejected");
  if (inventedResult.status === "rejected") assert.equal(inventedResult.code, "UNSUPPORTED_COMBINATION");

  const invisibleState = createWitnessGateState({
    runId: "invisible",
    visibleEntityIds: state.visibleEntityIds.filter((id) => id !== "MEMORY_RUNES"),
  });
  const invisible = compileWitnessGatePlan(selection("DISCOVER_RUNE_PARALLAX"), invisibleState);
  assert.equal(invisible.status, "rejected");
  if (invisible.status === "rejected") assert.equal(invisible.code, "ENTITY_NOT_VISIBLE");

  const observerGone = createWitnessGateState({
    runId: "observer-gone",
    visibleEntityIds: state.visibleEntityIds.filter((id) => id !== "MASKED_WARDEN"),
  });
  const unobserved = compileWitnessGatePlan(selection("DISCOVER_RUNE_PARALLAX"), observerGone);
  assert.equal(unobserved.status, "rejected", "a belief signal cannot be emitted by an absent observer");
  if (unobserved.status === "rejected") assert.equal(unobserved.code, "ENTITY_NOT_VISIBLE");

  const noGold = compileWitnessGatePlan(selection("RESCUE_BELL_FEINT"), state);
  assert.equal(noGold.status, "rejected");
  if (noGold.status === "rejected") assert.equal(noGold.code, "INSUFFICIENT_RESOURCES");
  assert.equal(compileWitnessGatePlan({ ...selection("RESCUE_BELL_FEINT"), needsClarification: true }, state).status, "clarification");
});

test("dry-run exposes exact cost, aptitude-adjusted risk, observer and belief without mutating state", () => {
  const state = createWitnessGateState({
    runId: "dry-run",
    alarm: 1,
    player: { gold: 10, aptitudes: { CUNNING: 2 } },
  });
  const before = JSON.stringify(state);
  const result = compileWitnessGatePlan(selection("RESCUE_BELL_FEINT"), state, "en");
  assert.equal(result.status, "compiled");
  if (result.status !== "compiled") return;
  assert.equal(result.preview.risk.successChancePercent, 72, "68 base + 12 aptitude - 8 alarm");
  assert.deepEqual(result.preview.cost, {
    gold: 4, potions: 0, hp: 0, stormCharges: 0, summary: "Pay: 4 gold.",
  });
  assert.equal(result.preview.risk.setbackHp, 2);
  assert.equal(result.preview.risk.alarmOnSetback, 2);
  assert.deepEqual(result.preview.observer, { entityId: "MASKED_WARDEN", label: "Masked warden" });
  assert.equal(result.preview.beliefSignal.id, "FAVORS_MISDIRECTION");
  assert.equal(JSON.stringify(state), before);

  const repeated = dryRunWitnessGatePlan(result.plan, state, "en");
  assert.equal(repeated.status, "ready");
  if (repeated.status === "ready") assert.deepEqual(repeated.preview, result.preview);
});

test("canonical validation rejects stale state and every form of mechanical plan tampering", () => {
  const { state, plan } = compiled("ACQUIRE_DRAUGHT_TRADE");
  assert.equal(validateCanonicalWitnessGatePlan(plan, state).valid, true);
  assert.deepEqual(validateCanonicalWitnessGatePlan(plan, { ...state, revision: state.revision + 1 }), {
    valid: false, code: "STALE_STATE", reason: "The plan was compiled for a different scene state.",
  });
  assert.equal(validateCanonicalWitnessGatePlan({ ...plan, planId: "wgplan-deadbeef" }, state).valid, false);
  assert.equal(validateCanonicalWitnessGatePlan({ ...plan, methodId: "FORCE" }, state).valid, false);
  assert.equal(validateCanonicalWitnessGatePlan({ ...plan, catalogueHash: "wgcatalogue-deadbeef" }, state).valid, false);
  assert.equal(validateCanonicalWitnessGatePlan({ ...plan, targetId: "OATH_GATE" }, state).valid, false);
  assert.equal(validateCanonicalWitnessGatePlan({ ...plan, extraEffect: "WIN" }, state).valid, false);
});

test("resolution is deterministic, pays engine-authored costs, records only observed method and advances state once", () => {
  const state = createWitnessGateState({
    runId: "deterministic-resolution",
    revision: 8,
    sceneSeed: 223,
    player: { hp: 70, maxHp: 100, gold: 20, potions: 3, stormCharges: 2 },
  });
  const result = compileWitnessGatePlan(selection("ACQUIRE_DRAUGHT_TRADE"), state, "en");
  assert.equal(result.status, "compiled");
  if (result.status !== "compiled") return;
  const first = resolveWitnessGatePlan(result.plan, state, "en");
  const repeated = resolveWitnessGatePlan(JSON.parse(JSON.stringify(result.plan)), JSON.parse(JSON.stringify(state)), "en");
  assert.deepEqual(first, repeated);
  assert.equal(first.status, "resolved");
  if (first.status !== "resolved") return;
  assert.equal(first.resolution.nextState.revision, 9);
  assert.equal(first.resolution.nextState.player.potions, 2);
  assert.equal(first.resolution.nextState.player.gold, 20);
  assert.equal(first.resolution.observedBelief.signalId, "PAYS_TO_PROTECT");
  assert.match(first.resolution.resolutionId, /^wgresolution-[a-f0-9]{8}$/);
  assert.equal(JSON.stringify(state), JSON.stringify(createWitnessGateState({
    runId: "deterministic-resolution",
    revision: 8,
    sceneSeed: 223,
    player: { hp: 70, maxHp: 100, gold: 20, potions: 3, stormCharges: 2 },
  })));

  const replay = resolveWitnessGatePlan(result.plan, first.resolution.nextState);
  assert.equal(replay.status, "invalid");
  if (replay.status === "invalid") assert.equal(replay.code, "STALE_STATE");
});

test("both success and setback descriptions are deterministic and update different authoritative facts", () => {
  let success: ReturnType<typeof resolveWitnessGatePlan> | null = null;
  let setback: ReturnType<typeof resolveWitnessGatePlan> | null = null;
  for (let sceneSeed = 0; sceneSeed < 500 && (!success || !setback); sceneSeed += 1) {
    const state = createWitnessGateState({
      runId: `outcome-${sceneSeed}`,
      sceneSeed,
      player: { hp: 100, gold: 20, aptitudes: { FORCE: 0 } },
      alarm: 3,
    });
    const result = compileWitnessGatePlan(selection("RESCUE_BREAK_WINCH"), state, "no");
    assert.equal(result.status, "compiled");
    if (result.status !== "compiled") continue;
    const resolution = resolveWitnessGatePlan(result.plan, state, "no");
    assert.equal(resolution.status, "resolved");
    if (resolution.status !== "resolved") continue;
    if (resolution.resolution.outcome === "SUCCESS" && !success) success = resolution;
    if (resolution.resolution.outcome === "SETBACK" && !setback) setback = resolution;
  }
  assert.ok(success);
  assert.ok(setback);
  if (success?.status === "resolved") {
    assert.equal(success.resolution.effectId, "CARTOGRAPHER_FREED");
    assert.ok(success.resolution.nextState.resolvedPremiseIds.includes("WITNESS_GATE_RESCUE_CARTOGRAPHER"));
    assert.equal(success.resolution.nextState.player.hp, 94, "only the exact 6 HP cost is paid on success");
    assert.equal(success.resolution.description.headline, "Planen lykkes");
  }
  if (setback?.status === "resolved") {
    assert.equal(setback.resolution.effectId, "WARDEN_ALERTED");
    assert.equal(setback.resolution.nextState.resolvedPremiseIds.length, 0);
    assert.equal(setback.resolution.nextState.player.hp, 90, "6 HP cost plus 4 setback damage");
    assert.equal(setback.resolution.description.headline, "Planen møter motstand");
    assert.equal(setback.resolution.observedBelief.strength, 3);
  }
});

test("semantic context exposes only currently affordable authored combinations", () => {
  const scarce = createWitnessGateState({
    runId: "context",
    player: { gold: 0, potions: 0, stormCharges: 0, hp: 30, maxHp: 30 },
  });
  const context = witnessGateSemanticContext(scarce, "NONE");
  assert.match(context.stateDigest, /^wgstate-[a-f0-9]{8}$/);
  assert.ok(context.combinations.length > 0);
  assert.ok(context.combinations.every((entry) => {
    const manoeuvre = Object.values(WITNESS_GATE_MANOEUVRES).find((candidate) => (
      candidate.premiseId === entry.premiseId
      && candidate.methodId === entry.methodId
      && candidate.targetId === entry.targetId
      && candidate.objectId === entry.objectId
    ));
    return manoeuvre !== undefined
      && manoeuvre.cost.gold === 0
      && manoeuvre.cost.potions === 0
      && manoeuvre.cost.stormCharges === 0;
  }));
  assert.equal(context.methodIds.includes("MERCY"), false);
  assert.equal(context.methodIds.includes("RISK"), true);
  assert.equal(context.objectIds.includes("HEALING_DRAUGHT"), false);
  assert.equal(context.objectIds.includes("ECHO_BRAZIER"), true);
});
