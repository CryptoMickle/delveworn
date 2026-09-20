import test from "node:test";
import assert from "node:assert/strict";
import { chooseRelicPriority, createRun, transition } from "../app/living-dungeon/mind/engine";
import { compilePlan, generalizeManeuver, previewPlan, suggestions } from "../app/living-dungeon/mind/planning";
import { bind } from "../app/living-dungeon/mind/protocol";
import { buildRoom, entity } from "../app/living-dungeon/mind/world";
import { decodeSave, envelope, persist, replay, SAVE_KEY } from "../app/living-dungeon/mind/storage";
import type { Command, Run } from "../app/living-dungeon/mind/types";

const taught = () => transition(createRun(48, "learning"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
function act(run: Run, command: Command): Run { const next = transition(run, command); assert.notEqual(next, run, `Rejected ${JSON.stringify(command)}`); return next; }
function rescue(run: Run): Run {
  const suggestion = suggestions(run)[0], plan = compilePlan(run, suggestion.operations, { boundary: suggestion.boundary });
  const preview = previewPlan(run, plan); assert.equal(preview.legal, true, preview.reason ?? "");
  run = act(run, { type: "commit", plan });
  for (let i = 0; run.activePlan && i < 50; i++) run = act(run, { type: "step" });
  assert.equal(entity(run.room, "captive")?.freed, true);
  return run;
}
test("one engine drives plans and direct actions, with exact causal preview", () => {
  const run = taught(), suggestion = suggestions(run)[0];
  const plan = compilePlan(run, suggestion.operations, { boundary: suggestion.boundary }), preview = previewPlan(run, plan);
  assert.equal(preview.legal, true, preview.reason ?? "");
  let direct = run, planned = act(run, { type: "commit", plan });
  for (const operation of plan.steps) { direct = act(direct, { type: "act", operation }); planned = act(planned, { type: "step" }); }
  assert.deepEqual(direct.room, planned.room); assert.deepEqual(direct.player, planned.player);
  assert.equal(run.relic.energy - planned.relic.energy, preview.energyCost);
  assert.equal(run.player.hp - planned.player.hp, preview.healthCost);
});
test("personal maneuver is derived from successful actions and rebinds to different objects", () => {
  let run = rescue(taught());
  run = act(run, { type: "save-maneuver", name: "Stille nåde", boundary: "no-harm" });
  assert.ok(run.relic.maneuvers[0].steps.some(s => s.verb === "RELEASE"));
  run = act(run, { type: "correct-maneuver", id: run.relic.maneuvers[0].id, boundary: "no-harm" });
  run.room = buildRoom(48, 1, [], run.history); run.relic.energy = 20;
  const plan = generalizeManeuver(run, run.relic.maneuvers[0]);
  assert.equal(previewPlan(run, plan).legal, true);
  run = act(run, { type: "commit", plan });
  while (run.activePlan) run = act(run, { type: "step" });
  assert.equal(entity(run.room, "captive")!.freed, true);
  assert.ok(run.relic.maneuvers[0].contexts.includes("kiln"));
  assert.ok(run.chills.understood);
});
test("a correction changes the interpretation and removes the mistaken shield", () => {
  let run = taught(); run.relic.misunderstanding = true; entity(run.room, "guardian")!.protected = 4;
  run = act(run, { type: "correct", principle: "protect", scope: "innocent-at-risk" });
  assert.equal(run.relic.misunderstanding, false); assert.equal(entity(run.room, "guardian")!.protected, 0);
  assert.equal(run.relic.principles[0].corrections.length, 1); assert.equal(run.observations.length, 0);
});
test("destroyed objects interrupt a sealed plan without rewriting its next step", () => {
  let run = taught();
  const plan = compilePlan(run, [{ verb: "DISTRACT", target: "distraction" }]);
  run = act(run, { type: "commit", plan });
  entity(run.room, "distraction")!.active = false;
  run = act(run, { type: "step" });
  assert.ok(run.activePlan?.interrupted); assert.deepEqual(run.activePlan?.plan.steps, plan.steps);
});
test("old revisions and context bindings cannot commit new plans", () => {
  const run = taught(), plan = compilePlan(run, [{ verb: "WAIT" }]);
  const next = act(run, { type: "act", operation: { verb: "MOVE", at: { x: 2, y: 5 } } });
  assert.equal(transition(next, { type: "commit", plan }), next);
  assert.equal(transition(next, { type: "teach", principle: "promise", scope: "always" }, run.revision), next);
  plan.binding = { ...bind(next), digest: "forged" };
  assert.equal(transition(next, { type: "commit", plan }), next);
});
test("replay and resume reproduce facts, RNG, beliefs and pending execution exactly", () => {
  const run = rescue(taught());
  assert.deepEqual(replay(run.seed, run.runId, run.journal), run);
  assert.deepEqual(decodeSave(JSON.stringify(envelope(run))), run);
  const corrupted = envelope(run); corrupted.seed++;
  assert.equal(decodeSave(JSON.stringify(corrupted)), null);
});
test("cross-tab saves reject overwriting a newer revision and preserve invalid data", () => {
  const map = new Map<string, string>(), storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  const run = taught(); assert.equal(persist(storage, run, null), "saved");
  const next = act(run, { type: "act", operation: { verb: "WAIT" } });
  assert.equal(persist(storage, next, run.revision), "saved");
  assert.equal(persist(storage, run, run.revision), "conflict");
  assert.equal(decodeSave(map.get(SAVE_KEY)!)?.revision, next.revision);
});

test("an enemy physically destroys a planned object and interrupts the next sealed step", () => {
  let run = taught(); run.room.index = 4; run.room.turn = 6; run.room.alert = 3; run.player.hiddenUntil = 999;
  Object.assign(entity(run.room, "player")!, { x: 3, y: 5 }); Object.assign(entity(run.room, "guardian")!, { x: 4, y: 4 });
  const plan = compilePlan(run, [{ verb: "WAIT" }, { verb: "DISTRACT", target: "distraction" }]);
  const preview = previewPlan(run, plan); assert.equal(preview.legal, true); assert.ok(preview.complications.some(c => c.includes("interrupted")));
  run = act(run, { type: "commit", plan }); run = act(run, { type: "step" });
  assert.equal(entity(run.room, "distraction")!.active, false);
  run = act(run, { type: "step" }); assert.ok(run.activePlan?.interrupted);
  assert.ok(run.facts.some(f => f.actor === "guardian" && f.target === "distraction"));
  assert.deepEqual(run.activePlan?.plan.steps, plan.steps);
});
test("correcting applicability changes the relic's actual priority; override spends trust and energy", () => {
  let run = taught(); run = act(run, { type: "teach", principle: "survive", scope: "always" });
  assert.equal(chooseRelicPriority(run)?.id, "protect");
  run = act(run, { type: "correct", principle: "protect", scope: "no-one-else-hurt" });
  assert.equal(chooseRelicPriority(run)?.id, "survive");
  run.relic.pendingChoice = { protect: true, sources: run.relic.principles[0].examples };
  const before = run; run = act(run, { type: "override" });
  assert.equal(run.relic.energy, before.relic.energy - 4); assert.equal(run.relic.trust, before.relic.trust - 1);
  assert.equal(run.relic.pendingChoice, null);
});
test("a relationship repays a traceable favor as a physical change, once per chamber", () => {
  let run = rescue(taught()); run.room = buildRoom(48, 4, [], []);
  const relationship = run.relationships[0];
  run = act(run, { type: "favor", relationshipId: relationship.id, help: "silence" });
  assert.equal(entity(run.room, "relay")!.active, false);
  assert.equal(run.relationships[0].debt, relationship.debt - 1);
  assert.ok(run.facts.at(-1)?.sources.includes(relationship.witnessed[0]));
  assert.equal(transition(run, { type: "favor", relationshipId: relationship.id, help: "supplies" }), run);
});
