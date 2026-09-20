import assert from "node:assert/strict";
import test from "node:test";
import {
  bossPreparationClue,
  createLivingDungeon,
  availableLivingDungeonActions,
  livingDungeonCombatPreview,
  livingDungeonIntentSelection,
  livingDungeonPactEligibility,
  livingDungeonWitnessGateState,
  standardLivingDungeonPactOffers,
  transitionLivingDungeon,
} from "../app/living-dungeon/engine";
import { appendDungeonFact, createDungeonFact } from "../app/living-dungeon/facts";
import {
  acceptPactOffer,
  applyBossDamageBoon,
  applyBossEntryBoon,
  applyBossRetaliationBoon,
  buildPactOffer,
  checkPactAction,
  completePact,
  confirmPactBreach,
  pactEligibilityDigest,
} from "../app/living-dungeon/pact-engine";
import { PACT_DESIRED_BOONS, PACT_SACRIFICES, type PactIntent } from "../app/living-dungeon/pact-schema";
import {
  LIVING_DUNGEON_SAVE_KEY,
  isLivingDungeon,
  loadLivingDungeon,
  saveLivingDungeon,
} from "../app/living-dungeon/storage";
import type { LivingDungeon } from "../app/living-dungeon/model";
import { exclusiveSave, type SaveLocks } from "../app/descent/save-lock";
import {
  WITNESS_GATE_MANOEUVRES,
  compileWitnessGatePlan,
  type CanonicalWitnessGatePlan,
  type ImprovisationMethodId,
  type ImprovisationSemanticSelection,
} from "../app/living-dungeon/improvisation";

const baseIntent = (desiredBoon: PactIntent["desiredBoon"], offeredSacrifice: PactIntent["offeredSacrifice"]): PactIntent => ({
  desiredBoon,
  offeredSacrifice,
  durationPreference: "UNTIL_BOSS",
  breachTolerance: "HIGH",
  needsClarification: false,
});

function enterPact(seed = 71, runId = "living-test"): LivingDungeon {
  let run = transitionLivingDungeon(createLivingDungeon(seed, runId), { type: "engage" });
  run = { ...run, encounter: { ...run.encounter!, hp: 1 } };
  run = transitionLivingDungeon(run, { type: "attack" });
  assert.equal(run.phase, "room-cleared");
  return transitionLivingDungeon(run, { type: "continue" });
}

function acceptTestPact(run: LivingDungeon, intent = baseIntent("DEFENSE", "NO_STORM")): LivingDungeon {
  run = transitionLivingDungeon(run, { type: "prepare-pact", intent, offerSeed: 19 });
  assert.ok(run.pendingOffer);
  return transitionLivingDungeon(run, { type: "accept-pact", pactId: run.pendingOffer.terms.pactId });
}

function oneHit(run: LivingDungeon, command: "attack" | "storm" = "attack"): LivingDungeon {
  assert.ok(run.encounter);
  const ready = { ...run, encounter: { ...run.encounter, hp: 1 } };
  return transitionLivingDungeon(ready, { type: command });
}

function reachCamp(intent: PactIntent, runId: string): LivingDungeon {
  let run = acceptTestPact(enterPact(80, runId), intent);
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  run = transitionLivingDungeon(run, { type: "continue" });
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  return transitionLivingDungeon(run, { type: "continue" });
}

const IMPROVISATION_OBJECTS: Readonly<Record<ImprovisationMethodId, ImprovisationSemanticSelection["objectId"]>> = {
  CUNNING: "BRASS_BELL",
  MERCY: "HEALING_DRAUGHT",
  FORCE: "CHAIN_WINCH",
  RISK: "ECHO_BRAZIER",
};

function improvisationSelection(methodId: ImprovisationMethodId): ImprovisationSemanticSelection {
  return {
    premiseId: "WITNESS_GATE_RESCUE_CARTOGRAPHER",
    goalId: "RESCUE",
    methodId,
    targetId: "CHAINED_CARTOGRAPHER",
    objectId: IMPROVISATION_OBJECTS[methodId],
    boundaryId: "NONE",
    needsClarification: false,
  };
}

function declaredImprovisation(
  seed: number,
  runId: string,
  methodId: ImprovisationMethodId,
): Readonly<{ run: LivingDungeon; plan: CanonicalWitnessGatePlan }> {
  let run = createLivingDungeon(seed, runId);
  const selection = improvisationSelection(methodId);
  run = transitionLivingDungeon(run, { type: "declare-intent", selection });
  const compiled = compileWitnessGatePlan(selection, livingDungeonWitnessGateState(run));
  assert.equal(compiled.status, "compiled");
  if (compiled.status !== "compiled") throw new Error("Expected the authored manoeuvre to compile.");
  return { run, plan: compiled.plan };
}

