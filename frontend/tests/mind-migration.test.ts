import test from "node:test";
import assert from "node:assert/strict";
import { createRun, transition } from "../app/living-dungeon/mind/engine";
import { createRun as createLegacyRun, transition as legacyTransition } from "../app/living-dungeon/mind/legacy-v2/engine";
import { bind as legacyBind } from "../app/living-dungeon/mind/legacy-v2/protocol";
import type { Run as LegacyRun, SaveEnvelope as LegacySave } from "../app/living-dungeon/mind/legacy-v2/types";
import { compilePlan, suggestions } from "../app/living-dungeon/mind/planning";
import { hash, currentBinding } from "../app/living-dungeon/mind/protocol";
import { decodeSave, envelope, persist, SAVE_KEY } from "../app/living-dungeon/mind/storage";
import type { Run } from "../app/living-dungeon/mind/types";

function oldSave(run: LegacyRun): LegacySave {
  const data = { version: 2 as const, rules: "mind-beneath-1" as const, runId: run.runId, seed: run.seed, revision: run.revision, journal: run.journal };
  return { ...data, checksum: hash(data) };
}
function oldPlan(): LegacyRun {
  const old = legacyTransition(createLegacyRun(48, "legacy-language"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
  const plan = compilePlan(old as unknown as Run, suggestions(old as unknown as Run)[0].operations, { boundary: "no-harm", name: "En mulig framtid" });
  plan.binding = legacyBind(old);
  return legacyTransition(old, { type: "commit", plan });
}
/** Compare everything causal, excluding authored prose and intentionally rebound journals. */
export function mechanics(run: Run | LegacyRun): unknown {
  const prose = new Set(["version", "rules", "upgradedAt", "name", "title", "subtitle", "objective", "interpretation", "line", "text", "notice", "risks", "binding", "journal"]);
  return JSON.parse(JSON.stringify(run, (key, value) => prose.has(key) ? undefined : value));
}

test("Norwegian v2 memory migrates mid-plan, keeps causal state and finishes in English", () => {
  let old = legacyTransition(oldPlan(), { type: "step" });
  const raw = JSON.stringify(oldSave(old));
  let migrated = decodeSave(raw)!;
  assert.ok(migrated); assert.equal(migrated.version, 4);
  assert.equal(migrated.room.title, "A Voice in the Stone");
  assert.match(migrated.relic.line, /When someone is in danger/);
  assert.equal(migrated.activePlan?.plan.name, "A Possible Future");
  assert.deepEqual(mechanics(migrated), mechanics(old));
  assert.deepEqual(decodeSave(JSON.stringify(envelope(migrated))), migrated);
  while (old.activePlan) {
    old = legacyTransition(old, { type: "step" });
    migrated = transition(migrated, { type: "step" });
    assert.deepEqual(decodeSave(JSON.stringify(envelope(migrated))), migrated);
  }
  assert.equal(migrated.room.solved, true);
  assert.ok(migrated.facts.some(f => f.text === "Freed Ilyr the Cartographer."));
  assert.equal(JSON.stringify(oldSave(legacyTransition(oldPlan(), { type: "step" }))), raw, "migration does not rewrite its input");
});

test("migration preserves player names, examples, corrections, relationships and next-room play", () => {
  let old = oldPlan();
  while (old.activePlan) old = legacyTransition(old, { type: "step" });
  old = legacyTransition(old, { type: "save-maneuver", name: "Min egen nåde", boundary: "no-harm" });
  old = legacyTransition(old, { type: "correct-maneuver", id: old.relic.maneuvers[0].id, boundary: "no-harm" });
  const migrated = decodeSave(JSON.stringify(oldSave(old)))!;
  assert.equal(migrated.relic.maneuvers[0].name, "Min egen nåde");
  assert.deepEqual(mechanics(migrated), mechanics(old));
  assert.equal(migrated.relationships[0].name, "Ilyr the Cartographer");
  const plan = compilePlan(migrated, [{ verb: "MOVE", at: { x: 8, y: 7 } }]);
  assert.ok(currentBinding(migrated, plan.binding));
  let next = transition(migrated, { type: "commit", plan });
  while (next.activePlan) next = transition(next, { type: "step" });
  next = transition(next, { type: "descend" });
  assert.equal(next.room.index, 1);
  assert.equal(next.room.title, "What Did You Mean by Free?");
  assert.deepEqual(decodeSave(JSON.stringify(envelope(next))), next);
});

test("legacy migration rejects stale or forged plans even with a recomputed checksum", () => {
  for (const tamper of ["digest", "revision", "seed"] as const) {
    const save = oldSave(oldPlan());
    const command = save.journal.find(e => e.command.type === "commit")!.command;
    assert.equal(command.type, "commit");
    if (command.type !== "commit") throw new Error("Missing plan");
    if (tamper === "digest") command.plan.binding.digest = "forged";
    if (tamper === "revision") command.plan.binding.revision++;
    if (tamper === "seed") save.seed++;
    const { checksum, ...data } = save;
    assert.equal(typeof checksum, "string");
    assert.equal(decodeSave(JSON.stringify({ ...data, checksum: hash(data) })), null);
  }
});

test("a migrated save replaces the old format only on a successful persisted action", () => {
  const raw = JSON.stringify(oldSave(oldPlan())), values = new Map([[SAVE_KEY, raw]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const migrated = decodeSave(raw)!;
  assert.equal(values.get(SAVE_KEY), raw);
  const next = transition(migrated, { type: "step" });
  assert.equal(persist(storage, next, migrated.revision), "saved");
  assert.equal(JSON.parse(values.get(SAVE_KEY)!).version, 4);
  assert.deepEqual(decodeSave(values.get(SAVE_KEY)!), next);
  assert.equal(persist(storage, migrated, migrated.revision), "conflict");
});

test("fresh English saves and legacy memories use distinct rule versions", () => {
  const fresh = createRun(1, "english");
  assert.equal(envelope(fresh).rules, "mind-beneath-3");
  assert.deepEqual(decodeSave(JSON.stringify(envelope(fresh))), fresh);
  assert.equal(fresh.room.entities.find(e => e.id === "player")?.name, "You");
});
