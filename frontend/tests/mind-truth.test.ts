import test from "node:test";
import assert from "node:assert/strict";
import { createRun, transition } from "../app/living-dungeon/mind/engine";
import { deliverReports, dungeonKnowledge, inferHypotheses, prepareReport, record } from "../app/living-dungeon/mind/knowledge";
import { buildRoom, canSee, composeBoss, entity, lineOfSight, passable, pathTo, playerEntity } from "../app/living-dungeon/mind/world";
import type { Run } from "../app/living-dungeon/mind/types";

const taught = () => transition(createRun(12, "truth"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
test("all room variants keep people and interactive objects on reachable floor", () => {
  for (let seed = 0; seed < 12; seed++) for (let index = 0; index < 48; index++) {
    const room = buildRoom(seed, index, [], []);
    for (const target of room.entities) {
      assert.ok(passable(room, target), `${seed}/${index}: ${target.id} is inside a wall`);
      if (target.id !== "player") assert.ok(pathTo(room, playerEntity(room), target).length > 0, `${seed}/${index}: ${target.id} is unreachable`);
    }
  }
});
function witnessed(run: Run, signature: "storm" | "mercy" | "force" | "cunning" = "storm", cost = 4) {
  return record(run, { actor: "player", kind: "action", at: { x: 8, y: 4 }, signature, cost, value: 0, private: false, sources: [], text: `Performed ${signature}` });
}
test("private teaching is a fact but cannot enter observations, reports or antagonist projection", () => {
  const run = taught();
  assert.equal(run.facts.at(-1)?.private, true);
  assert.equal(run.observations.length, 0);
  assert.deepEqual(dungeonKnowledge(run), { theories: [], reports: [] });
  const corrected = transition(run, { type: "correct", principle: "protect", scope: "always" });
  assert.deepEqual(dungeonKnowledge(corrected), dungeonKnowledge(run));
});
test("walls, darkness, distraction and hidden actions have explicit visibility boundaries", () => {
  const run = taught(), w = entity(run.room, "guardian")!;
  assert.equal(lineOfSight(run.room, { x: 4, y: 4 }, { x: 6, y: 4 }), false);
  assert.equal(canSee(run.room, w, { x: 8, y: 4 }), true);
  assert.equal(canSee(run.room, w, { x: 9, y: 4 }, true), false);
  w.distracted = 2; assert.equal(canSee(run.room, w, { x: 8, y: 4 }), false);
  w.distracted = 0; run.room.light = false; assert.equal(canSee(run.room, w, { x: 9, y: 3 }), false);
});
test("facts, observations and local beliefs do not become dungeon knowledge before report delivery", () => {
  const run = taught(); run.room = buildRoom(12, 4, [], []);
  witnessed(run); assert.ok(run.observations.length > 0); assert.ok(run.beliefs.length > 0);
  assert.deepEqual(inferHypotheses(run), []);
  assert.equal(prepareReport(run, "observer"), true);
  assert.deepEqual(inferHypotheses(run), []);
  deliverReports(run, "observer");
  assert.ok(run.hypotheses.some(h => h.claim === "storm"));
  assert.ok(run.reports[0].observations.every(id => run.observations.some(o => o.id === id)));
});
test("intercepted reports never reach the mind", () => {
  const run = taught(); run.room = buildRoom(12, 4, [], []); witnessed(run); prepareReport(run, "observer");
  run.reports.forEach(r => { r.intercepted = true; }); deliverReports(run, "observer");
  assert.deepEqual(run.hypotheses, []);
});
test("costly consistent public identity creates counters; mixed noise and cheap traces do not", () => {
  const consistent = taught(), noisy = taught();
  for (let room = 4; room < 8; room++) {
    for (const run of [consistent, noisy]) {
      run.room = buildRoom(12, room, [], []);
      for (let i = 0; i < 2; i++) witnessed(run, "storm");
      if (run === noisy) for (const sig of ["mercy", "force", "cunning"] as const) witnessed(run, sig);
      prepareReport(run, "observer"); deliverReports(run, "observer");
    }
  }
  const strong = consistent.hypotheses.find(h => h.claim === "storm")!;
  assert.ok(strong.confidence > 0.65);
  assert.ok(noisy.hypotheses.find(h => h.claim === "storm")!.confidence < strong.confidence);
  const components = composeBoss(consistent.hypotheses);
  assert.ok(components.some(c => c.id === "storm-ward"));
  assert.ok(components.reduce((n, c) => n + c.cost, 0) <= 6);
  assert.ok(components.every(c => c.sources.every(id => consistent.reports.some(r => r.id === id && r.delivered !== null))));
  consistent.reports.forEach(r => { r.forged = true; r.cost = 0; });
  assert.deepEqual(composeBoss(inferHypotheses(consistent)), []);
});
test("two observed playstyles physically change later arenas", () => {
  const run = taught();
  for (let index = 4; index < 7; index++) { run.room = buildRoom(12, index, [], []); witnessed(run); witnessed(run); prepareReport(run, "observer"); deliverReports(run, "observer"); }
  const stormRoom = buildRoom(12, 7, run.hypotheses, []);
  const mercyRoom = buildRoom(12, 7, run.hypotheses.map(h => ({ ...h, claim: "mercy" })), []);
  assert.notDeepEqual(stormRoom.hazards, mercyRoom.hazards);
  assert.notDeepEqual(entity(stormRoom, "captive"), entity(mercyRoom, "captive"));
});