function improvisationWithOutcome(
  outcome: "SUCCESS" | "SETBACK",
  methodId: ImprovisationMethodId,
): Readonly<{ before: LivingDungeon; after: LivingDungeon; plan: CanonicalWitnessGatePlan }> {
  for (let seed = 0; seed < 500; seed++) {
    const { run, plan } = declaredImprovisation(seed, `improv-${outcome.toLocaleLowerCase("en")}-${seed}`, methodId);
    const after = transitionLivingDungeon(run, { type: "execute-improvisation", plan });
    if (after.lastAction === `improvisation-${outcome.toLocaleLowerCase("en")}`) {
      return { before: run, after, plan };
    }
  }
  throw new Error(`Expected to find a deterministic ${outcome} seed.`);
}

test("the first-room intent is a canonical save fact while normal combat remains available", () => {
  const fresh = createLivingDungeon(101, "intent-declaration");
  assert.deepEqual(availableLivingDungeonActions(fresh), ["declare-intent", "engage"]);
  const selection = improvisationSelection("CUNNING");
  const declared = transitionLivingDungeon(fresh, { type: "declare-intent", selection });
  assert.equal(declared.revision, 1);
  assert.deepEqual(livingDungeonIntentSelection(declared), selection);
  assert.deepEqual(availableLivingDungeonActions(declared), ["execute-improvisation", "engage"]);
  assert.ok(declared.facts.some((fact) => fact.type === "PLAYER_INTENT_DECLARED"));
  assert.ok(isLivingDungeon(JSON.parse(JSON.stringify(declared))));
  assert.strictEqual(
    transitionLivingDungeon(declared, { type: "declare-intent", selection }),
    declared,
    "the world can be shaped only once",
  );

  const fallback = transitionLivingDungeon(declared, { type: "engage" });
  assert.equal(fallback.phase, "combat");
  assert.deepEqual(livingDungeonIntentSelection(fallback), selection);
  assert.ok(isLivingDungeon(fallback));
});

test("a canonical improvisation pays exact costs and can nonlethally bypass the warmup", () => {
  const { before, after, plan } = improvisationWithOutcome("SUCCESS", "MERCY");
  assert.equal(after.phase, "room-cleared");
  assert.equal(after.encounter?.hp, 0);
  assert.equal(after.player.potions, before.player.potions - 1);
  assert.equal(after.player.gold, before.player.gold);
  assert.equal(after.facts.some((fact) => fact.type === "ENEMY_DEFEATED"), false);
  const bypass = after.facts.find((fact) => fact.type === "ENCOUNTER_BYPASSED");
  assert.equal(bypass?.subjectId, "grave-attendant");
  assert.equal(bypass?.valueId, "CARTOGRAPHER_FREED");
  assert.equal(after.facts.filter((fact) => fact.type === "IMPROVISATION_EXECUTED").length, 1);
  assert.ok(isLivingDungeon(JSON.parse(JSON.stringify(after))));
  assert.deepEqual(
    transitionLivingDungeon(before, { type: "execute-improvisation", plan }),
    after,
    "the bounded resolver replays exactly",
  );

  const next = transitionLivingDungeon(after, { type: "continue" });
  assert.equal(next.phase, "pact");
  assert.ok(isLivingDungeon(next), "a nonlethal bypass satisfies room progression without inventing a kill");
});

test("an improvisation setback starts combat and its witnessed method can shape the later boss belief", () => {
  const { before, after } = improvisationWithOutcome("SETBACK", "RISK");
  assert.equal(after.phase, "combat");
  assert.equal(after.encounter?.hp, after.encounter?.maxHp);
  assert.ok(after.player.hp < before.player.hp);
  assert.deepEqual(after.witness.observedTags, [], "the later Scrivener has not received the first-room report yet");
  const observed = after.facts.find((fact) => fact.type === "ACTION_OBSERVED");
  assert.equal(observed?.roomId, "warmup");
  assert.equal(observed?.subjectId, "MASKED_WARDEN");
  assert.equal(observed?.valueId, "GAMBLES_WITH_STORM");
  const risk = WITNESS_GATE_MANOEUVRES.RESCUE_STORM_RELAY;
  assert.equal(after.player.hp, before.player.hp - risk.cost.hp - risk.setbackHp);
  assert.ok(availableLivingDungeonActions(after).includes("storm"), "the HP cost does not invent or consume a combat Storm charge");
  assert.ok(isLivingDungeon(after));

  let run = oneHit(after);
  run = transitionLivingDungeon(run, { type: "continue" });
  run = transitionLivingDungeon(run, { type: "decline-pact" });
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  run = transitionLivingDungeon(run, { type: "continue" });
  assert.equal(run.roomId, "witness");
  assert.deepEqual(run.witness.observedTags, ["STORM"]);
  const relay = run.facts.find((fact) => fact.type === "REPORT_RELAYED");
  assert.equal(relay?.subjectId, "dungeon-scrivener");
  assert.equal(relay?.sourceFactIds[0], observed?.id);
  assert.equal(relay?.valueId, "GAMBLES_WITH_STORM");
  run = transitionLivingDungeon(run, { type: "engage" });
  run = { ...run, encounter: { ...run.encounter!, hp: Math.floor(run.encounter!.maxHp / 2) } };
  run = transitionLivingDungeon(run, { type: "spare-witness" });
  assert.equal(run.beliefs[0]?.claimId, "PLAYER_RELIES_ON_STORM");
  assert.ok(run.beliefs[0]?.sourceFactIds.includes(relay!.id));
  assert.ok(isLivingDungeon(run));
  assert.equal(isLivingDungeon({
    ...run,
    facts: run.facts.filter((fact) => fact.type !== "REPORT_RELAYED"),
  }), false, "a later belief cannot skip the explicit Masked Warden → Scrivener relay");
  assert.equal(isLivingDungeon({
    ...run,
    facts: run.facts.map((fact) => fact.id === observed?.id
      ? { ...fact, subjectId: "dungeon-scrivener" }
      : fact),
  }), false, "save validation rejects rewriting the first-room observer's identity");
});

