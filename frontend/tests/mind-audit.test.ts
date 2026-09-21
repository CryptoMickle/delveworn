import test from "node:test";
import assert from "node:assert/strict";
import { createRun, operationError, transition } from "../app/living-dungeon/mind/engine";
import { record, prepareReport } from "../app/living-dungeon/mind/knowledge";
import { buildRoom, canSee, entity, playerEntity } from "../app/living-dungeon/mind/world";
import { compilePlan, generalizeManeuver, previewPlan, suggestedBoundary, canSaveManeuver } from "../app/living-dungeon/mind/planning";
import { createRun as createV3, transition as transitionV3 } from "../app/living-dungeon/mind/legacy-v3/engine";
import { bind as bindV3 } from "../app/living-dungeon/mind/legacy-v3/protocol";
import { hash } from "../app/living-dungeon/mind/protocol";
import { decodeSave, envelope } from "../app/living-dungeon/mind/storage";
import type { Maneuver } from "../app/living-dungeon/mind/types";
const taught = () => transition(createRun(12, "audit"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
test("facts snapshot coordinates and sources instead of retaining live world objects", () => {
  const run = taught(), p = playerEntity(run.room), sources = ["a"];
  const fact = record(run, { actor: "world", kind: "room", at: p, cost: 0, value: 0, private: false, sources, text: "Here" });
  p.x++; sources.push("b"); assert.deepEqual(fact.at, { x: 2, y: 6 }); assert.deepEqual(fact.sources, ["a"]);
});
test("props cannot witness forgery; seeing forgery is evidence of cunning, never Storm", () => {
  let run = taught();
  assert.equal(canSee(run.room, entity(run.room, "evidence")!, playerEntity(run.room)), false);
  run = transition(run, { type: "act", operation: { verb: "PLANT_EVIDENCE", target: "evidence", signature: "storm" } });
  assert.equal(entity(run.room, "evidence")!.suspicious, false);
  const w = entity(run.room, "guardian")!; Object.assign(w, { x: 3, y: 6 });
  run = transition(run, { type: "act", operation: { verb: "PLANT_EVIDENCE", target: "evidence", signature: "storm" } });
  assert.equal(entity(run.room, "evidence")!.suspicious, true);
  assert.ok(run.observations.some(o => o.signature === "cunning"));
  assert.ok(!run.observations.some(o => o.signature === "storm"));
});
test("hidden player does not hide a relic action at another visible location", () => {
  const run = taught(); run.player.hiddenUntil = 10;
  const fact = record(run, { actor: "relic", kind: "choice", at: { x: 9, y: 4 }, signature: "mercy", cost: 3, value: 0, private: false, sources: [], text: "Protect" });
  assert.ok(run.observations.some(o => o.factId === fact.id && o.observer.endsWith(":guardian")));
});
test("an interrupted report can be retold from surviving memory", () => {
  const run = taught(); run.room = buildRoom(12, 4, [], []);
  record(run, { actor: "player", kind: "action", at: { x: 8, y: 4 }, signature: "storm", cost: 4, value: 0, private: false, sources: [], text: "Storm" });
  assert.ok(prepareReport(run, "observer")); const observations = run.reports[0].observations;
  run.reports.forEach(r => { r.intercepted = true; });
  assert.ok(prepareReport(run, "observer")); assert.deepEqual(run.reports.at(-1)!.observations, observations);
});
test("interrupting reports requires an unobstructed line of sight", () => {
  const run = taught(); Object.assign(playerEntity(run.room), { x: 4, y: 3 }); Object.assign(entity(run.room, "relay")!, { x: 6, y: 3 });
  assert.match(operationError(run, { verb: "INTERRUPT_REPORT", target: "relay" })!, /sightline/);
});
test("a captive dying does not complete rescue or evidence objectives", () => {
  for (const goal of ["rescue", "evidence"] as const) {
    const run = taught(); run.room.goal = goal; run.room.captiveDeadline = 1; entity(run.room, "captive")!.hp = 1;
    const next = transition(run, { type: "act", operation: { verb: "WAIT" } });
    assert.equal(next.room.solved, false); assert.equal(entity(next.room, "captive")!.active, false);
  }
});
test("retreating from an Echo does not claim victory", () => {
  const run = taught(); run.room = buildRoom(12, 11, [], []); Object.assign(playerEntity(run.room), { x: 8, y: 7 });
  const plan = compilePlan(run, [{ verb: "RETREAT" }]);
  assert.match(previewPlan(run, plan).outcome, /leave|retreat/i);
  const next = transition(run, { type: "act", operation: { verb: "RETREAT" } }); assert.equal(next.echoes, 0);
});
test("revealing the same recovered memory cannot replenish energy repeatedly", () => {
  let run = taught(); run.room.goal = "evidence"; run.relic.energy = 3;
  run = transition(run, { type: "act", operation: { verb: "REVEAL_EVIDENCE", target: "evidence" } });
  assert.equal(run.relic.energy, 6);
  run = transition(run, { type: "act", operation: { verb: "REVEAL_EVIDENCE", target: "evidence" } }); assert.equal(run.relic.energy, 6);
});
test("recovery preserves dead people, broken objects, chosen room and fulfilled favors", () => {
  const run = taught(); run.room = buildRoom(12, 15, [], [], "garden");
  entity(run.room, "captive")!.active = false; entity(run.room, "captive")!.hp = 0; entity(run.room, "relay")!.active = false;
  run.status = "fallen"; run.player.hp = 0;
  const next = transition(run, { type: "recover" });
  assert.equal(next.room.family, run.room.family); assert.equal(entity(next.room, "captive")!.hp, 0);
  assert.equal(entity(next.room, "relay")!.active, false); assert.equal(next.player.hp, 24);
  assert.equal(playerEntity(next.room).hp, 24); assert.equal(next.lastSequence, null);
});
test("hazards produce durable damage facts and the relic cannot revive a fallen player", () => {
  const run = taught(); run.room.hazards = [{ x: 2, y: 6 }]; run.player.hp = 2;
  const next = transition(run, { type: "act", operation: { verb: "WAIT" } });
  assert.equal(next.status, "fallen"); assert.equal(next.facts.at(-1)!.value, 2); assert.equal(next.facts.at(-1)!.kind, "harm");
  const depleted = taught(); depleted.player.hp = 3; depleted.relic.pendingChoice = { protect: true, sources: [] };
  assert.equal(transition(depleted, { type: "act", operation: { verb: "WAIT" } }).status, "fallen");
});
test("combat sequences have a savable boundary; walking alone is not a maneuver", () => {
  const run = taught(); run.lastSequence = { steps: [{ verb: "MOVE", at: { x: 2, y: 5 } }, { verb: "ATTACK", target: "guardian" }], facts: [], success: true, cost: 2 };
  assert.equal(suggestedBoundary(run), "none"); assert.ok(canSaveManeuver(run));
  const next = transition(run, { type: "save-maneuver", name: "Opening", boundary: suggestedBoundary(run) }); assert.equal(next.relic.maneuvers.length, 1);
  run.lastSequence.steps = [{ verb: "MOVE", at: { x: 2, y: 5 } }, { verb: "WAIT" }]; assert.equal(canSaveManeuver(run), false);
});
test("generalization preserves required objects and does not turn concealment into rescue", () => {
  const run = taught();
  const m: Maneuver = { id: "m", name: "Hide", intent: "conceal", steps: [{ verb: "HIDE" }], boundary: "no-harm", examples: [], counterexamples: [], corrections: [], contexts: ["bell"], cost: 0, risks: [], signature: "cunning", confidence: .5, uses: 1 };
  assert.ok(!generalizeManeuver(run, m).steps.some(s => s.verb === "RELEASE"));
  m.steps = [{ verb: "DISTRACT", role: "distraction" }, { verb: "HIDE" }]; entity(run.room, "distraction")!.active = false;
  assert.equal(previewPlan(run, generalizeManeuver(run, m)).legal, false);
});
test("version 3 history is preserved exactly across a version 4 upgrade and new actions", () => {
  let old = transitionV3(createV3(12, "v3-save"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
  old = transitionV3(old, { type: "commit", plan: { id: "p", name: "Keep me", boundary: "none", binding: bindV3(old), steps: [{ verb: "MOVE", at: { x: 2, y: 5 } }, { verb: "MOVE", at: { x: 2, y: 4 } }] } });
  old = transitionV3(old, { type: "step" });
  const data = { version: 3, rules: "mind-beneath-2", seed: old.seed, runId: old.runId, revision: old.revision, journal: old.journal };
  const migrated = decodeSave(JSON.stringify({ ...data, checksum: hash(data) }))!;
  assert.deepEqual(migrated, { ...old, version: 4, rules: "mind-beneath-3", upgradedAt: old.revision });
  const next = transition(migrated, { type: "step" }); assert.equal(next.activePlan, null);
  assert.deepEqual(decodeSave(JSON.stringify(envelope(next))), next);
  const save = envelope(next); save.upgradedAt = -1; const { checksum: _, ...invalid } = save; void _;
  assert.equal(decodeSave(JSON.stringify({ ...invalid, checksum: hash(invalid) })), null);
});
