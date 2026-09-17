import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PracticeContinuation } from "../app/descent/practice-continuation";
import {
  acceptPracticeHandoff,
  createPracticeHandoff,
  loadPracticeHandoff,
  savePracticeHandoff,
  withPracticeContinuationLock,
  withPracticeRunLock,
} from "../app/descent/practice-handoff";
import { DESCENT_RULES, type Descent } from "../app/descent/model";
import { EMPTY_GAME, startRun } from "../app/practice/engine";
import { createPracticeGrid } from "../app/practice/grid-state";
import { inspectPracticeRun, savePracticeRun } from "../app/practice/storage";

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); this.writes += 1; }
}

function completedDescent(overrides: Partial<Descent> = {}): Descent {
  const relicCounts = Array(16).fill(0);
  relicCounts[1] = 1;
  return {
    rules: DESCENT_RULES,
    runId: "descent-complete-1",
    seed: 123,
    rngState: 456,
    revision: 30,
    game: {
      ...EMPTY_GAME,
      hp: 67,
      monsterHp: 0,
      monsterMaxHp: 122,
      roomsCleared: 10,
      gold: 88,
      potions: 2,
      weaponLevel: 2,
      armorLevel: 1,
      monsterType: 3,
      lastLootType: 2,
      lastLootAmount: 15,
      hasStarted: true,
      active: true,
      ownedRelics: [1],
      relicCounts,
      log: ["◆ Blood Price acquired."],
    },
    engaged: false,
    pendingLoot: null,
    roomTurns: 0,
    turns: 20,
    damageDealt: 400,
    damageTaken: 140,
    potionsUsed: 2,
    ...overrides,
  };
}

test("only a settled room-10 descent produces an immutable handoff", () => {
  const storage = new MemoryStorage();
  const run = completedDescent();
  const handoff = createPracticeHandoff(run);
  assert.ok(handoff);
  assert.equal(handoff.id, `fd-${run.runId}`);
  assert.equal(handoff.sourceRunId, run.runId);
  assert.equal(savePracticeHandoff(storage, handoff), "saved");
  assert.equal(savePracticeHandoff(storage, handoff), "exists");
  assert.deepEqual(loadPracticeHandoff(storage, handoff.id), { status: "restored", handoff });

  assert.equal(createPracticeHandoff({ ...run, pendingLoot: { gold: 30, potions: 0, weapon: 0, armor: 0 } }), null);
  assert.equal(createPracticeHandoff({ ...run, game: { ...run.game, relicOfferAvailable: true, relicOfferId: 1, relicOfferRarity: 1, ownedRelics: [], relicCounts: Array(16).fill(0) } }), null);
  assert.equal(createPracticeHandoff({ ...run, game: { ...run.game, roomsCleared: 9, monsterType: 2 } }), null);
});

test("a Weekly handoff carries only the validated analytics identity", () => {
  const weeklyRun = {
    ...completedDescent(),
    weekly: { challengeId: "2026-W38", rulesVersion: 2, actions: [] },
  };
  const handoff = createPracticeHandoff(weeklyRun);
  assert.ok(handoff);
  assert.deepEqual(handoff.sourceWeekly, { challengeId: "2026-W38", rulesVersion: 2 });
});

test("an empty Practice save imports Room 11 once and keeps the earned state", () => {
  const storage = new MemoryStorage();
  const handoff = createPracticeHandoff(completedDescent());
  assert.ok(handoff);
  let encounterDraws = 0;
  let layoutDraws = 0;
  const result = acceptPracticeHandoff(
    storage,
    handoff,
    (maximum) => { encounterDraws += 1; return Math.min(maximum - 1, 44); },
    () => { layoutDraws += 1; return 0x12345678; },
  );
  assert.equal(result.status, "imported");
  if (result.status !== "imported") return;
  assert.equal(result.game.roomsCleared, 10);
  assert.ok(result.game.monsterHp > 0);
  assert.notEqual(result.game.monsterType, 3);
  assert.equal(result.game.hp, handoff.game.hp);
  assert.equal(result.game.gold, handoff.game.gold);
  assert.equal(result.game.potions, handoff.game.potions);
  assert.equal(result.game.weaponLevel, handoff.game.weaponLevel);
  assert.equal(result.game.armorLevel, handoff.game.armorLevel);
  assert.deepEqual(result.game.ownedRelics, handoff.game.ownedRelics);
  assert.equal(result.game.equippedRelic, handoff.game.equippedRelic);
  assert.equal(result.grid.engaged, false);
  assert.equal(result.grid.pendingLoot, null);
  assert.ok(encounterDraws > 0);
  assert.equal(layoutDraws, 1);

  const stored = inspectPracticeRun(storage);
  assert.equal(stored.status, "restored");
  if (stored.status === "restored") {
    assert.equal(stored.importedFrom?.sourceRunId, handoff.sourceRunId);
    assert.equal(stored.game.monsterHp, result.game.monsterHp);
  }
});