test("improvisation plans are revision-bound and save validation rejects altered outcomes", () => {
  const { before, after, plan } = improvisationWithOutcome("SUCCESS", "FORCE");
  const stale = { ...before, revision: before.revision + 1 };
  assert.strictEqual(transitionLivingDungeon(stale, { type: "execute-improvisation", plan }), stale);

  const execution = after.facts.find((fact) => fact.type === "IMPROVISATION_EXECUTED")!;
  const alteredFacts = after.facts.map((fact) => fact === execution
    ? { ...fact, valueId: execution.valueId?.replace("SUCCESS", "SETBACK") ?? null }
    : fact);
  assert.equal(isLivingDungeon({ ...after, facts: alteredFacts }), false);
  assert.equal(isLivingDungeon({
    ...after,
    facts: after.facts.filter((fact) => fact.type !== "ENCOUNTER_BYPASSED"),
  }), false);
});

test("Pact V0 catalogue builds every legal combination deterministically and rejects cost-free sacrifices", () => {
  const run = enterPact();
  const snapshot = livingDungeonPactEligibility(run);
  assert.match(pactEligibilityDigest(snapshot), /^[a-f0-9]{8}$/);
  for (const boon of PACT_DESIRED_BOONS) {
    for (const sacrifice of PACT_SACRIFICES) {
      const intent = baseIntent(boon, sacrifice);
      const first = buildPactOffer(intent, snapshot, 44);
      const repeated = buildPactOffer({ ...intent, breachTolerance: "LOW" }, snapshot, 44);
      assert.equal(first.status, "offered");
      assert.deepEqual(first, repeated, "breach rhetoric cannot improve or alter the catalogue offer");
      if (first.status !== "offered") continue;
      assert.equal(first.offer.terms.restrictionId, sacrifice);
      assert.equal(first.offer.boundRevision, run.revision);
    }
  }
  assert.equal(standardLivingDungeonPactOffers(run, 11).length, 3);

  const trivial = {
    ...snapshot,
    stormAvailable: false,
    potions: 0,
    voluntaryHealingOpportunities: 0,
    gold: 0,
    campAhead: false,
    damagingRoomsBeforeBoss: 0,
  };
  assert.deepEqual(buildPactOffer(baseIntent("DAMAGE", "NO_STORM"), trivial, 1), {
    status: "unavailable",
    reason: "Storm must be available in at least one remaining fight.",
  });
  assert.equal(buildPactOffer({ ...baseIntent("DEFENSE", "NO_STORM"), needsClarification: true }, snapshot, 1).status, "clarification");
});

test("offers are revision-bound and accepted pacts have deterministic, finite boon state", () => {
  const run = enterPact(72, "acceptance");
  const snapshot = livingDungeonPactEligibility(run);
  const built = buildPactOffer(baseIntent("DAMAGE", "NO_STORM"), snapshot, 9);
  assert.equal(built.status, "offered");
  if (built.status !== "offered") return;
  assert.equal(acceptPactOffer(built.offer, run.runId, run.revision + 1, { ...snapshot, revision: run.revision + 1 }), null);
  const pact = acceptPactOffer(built.offer, run.runId, run.revision, snapshot);
  assert.ok(pact);
  assert.equal(pact.boonUsesRemaining, 2);
  assert.equal(acceptPactOffer({
    ...built.offer,
    terms: { ...built.offer.terms, pactId: "pact-deadbeef" },
  }, run.runId, run.revision, snapshot), null, "canonical terms cannot be replaced inside a valid envelope");

  const first = applyBossDamageBoon(pact, 10);
  assert.equal(first.damage, 11);
  assert.equal(first.pact?.boonUsesRemaining, 1);
  const missed = applyBossDamageBoon(first.pact, 0);
  assert.equal(missed.damage, 0);
  assert.strictEqual(missed.pact, first.pact, "a zero-damage Storm does not spend a damaging-action boon use");
  const second = applyBossDamageBoon(first.pact, 20);
  assert.equal(second.damage, 23);
  const spent = applyBossDamageBoon(second.pact, 20);
  assert.equal(spent.damage, 20);

  const defense = buildPactOffer(baseIntent("DEFENSE", "NO_STORM"), snapshot, 10);
  assert.equal(defense.status, "offered");
  if (defense.status === "offered") {
    const accepted = acceptPactOffer(defense.offer, run.runId, run.revision, snapshot)!;
    assert.equal(applyBossRetaliationBoon(accepted, 9).damage, 4);
  }
  const entry = buildPactOffer(baseIntent("ENTRY_HEAL", "NO_STORM"), snapshot, 11);
  assert.equal(entry.status, "offered");
  if (entry.status === "offered") {
    const accepted = acceptPactOffer(entry.offer, run.runId, run.revision, snapshot)!;
    const healed = applyBossEntryBoon(accepted, 87, 100);
    assert.equal(healed.hp, 100);
    assert.equal(healed.healed, 13);
    assert.deepEqual(applyBossEntryBoon(healed.pact, healed.hp, 100), { pact: healed.pact, hp: 100, healed: 0 });
  }
});

