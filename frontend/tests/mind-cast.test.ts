import test from "node:test";
import assert from "node:assert/strict";
import { transition } from "../app/living-dungeon/mind/engine";
import { displayName, entityName, favorAvailability, worldText } from "../app/living-dungeon/mind/identities";
import { decodeSave, envelope } from "../app/living-dungeon/mind/storage";
import { entity } from "../app/living-dungeon/mind/world";
import { kevinJourney } from "./fixtures/mind-kevin";

test("Kevin's rescue funds real help with causal evidence, once per chamber, and survives reload", () => {
  const run = kevinJourney(), kevin = run.relationships.find(r => r.id === "kiln")!;
  const original = JSON.stringify(envelope(run));
  assert.equal(displayName(kevin.name), "Quartermaster Kevin");
  assert.equal(entityName(run.room, entity(run.room, "guardian")!), "Gronk · Orc");
  assert.equal(kevin.debt, 1);
  assert.ok(favorAvailability(run, kevin).supplies);
  for (const help of ["supplies", "silence"] as const) {
    const next = transition(run, { type: "favor", relationshipId: kevin.id, help });
    assert.equal(next.relationships.find(r => r.id === kevin.id)!.debt, 0);
    if (help === "supplies") assert.equal(next.player.potions, run.player.potions + 1);
    else {
      assert.equal(entity(next.room, "relay")!.active, false);
      assert.ok(next.reports.filter(r => r.delivered === null).every(r => r.intercepted));
    }
    const repayment = next.facts.findLast(f => f.actor === kevin.id && f.kind === "choice")!;
    assert.ok(repayment.sources.some(id => run.facts.some(f => f.id === id && f.room === 1 && f.operation?.verb === "RELEASE")));
    assert.match(worldText(repayment.text), /^Quartermaster Kevin repaid a favour:/);
    assert.equal(transition(next, { type: "favor", relationshipId: kevin.id, help }), next);
    assert.deepEqual(decodeSave(JSON.stringify(envelope(next))), next);
    assert.equal(favorAvailability(next, next.relationships.find(r => r.id === kevin.id)!).supplies, false);
  }
  assert.equal(JSON.stringify(envelope(run)), original, "display names never rewrite the save or plan binding");
  assert.deepEqual(decodeSave(original), run);
  assert.equal(worldText('Remembered “The Masked Warden”: The Ash Bearer went free.'), 'Remembered “The Masked Warden”: Quartermaster Kevin went free.');
});
