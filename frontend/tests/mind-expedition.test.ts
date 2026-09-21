import test from "node:test";
import assert from "node:assert/strict";
import { createRun, transition } from "../app/living-dungeon/mind/engine";
import { compilePlan, generalizeManeuver, previewPlan, suggestions } from "../app/living-dungeon/mind/planning";
import { decodeSave, envelope } from "../app/living-dungeon/mind/storage";
import { entity } from "../app/living-dungeon/mind/world";
import type { Command, Operation, Plan, Run } from "../app/living-dungeon/mind/types";

export function command(run: Run, cmd: Command) { const next = transition(run, cmd); assert.notEqual(next, run, `Room ${run.room.index}, rejected ${JSON.stringify(cmd)}`); return next; }
export function executePlan(run: Run, plan: Plan): Run {
  const preview = previewPlan(run, plan);
  assert.ok(preview.legal, `Room ${run.room.index}, ${plan.name}: ${preview.reason}`);
  run = command(run, { type: "commit", plan });
  for (let i = 0; run.activePlan && i < 50; i++) {
    run = command(run, { type: "step" });
    assert.equal(run.activePlan?.interrupted ?? null, null);
  }
  assert.equal(run.status, "playing");
  return run;
}
export function doOperations(run: Run, operations: Operation[]) { return executePlan(run, compilePlan(run, operations)); }
export function playChapter(style: "public-storm" | "quiet", rooms = 14, seed = 812): Run {
  let run = command(createRun(seed, `expedition-${style}`), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
  run = command(run, { type: "teach", principle: "no-harm", scope: "always" });
  for (let index = 0; index < rooms; index++) {
    assert.equal(run.room.index, index);
    if (run.relic.misunderstanding) run = command(run, { type: "correct", principle: "protect", scope: "innocent-at-risk" });
    if (style === "public-storm" && [4, 5, 7, 10].includes(index)) {
      for (let i = 0; i < 2 && entity(run.room, "guardian")!.active; i++) run = doOperations(run, [{ verb: "STORM", target: "guardian" }]);
    }
    if (run.room.family === "echo") {
      run = doOperations(run, [{ verb: "WAIT" }, { verb: "WAIT" }]);
    }
    if (!entity(run.room, "captive")!.freed) {
      const plan = run.relic.maneuvers.length ? generalizeManeuver(run, run.relic.maneuvers[0]) : compilePlan(run, suggestions(run)[0].operations, { boundary: "no-harm" });
      run = executePlan(run, plan);
    }
    if (index === 0) {
      run = command(run, { type: "save-maneuver", name: "Stille nåde", boundary: "no-harm" });
      run = command(run, { type: "correct-maneuver", id: run.relic.maneuvers[0].id, boundary: "no-harm" });
    }
    if (run.room.family === "echo") {
      for (let turn = 0; !run.room.solved && turn < 12; turn++) {
        if (run.player.hp < 14 && run.player.potions) run = doOperations(run, [{ verb: "POTION" }]);
        run = doOperations(run, [{ verb: "HIDE" }, { verb: "ATTACK", target: "guardian" }]);
      }
      assert.equal(run.room.solved, true, "boss should be defeated by the learned hidden strategy");
    }
    if (index >= 12 && !run.room.solved && run.room.goal === "evidence") run = doOperations(run, [{ verb: "REVEAL_EVIDENCE", target: "evidence" }]);
    if (index >= 12 && !run.room.solved && run.room.goal === "story") run = doOperations(run, [{ verb: "INTERRUPT_REPORT", target: "relay" }]);
    if (style === "quiet" && index >= 4 && entity(run.room, "relay")!.active) run = doOperations(run, [{ verb: "INTERRUPT_REPORT", target: "relay" }]);
    run = doOperations(run, [{ verb: "MOVE", at: { x: 8, y: 7 } }]);
    run = command(run, { type: "descend" });
  }
  return run;
}
test("complete first expedition, all three mechanical chills, continued floors and exact save replay", () => {
  const run = playChapter("public-storm");
  assert.equal(run.echoes, 1); assert.equal(run.room.index, 14);
  assert.ok(run.chills.understood); assert.ok(run.chills.mistaken); assert.ok(run.chills.divergence);
  const divergence = run.facts.find(f => f.id === run.chills.divergence)!;
  assert.ok(divergence.sources.some(id => run.reports.some(r => r.id === id && r.delivered !== null)));
  assert.ok(divergence.sources.some(id => run.facts.some(f => f.id === id && f.actor === "relic")));
  assert.ok(run.facts.some(f => f.kind === "choice" && f.actor === "relic" && f.sources.length));
  assert.deepEqual(decodeSave(JSON.stringify(envelope(run))), run);
});
test("quiet expedition and costly public identity create mechanically different echoes", () => {
  const publicRun = playChapter("public-storm", 12), quietRun = playChapter("quiet", 12);
  const counters = (run: Run) => run.facts.filter(f => f.kind === "countermeasure" && f.room === 11).map(f => f.text);
  assert.notDeepEqual(counters(publicRun), counters(quietRun));
  assert.ok(counters(publicRun).some(s => s.includes("Storm Ward")));
  assert.ok(!counters(quietRun).some(s => s.includes("Storm Ward")));
});

test("scenario grammar continues through several Echoes without repeating recent families", () => {
  const run = playChapter("public-storm", 24);
  assert.equal(run.echoes, 3);
  for (let i = 12; i < run.history.length; i++) if (run.history[i] !== "echo") assert.ok(!run.history.slice(i - 3, i).includes(run.history[i]));
  assert.deepEqual(decodeSave(JSON.stringify(envelope(run))), run);
});

test("a complete legacy expedition preserves its historical Echo and resumes with current rules", async () => {
  const { createRun: oldCreate, transition: oldTransition } = await import("../app/living-dungeon/mind/legacy-v2/engine");
  const { bind: oldBind } = await import("../app/living-dungeon/mind/legacy-v2/protocol");
  const { hash } = await import("../app/living-dungeon/mind/protocol");
  const english = playChapter("public-storm");
  let legacy = oldCreate(english.seed, english.runId);
  for (const entry of english.journal) {
    const command = structuredClone(entry.command);
    if (command.type === "commit") {
      command.plan.binding = oldBind(legacy, command.plan.binding.requestId, command.plan.binding.generation);
      if (!command.plan.maneuverId) command.plan.name = "En mulig framtid";
    }
    const next = oldTransition(legacy, command, entry.revision);
    assert.notEqual(next, legacy);
    legacy = next;
  }
  const data = { version: 2, rules: "mind-beneath-1", runId: legacy.runId, seed: legacy.seed, revision: legacy.revision, journal: legacy.journal };
  const migrated = decodeSave(JSON.stringify({ ...data, checksum: hash(data) }));
  assert.ok(migrated);
  // Historical replay uses the frozen English rules, not today's corrected mechanics.
  const { createRun: v3Create, transition: v3Transition } = await import("../app/living-dungeon/mind/legacy-v3/engine");
  const { bind: v3Bind } = await import("../app/living-dungeon/mind/legacy-v3/protocol");
  let historical = v3Create(legacy.seed, legacy.runId);
  for (const entry of legacy.journal) {
    const command = structuredClone(entry.command);
    if (command.type === "commit") {
      command.plan.binding = v3Bind(historical, command.plan.binding.requestId, command.plan.binding.generation);
      if (!command.plan.maneuverId) command.plan.name = "A Possible Future";
    }
    historical = v3Transition(historical, command, entry.revision);
  }
  assert.deepEqual(migrated, { ...historical, version: 4, rules: "mind-beneath-3", upgradedAt: historical.revision });
  const continued = transition(migrated, { type: "act", operation: { verb: "WAIT" } });
  assert.notEqual(continued, migrated);
  assert.deepEqual(decodeSave(JSON.stringify(envelope(continued))), continued);
  assert.equal(migrated?.echoes, 1);
  assert.ok(migrated?.chills.divergence);
});