test("negotiation permits one revision and rejects repeated attempts without changing state", () => {
  let run = enterPact(79, "offer-limit");
  run = transitionLivingDungeon(run, { type: "prepare-pact", intent: baseIntent("DEFENSE", "NO_STORM"), offerSeed: 1 });
  assert.equal(run.pactOfferAttempts, 1);
  run = transitionLivingDungeon(run, { type: "prepare-pact", intent: baseIntent("DAMAGE", "NO_STORM"), offerSeed: 2 });
  assert.equal(run.pactOfferAttempts, 2);
  const exhausted = run;
  assert.strictEqual(
    transitionLivingDungeon(run, { type: "prepare-pact", intent: baseIntent("ENTRY_HEAL", "NO_STORM"), offerSeed: 3 }),
    exhausted,
  );
});

test("the one AI clarification is canonical, survives reload, and cannot be repeated", () => {
  const pactRoom = enterPact(78, "clarification-limit");
  assert.strictEqual(
    transitionLivingDungeon(pactRoom, { type: "record-pact-clarification" }),
    pactRoom,
    "clarification cannot precede the interpretation it clarifies",
  );
  const first = transitionLivingDungeon(pactRoom, { type: "record-pact-interpretation" });
  const clarified = transitionLivingDungeon(first, { type: "record-pact-clarification" });
  assert.equal(clarified.pactClarificationAttempts, 1);
  assert.equal(clarified.pactInterpretationAttempts, 1);
  assert.ok(clarified.facts.some((fact) => fact.type === "PACT_CLARIFICATION_REQUESTED"));
  assert.strictEqual(transitionLivingDungeon(clarified, { type: "record-pact-clarification" }), clarified);
  const followup = transitionLivingDungeon(clarified, { type: "record-pact-interpretation" });
  assert.equal(followup.pactInterpretationAttempts, 2);
  assert.strictEqual(transitionLivingDungeon(followup, { type: "record-pact-interpretation" }), followup);
  assert.equal(followup.facts.filter((fact) => fact.type === "PACT_INTERPRETATION_REQUESTED").length, 2);
  assert.ok(isLivingDungeon(JSON.parse(JSON.stringify(followup))));
});

test("requesting an interpreted revision clears the stale revision-bound offer", () => {
  let run = enterPact(92, "interpret-revision");
  run = transitionLivingDungeon(run, {
    type: "prepare-pact",
    intent: baseIntent("DEFENSE", "NO_STORM"),
    offerSeed: 1,
  });
  assert.ok(run.pendingOffer);
  const oldRevision = run.pendingOffer.boundRevision;
  run = transitionLivingDungeon(run, { type: "record-pact-interpretation" });
  assert.equal(run.revision, oldRevision + 1);
  assert.equal(run.pendingOffer, null);
  assert.ok(isLivingDungeon(run));
  const revised = transitionLivingDungeon(run, {
    type: "prepare-pact",
    intent: baseIntent("DAMAGE", "NO_STORM"),
    offerSeed: 2,
  });
  assert.ok(revised.pendingOffer);
  assert.equal(revised.pendingOffer.boundRevision, revised.revision);
  assert.ok(isLivingDungeon(revised));

  const clarification = transitionLivingDungeon(revised, { type: "record-pact-clarification" });
  assert.equal(clarification.pendingOffer, null);
  assert.ok(isLivingDungeon(clarification));
});

