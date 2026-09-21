import assert from "node:assert/strict";
import { createRun, transition } from "../../app/living-dungeon/mind/engine";
import { compilePlan, suggestions } from "../../app/living-dungeon/mind/planning";
import type { Operation, Run } from "../../app/living-dungeon/mind/types";

function perform(run: Run, operations: Operation[]) {
  run = transition(run, { type: "commit", plan: compilePlan(run, operations) });
  assert.ok(run.activePlan);
  for (let steps = 0; run.activePlan && steps < 48; steps++) {
    run = transition(run, { type: "step" });
    assert.equal(run.activePlan?.interrupted ?? null, null);
  }
  assert.equal(run.activePlan, null);
  return run;
}

/** Real, replayable actions: rescue Kevin in the kiln, then reach the report network. */
export function kevinJourney() {
  let run = transition(createRun(812, "kevin-supply-routes"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
  for (let index = 0; index < 4; index++) {
    if (run.relic.misunderstanding) run = transition(run, { type: "correct", principle: "protect", scope: "innocent-at-risk" });
    run = perform(run, suggestions(run)[0].operations);
    run = perform(run, [{ verb: "MOVE", at: { x: 8, y: 7 } }]);
    run = transition(run, { type: "descend" });
    assert.equal(run.room.index, index + 1);
  }
  // Give a potion away so there is room for a delivery, without fabricating inventory.
  return perform(run, [{ verb: "TRANSFER_ITEM", target: "captive" }]);
}