test("an equipped Weekly relic stays equipped in Room 11 and after Practice restore", () => {
  const storage = new MemoryStorage();
  const relicCounts = Array(16).fill(0);
  relicCounts[9] = 1;
  const source = {
    ...completedDescent({
      game: {
        ...completedDescent().game,
        ownedRelics: [9],
        relicCounts,
        equippedRelic: 9,
        log: ["◆ Tempest Coil acquired and equipped."],
      },
    }),
    weekly: { challengeId: "2026-W38", rulesVersion: 2 as const, actions: [] },
  };
  const handoff = createPracticeHandoff(source);
  assert.ok(handoff);
  assert.deepEqual(handoff.sourceWeekly, { challengeId: "2026-W38", rulesVersion: 2 });
  assert.equal(handoff.game.equippedRelic, 9);

  const continued = acceptPracticeHandoff(storage, handoff, () => 0, () => 0x11);
  assert.equal(continued.status, "imported");
  if (continued.status !== "imported") return;
  assert.equal(continued.game.roomsCleared, 10);
  assert.ok(continued.game.monsterHp > 0, "Room 11 encounter was created");
  assert.deepEqual(continued.game.ownedRelics, [9]);
  assert.equal(continued.game.relicCounts[9], 1);
  assert.equal(continued.game.equippedRelic, 9);

  const restored = inspectPracticeRun(storage);
  assert.equal(restored.status, "restored");
  if (restored.status !== "restored") return;
  assert.equal(restored.game.roomsCleared, 10);
  assert.deepEqual(restored.game.ownedRelics, [9]);
  assert.equal(restored.game.relicCounts[9], 1);
  assert.equal(restored.game.equippedRelic, 9);
  assert.equal(restored.importedFrom?.sourceRunId, source.runId);
});

test("a repeated handoff resumes advanced Practice instead of regenerating Room 11", () => {
  const storage = new MemoryStorage();
  const handoff = createPracticeHandoff(completedDescent());
  assert.ok(handoff);
  const first = acceptPracticeHandoff(storage, handoff, () => 0, () => 7);
  assert.equal(first.status, "imported");
  if (first.status !== "imported") return;

  const advanced = { ...first.game, hp: first.game.hp - 9 };
  assert.equal(savePracticeRun(storage, advanced, first.grid, first.identity), "saved");
  const repeated = acceptPracticeHandoff(
    storage,
    handoff,
    () => { throw new Error("Room 11 must not be generated twice"); },
    () => { throw new Error("Layout must not be regenerated"); },
  );
  assert.equal(repeated.status, "resumed");
  if (repeated.status === "resumed") assert.equal(repeated.game.hp, advanced.hp);
});

test("an existing Practice run requires explicit replacement and stale confirmation cannot overwrite it", () => {
  const storage = new MemoryStorage();
  const existing = startRun(() => 0);
  const existingGrid = createPracticeGrid(19);
  assert.equal(savePracticeRun(storage, existing, existingGrid), "saved");
  const handoff = createPracticeHandoff(completedDescent());
  assert.ok(handoff);

  let randomCalls = 0;
  const pending = acceptPracticeHandoff(storage, handoff, () => { randomCalls += 1; return 0; }, () => 20);
  assert.equal(pending.status, "needs-confirmation");
  assert.equal(randomCalls, 0);
  if (pending.status !== "needs-confirmation") return;

  const changed = { ...existing, hp: existing.hp - 1 };
  assert.equal(savePracticeRun(storage, changed, existingGrid), "saved");
  const stale = acceptPracticeHandoff(storage, handoff, () => { randomCalls += 1; return 0; }, () => 21, {
    replace: true,
    expectedPractice: pending.expectedPractice,
  });
  assert.equal(stale.status, "conflict");
  assert.equal(randomCalls, 0);
  assert.deepEqual(inspectPracticeRun(storage).status, "restored");

  const fresh = acceptPracticeHandoff(storage, handoff, () => { randomCalls += 1; return 0; }, () => 22);
  assert.equal(fresh.status, "needs-confirmation");
  if (fresh.status !== "needs-confirmation") return;
  const replaced = acceptPracticeHandoff(storage, handoff, () => { randomCalls += 1; return 0; }, () => 22, {
    replace: true,
    expectedPractice: fresh.expectedPractice,
  });
  assert.equal(replaced.status, "imported");
  assert.ok(randomCalls > 0);
});

test("a busy cross-tab lock does not run the import operation", async () => {
  let called = false;
  const result = await withPracticeContinuationLock(
    () => { called = true; return { status: "invalid" }; },
    { request: async (_name, _options, callback) => callback(null) },
  );
  assert.deepEqual(result, { status: "busy" });
  assert.equal(called, false);
});

test("ordinary Practice saves use the same non-waiting lock as imports", async () => {
  let called = false;
  const result = await withPracticeRunLock(
    () => { called = true; return "saved"; },
    { request: async (_name, _options, callback) => callback(null) },
  );
  assert.deepEqual(result, { status: "busy" });
  assert.equal(called, false);
});

test("the continuation control renders only for a completed eligible descent", () => {
  const completed = renderToStaticMarkup(<PracticeContinuation run={completedDescent()} />);
  assert.match(completed, /Continue to Room 11 in Practice/);
  assert.match(completed, /completed First Descent stays here/);

  const incomplete = renderToStaticMarkup(<PracticeContinuation run={{
    ...completedDescent(),
    game: { ...completedDescent().game, roomsCleared: 9, monsterType: 2 },
  }} />);
  assert.equal(incomplete, "");
});