test("the engine persists the actual critical result even when lethal damage is capped", () => {
  let criticalRun: LivingDungeon | null = null;
  for (let seed = 0; seed < 1_000 && !criticalRun; seed++) {
    let candidate = transitionLivingDungeon(createLivingDungeon(seed, `critical-${seed}`), { type: "engage" });
    candidate = { ...candidate, encounter: { ...candidate.encounter!, hp: 1 } };
    candidate = transitionLivingDungeon(candidate, { type: "attack" });
    if (candidate.lastCombatOutcome?.critical) criticalRun = candidate;
  }
  assert.ok(criticalRun, "the deterministic seed range contains a critical opening attack");
  assert.equal(criticalRun.lastCombatOutcome?.action, "attack");
  assert.equal(criticalRun.lastCombatOutcome?.damageDealt, 1);
  assert.equal(criticalRun.lastCombatOutcome?.enemyDefeated, true);
  assert.equal(criticalRun.lastCombatOutcome?.revision, criticalRun.revision);
  assert.ok(isLivingDungeon(JSON.parse(JSON.stringify(criticalRun))));
  assert.equal(isLivingDungeon({
    ...criticalRun,
    lastCombatOutcome: { ...criticalRun.lastCombatOutcome!, action: "storm", critical: true },
  }), false);
});

test("automatic healing keeps the promise while a voluntary breach is confirmed and applied exactly once", () => {
  const pactRun = enterPact(73, "breach");
  let run = acceptTestPact(pactRun, baseIntent("ENTRY_HEAL", "NO_VOLUNTARY_HEALING"));
  run = transitionLivingDungeon(run, { type: "engage" });
  run = { ...run, player: { ...run.player, hp: 60 } };
  const beforeWarning = run;
  run = transitionLivingDungeon(run, { type: "potion" });
  assert.ok(run.pendingBreach);
  assert.equal(run.player.hp, 60, "the warned action has not happened yet");
  assert.equal(run.pact?.status, "ACTIVE");
  const warningRevision = run.revision;

  const confirmed = transitionLivingDungeon(run, { type: "confirm-breach" });
  assert.equal(confirmed.pact?.status, "BREACHED");
  assert.equal(confirmed.player.potions, beforeWarning.player.potions - 1);
  assert.equal(confirmed.pendingBreach, null);
  assert.equal(confirmed.facts.filter((fact) => fact.type === "PACT_BREACHED").length, 1);
  const breachFact = confirmed.facts.find((fact) => fact.type === "PACT_BREACHED")!;
  const actionFact = confirmed.facts.find((fact) => fact.type === "PLAYER_ACTION" && fact.actionId === breachFact.actionId);
  assert.ok(actionFact, "the confirmed breach and executed action share one canonical action ID");
  assert.strictEqual(transitionLivingDungeon(confirmed, { type: "confirm-breach" }, warningRevision), confirmed);
  assert.equal(checkPactAction(confirmed.pact, {
    actionId: "system-heal", tag: "AUTOMATIC_HEALING", source: "SYSTEM", roomId: "boss",
  }).requiresBreachConfirmation, false);

  const rawPact = beforeWarning.pact!;
  const violating = { actionId: "same-action", tag: "VOLUNTARY_HEALING", source: "PLAYER", roomId: "pressure" } as const;
  const breached = confirmPactBreach(rawPact, violating, 20);
  assert.strictEqual(confirmPactBreach(breached, violating, 21), breached);
  assert.equal(completePact(breached, 22)?.status, "BREACHED");
});

test("a camp Bandage is both a purchase and voluntary healing for the relevant promise", () => {
  for (const [restriction, expectedTag] of [
    ["NO_CAMP_PURCHASE", "PURCHASE"],
    ["NO_VOLUNTARY_HEALING", "VOLUNTARY_HEALING"],
  ] as const) {
    let run = reachCamp(baseIntent("DEFENSE", restriction), `bandage-${restriction.replaceAll("_", "-")}`);
    run = { ...run, player: { ...run.player, hp: 50 } };
    const warned = transitionLivingDungeon(run, { type: "camp-buy", item: "BANDAGE" });
    assert.ok(warned.pendingBreach);
    assert.equal(warned.pendingBreach.pactAction.tag, expectedTag);
    assert.ok(isLivingDungeon(warned), "a pending Bandage warning remains saveable");
    assert.equal(warned.player.gold, run.player.gold);
    const confirmed = transitionLivingDungeon(warned, { type: "confirm-breach" });
    assert.equal(confirmed.pact?.status, "BREACHED");
    assert.equal(confirmed.player.hp, 75);
    assert.equal(confirmed.player.gold, run.player.gold - 20);
    assert.equal(confirmed.facts.filter((fact) => fact.type === "PACT_BREACHED").length, 1);
    const breach = confirmed.facts.find((fact) => fact.type === "PACT_BREACHED")!;
    assert.ok(confirmed.facts.some((fact) => fact.type === "PLAYER_ACTION" && fact.actionId === breach.actionId));
    const empoweredBoss = transitionLivingDungeon(confirmed, { type: "camp-skip" });
    assert.equal(empoweredBoss.encounter?.maxHp, 102);
    assert.equal(empoweredBoss.encounter?.hp, 102);
    assert.ok(isLivingDungeon(empoweredBoss));
  }
});

test("a surviving witness creates a bounded belief, a visible boss clue, and a replayable completion", () => {
  let run = acceptTestPact(enterPact(74, "witness-path"));
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  run = transitionLivingDungeon(run, { type: "continue" });
  assert.equal(run.roomId, "witness");
  run = transitionLivingDungeon(run, { type: "engage" });
  run = { ...run, encounter: { ...run.encounter!, hp: Math.floor(run.encounter!.maxHp / 2) } };
  run = transitionLivingDungeon(run, { type: "attack" });
  if (run.phase === "combat") run = transitionLivingDungeon(run, { type: "spare-witness" });
  assert.equal(run.witness.outcome, "SPARED");
  assert.equal(run.beliefs.length, 1);
  assert.equal(run.beliefs[0].claimId, "PLAYER_AVOIDS_STORM");
  run = transitionLivingDungeon(run, { type: "continue" });
  assert.equal(run.phase, "camp");
  run = transitionLivingDungeon(run, { type: "camp-skip" });
  assert.equal(run.roomId, "boss");
  assert.equal(run.bossPreparation, "PHYSICAL_BULWARK");
  assert.match(bossPreparationClue(run.bossPreparation), /iron plates/i);
  assert.ok(run.facts.some((fact) => fact.type === "BOSS_PREPARED" && fact.sourceFactIds.length > 0));
  assert.ok(run.facts.some((fact) => fact.type === "CLUE_REVEALED"));
  assert.deepEqual(livingDungeonCombatPreview(run).attack, [6, 9]);
  assert.deepEqual(livingDungeonCombatPreview(run).storm, [0, 25]);
  assert.deepEqual(livingDungeonCombatPreview(run).retaliation, [4, 6]);
  assert.deepEqual(livingDungeonCombatPreview(run).potionRetaliation, [2, 3]);
  assert.deepEqual(livingDungeonCombatPreview(run).flags, {
    bossPreparation: "PHYSICAL_BULWARK",
    damageBoonPercent: 100,
    damageBoonUsesRemaining: 0,
    retaliationBoonPercent: 50,
    retaliationBoonUsesRemaining: 1,
    potionRetaliationMode: "HALF",
  });
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  assert.equal(run.phase, "won");
  assert.equal(run.pact?.status, "COMPLETED");
  assert.ok(isLivingDungeon(run));

  let replay = acceptTestPact(enterPact(74, "witness-path"));
  replay = transitionLivingDungeon(replay, { type: "engage" });
  replay = oneHit(replay);
  replay = transitionLivingDungeon(replay, { type: "continue" });
  replay = transitionLivingDungeon(replay, { type: "engage" });
  replay = { ...replay, encounter: { ...replay.encounter!, hp: Math.floor(replay.encounter!.maxHp / 2) } };
  replay = transitionLivingDungeon(replay, { type: "attack" });
  if (replay.phase === "combat") replay = transitionLivingDungeon(replay, { type: "spare-witness" });
  replay = transitionLivingDungeon(replay, { type: "continue" });
  replay = transitionLivingDungeon(replay, { type: "camp-skip" });
  replay = transitionLivingDungeon(replay, { type: "engage" });
  replay = oneHit(replay);
  assert.deepEqual(replay, run);
});

test("defeating the witness leaves facts intact but gives the boss no invented knowledge", () => {
  let run = acceptTestPact(enterPact(75, "silent-path"));
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  run = transitionLivingDungeon(run, { type: "continue" });
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  assert.equal(run.witness.outcome, "DEFEATED");
  assert.deepEqual(run.beliefs, []);
  run = transitionLivingDungeon(run, { type: "continue" });
  run = transitionLivingDungeon(run, { type: "camp-skip" });
  assert.equal(run.bossPreparation, "NONE");
  assert.ok(run.facts.some((fact) => fact.type === "ACTION_OBSERVED"));
  assert.ok(run.facts.some((fact) => fact.type === "WITNESS_DEFEATED"));
  assert.ok(isLivingDungeon(run));
});

test("the witness carries one bounded observation rather than omniscient combat history", () => {
  let run = acceptTestPact(enterPact(82, "bounded-witness"), baseIntent("DEFENSE", "NO_CAMP_PURCHASE"));
  run = transitionLivingDungeon(run, { type: "engage" });
  run = oneHit(run);
  run = transitionLivingDungeon(run, { type: "continue" });
  run = transitionLivingDungeon(run, { type: "engage" });
  run = { ...run, player: { ...run.player, hp: 50 } };
  run = transitionLivingDungeon(run, { type: "attack" });
  run = transitionLivingDungeon(run, { type: "potion" });
  assert.equal(run.facts.filter((fact) => fact.type === "ACTION_OBSERVED").length, 1);
  assert.deepEqual(run.witness.observedTags, ["ATTACK"]);
  run = { ...run, encounter: { ...run.encounter!, hp: Math.floor(run.encounter!.maxHp / 2) } };
  run = transitionLivingDungeon(run, { type: "spare-witness" });
  assert.equal(run.beliefs[0]?.claimId, "PLAYER_AVOIDS_STORM");
});

test("combat preview includes the next boss boon and healing-pressure retaliation", () => {
  let damage = reachCamp(baseIntent("DAMAGE", "NO_STORM"), "damage-preview");
  damage = transitionLivingDungeon(damage, { type: "camp-skip" });
  const boosted = livingDungeonCombatPreview(damage);
  assert.deepEqual(boosted.attack, [9, 13]);
  assert.deepEqual(boosted.storm, [0, 23]);
  assert.equal(boosted.flags.damageBoonPercent, 115);
  assert.equal(boosted.flags.damageBoonUsesRemaining, 2);

  let pressure = enterPact(81, "healing-pressure");
  pressure = transitionLivingDungeon(pressure, { type: "decline-pact" });
  pressure = transitionLivingDungeon(pressure, { type: "engage" });
  pressure = oneHit(pressure);
  pressure = transitionLivingDungeon(pressure, { type: "continue" });
  pressure = transitionLivingDungeon(pressure, { type: "engage" });
  pressure = {
    ...pressure,
    player: { ...pressure.player, hp: 50 },
    encounter: { ...pressure.encounter!, hp: Math.floor(pressure.encounter!.maxHp / 2) },
  };
  pressure = transitionLivingDungeon(pressure, { type: "potion" });
  pressure = transitionLivingDungeon(pressure, { type: "spare-witness" });
  assert.equal(pressure.beliefs[0]?.claimId, "PLAYER_GUARDS_LIFE");
  pressure = transitionLivingDungeon(pressure, { type: "continue" });
  pressure = transitionLivingDungeon(pressure, { type: "camp-skip" });
  const punished = livingDungeonCombatPreview(pressure);
  assert.equal(punished.flags.bossPreparation, "HEALING_PRESSURE");
  assert.equal(punished.flags.potionRetaliationMode, "FULL");
  assert.deepEqual(punished.potionRetaliation, punished.retaliation);
});

test("a late breach still creates the disclosed boss debt after every opening boon use is spent", () => {
  let run = reachCamp(baseIntent("DAMAGE", "NO_STORM"), "late-breach-debt");
  run = transitionLivingDungeon(run, { type: "camp-skip" });
  run = transitionLivingDungeon(run, { type: "engage" });
  run = transitionLivingDungeon(run, { type: "attack" });
  run = transitionLivingDungeon(run, { type: "attack" });
  assert.equal(run.pact?.boonUsesRemaining, 0);
  assert.ok(run.encounter && run.encounter.hp > 0);
  const beforeBreach = run.encounter;
  const warned = transitionLivingDungeon(run, { type: "storm" });
  assert.ok(warned.pendingBreach);
  assert.deepEqual(warned.encounter, beforeBreach, "the warning itself does not change the boss");
  const confirmed = transitionLivingDungeon(warned, { type: "confirm-breach" });
  assert.equal(confirmed.pact?.status, "BREACHED");
  assert.equal(confirmed.encounter?.maxHp, beforeBreach.maxHp + 20);
  assert.equal(
    confirmed.encounter?.hp,
    beforeBreach.hp + 20 - (confirmed.lastCombatOutcome?.damageDealt ?? 0),
  );
  assert.ok(isLivingDungeon(confirmed));
});

test("fact ledgers are append-only and conflicting reuse of an event ID is rejected", () => {
  const draft = {
    type: "ROOM_ENTERED" as const, revision: 0, roomId: "warmup", subjectId: "PLAYER",
    actionId: null, actionTag: null, valueId: "warmup", sourceFactIds: [] as readonly string[], key: "warmup",
  };
  const fact = createDungeonFact("ledger", draft);
  const once = appendDungeonFact([], fact);
  assert.strictEqual(appendDungeonFact(once, fact), once);
  assert.throws(() => appendDungeonFact(once, { ...fact, valueId: "rewritten" }), /Conflicting dungeon fact/);
  assert.throws(() => appendDungeonFact(once, {
    ...fact, id: "ledger:older", revision: -1,
  }), /Out-of-order dungeon fact/);
});

test("Living Dungeon storage restores canonical state, rejects stale writers, and preserves corrupt data", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const run = createLivingDungeon(76, "storage");
  assert.ok(isLivingDungeon(run));
  assert.equal(saveLivingDungeon(storage, run, null), "saved");
  assert.deepEqual(loadLivingDungeon(storage), { status: "restored", run });
  const engaged = transitionLivingDungeon(run, { type: "engage" });
  assert.equal(saveLivingDungeon(storage, engaged, run), "saved");
  assert.equal(saveLivingDungeon(storage, engaged, run), "conflict");

  const pactRoom = enterPact(77, "storage-pact");
  assert.ok(isLivingDungeon(pactRoom));
  assert.equal(saveLivingDungeon(storage, pactRoom, null, true), "saved");
  assert.deepEqual(loadLivingDungeon(storage), { status: "restored", run: pactRoom });
  const camp = transitionLivingDungeon(
    transitionLivingDungeon(
      oneHit(transitionLivingDungeon(transitionLivingDungeon(pactRoom, { type: "decline-pact" }), { type: "engage" })),
      { type: "continue" },
    ),
    { type: "engage" },
  );
  const campReady = transitionLivingDungeon(oneHit(camp), { type: "continue" });
  assert.equal(campReady.phase, "camp");
  assert.ok(isLivingDungeon(campReady));
  assert.equal(saveLivingDungeon(storage, campReady, pactRoom, true), "saved");
  assert.deepEqual(loadLivingDungeon(storage), { status: "restored", run: campReady });

  const corrupt = JSON.stringify({ ...run, rulesVersion: "future-rules" });
  values.set(LIVING_DUNGEON_SAVE_KEY, corrupt);
  assert.deepEqual(loadLivingDungeon(storage), { status: "invalid" });
  assert.equal(saveLivingDungeon(storage, run, null), "conflict");
  assert.equal(values.get(LIVING_DUNGEON_SAVE_KEY), corrupt);
  assert.deepEqual(loadLivingDungeon(() => { throw new Error("blocked"); }), { status: "unavailable" });

  const offerRun = transitionLivingDungeon(enterPact(88, "tampered-offer"), {
    type: "prepare-pact", intent: baseIntent("DEFENSE", "NO_STORM"), offerSeed: 4,
  });
  assert.ok(offerRun.pendingOffer);
  assert.equal(isLivingDungeon({
    ...offerRun,
    pendingOffer: { ...offerRun.pendingOffer, terms: { ...offerRun.pendingOffer!.terms, pactId: "pact-deadbeef" } },
  }), false);

  const acceptedRun = acceptTestPact(enterPact(89, "timeline-source"));
  const acceptedFact = acceptedRun.facts.find((fact) => fact.type === "PACT_ACCEPTED")!;
  const fresh = createLivingDungeon(89, "timeline-source");
  assert.equal(isLivingDungeon({
    ...fresh,
    revision: acceptedRun.pact!.acceptedAtRevision,
    pact: acceptedRun.pact,
    facts: [...fresh.facts, acceptedFact],
  }), false, "an accepted pact cannot be grafted onto the warm-up room");
  assert.equal(isLivingDungeon({
    ...acceptedRun,
    pact: { ...acceptedRun.pact!, acceptedAtRevision: acceptedRun.pact!.acceptedAtRevision - 1 },
  }), false, "accepted pact state must match its canonical acceptance fact");

  let campPact = reachCamp(
    baseIntent("DEFENSE", "NO_CAMP_PURCHASE"),
    "pending-camp-validation",
  );
  campPact = { ...campPact, player: { ...campPact.player, hp: 50 } };
  const campWarning = transitionLivingDungeon(campPact, { type: "camp-buy", item: "BANDAGE" });
  assert.ok(campWarning.pendingBreach);
  assert.ok(isLivingDungeon(campWarning));
  assert.equal(isLivingDungeon({
    ...campWarning,
    player: { ...campWarning.player, gold: 0 },
  }), false, "a restored pending purchase must remain affordable");
  assert.equal(isLivingDungeon({
    ...campWarning,
    pendingBreach: {
      ...campWarning.pendingBreach!,
      pactAction: { ...campWarning.pendingBreach!.pactAction, actionId: `${campWarning.runId}:tampered` },
    },
  }), false, "a restored breach must retain the canonical pending action ID");
  assert.ok(isLivingDungeon(transitionLivingDungeon(campWarning, { type: "confirm-breach" })));
});

test("the shared Web Lock keeps a busy tab from entering the Living Dungeon compare-and-write section", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const current = createLivingDungeon(90, "locked-save");
  const next = transitionLivingDungeon(current, { type: "engage" });
  assert.equal(saveLivingDungeon(storage, current, null), "saved");
  let held = true;
  let writes = 0;
  const locks: SaveLocks = {
    async request(name, options, callback) {
      assert.equal(name, LIVING_DUNGEON_SAVE_KEY);
      assert.deepEqual(options, { ifAvailable: true });
      return callback(held ? null : { name });
    },
  };
  const write = () => {
    writes++;
    return saveLivingDungeon(storage, next, current);
  };
  assert.equal(await exclusiveSave(write, locks, LIVING_DUNGEON_SAVE_KEY), "busy");
  assert.equal(writes, 0);
  assert.deepEqual(loadLivingDungeon(storage), { status: "restored", run: current });
  held = false;
  assert.equal(await exclusiveSave(write, locks, LIVING_DUNGEON_SAVE_KEY), "saved");
  assert.equal(writes, 1);
  assert.deepEqual(loadLivingDungeon(storage), { status: "restored", run: next });
});
