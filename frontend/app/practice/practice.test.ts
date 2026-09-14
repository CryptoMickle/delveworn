import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_GAME, attack, buy, claimRelic, enterNextRoom, startRun, stormAttack, usePotion, type PracticeGame } from "./engine";
import { describePracticeAction, practiceLoot, practiceRoom, practiceShareText } from "./feedback";
import { inspectPracticeRun, isStoredPracticeGame, loadPracticeRun, PRACTICE_RUN_STORAGE_KEY, savePracticeRun } from "./storage";

function memoryStorage(raw: string | null = null) {
  return {
    raw,
    writes: 0,
    getItem(key: string) { assert.equal(key, PRACTICE_RUN_STORAGE_KEY); return this.raw; },
    setItem(key: string, value: string) { assert.equal(key, PRACTICE_RUN_STORAGE_KEY); this.raw = value; this.writes += 1; },
  };
}
function serialized(game: PracticeGame) { return JSON.stringify({ version: 1, game }); }
function combat(overrides: Partial<PracticeGame> = {}): PracticeGame {
  return { ...EMPTY_GAME, hasStarted: true, active: true, monsterHp: 30, monsterMaxHp: 30, ...overrides };
}

test("saved combat restores without any rewrite and an empty browser stays empty", () => {
  const game = combat({ hp: 72, potions: 2 });
  const saved = memoryStorage(serialized(game));
  assert.deepEqual(inspectPracticeRun(saved), { status: "restored", game });
  assert.deepEqual(loadPracticeRun(saved), game);
  assert.equal(saved.writes, 0);
  assert.deepEqual(inspectPracticeRun(memoryStorage()), { status: "empty" });
});

test("blocked localStorage getter, reads and writes fail safely", () => {
  const blocked = () => { throw new DOMException("Blocked", "SecurityError"); };
  assert.deepEqual(inspectPracticeRun(blocked), { status: "unavailable" });
  assert.equal(loadPracticeRun(blocked), null);
  assert.equal(savePracticeRun(blocked, combat()), "unavailable");
  assert.deepEqual(inspectPracticeRun({ getItem: blocked, setItem() {} }), { status: "unavailable" });
  assert.equal(savePracticeRun({ getItem() { return null; }, setItem: blocked }, combat()), "unavailable");
});

test("corrupt, oversized and newer-version saves remain untouched", () => {
  for (const raw of ["", "{broken", "x".repeat(40_001), JSON.stringify({ version: 2, game: combat() })]) {
    const storage = memoryStorage(raw);
    assert.equal(inspectPracticeRun(storage).status, "invalid");
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
  }
});

test("storage rejects impossible health, inventory, phase and fractional values", () => {
  const invalid: Partial<PracticeGame>[] = [
    { hp: -1 }, { hp: 101 }, { maxHp: 99 }, { potions: 6 }, { potions: 1.5 },
    { gold: -10 }, { armorLevel: Infinity }, { weaponLevel: Number.MAX_SAFE_INTEGER + 1 },
    { monsterHp: 31 }, { hp: 0 }, { active: false }, { roomsCleared: 9 },
    { combatPotionsUsed: 3 }, { campPotionsBought: 3 }, { supplyPotionsBought: 3 },
    { hasStarted: false }, { monsterMaxHp: 0 }, { log: Array(13).fill("Too much paperwork") },
    { log: ["x".repeat(1_001)] },
  ];
  for (const patch of invalid) {
    const game = combat(patch);
    assert.equal(isStoredPracticeGame(game), false, JSON.stringify(patch));
    const storage = memoryStorage("previous save");
    assert.equal(savePracticeRun(storage, game), "invalid");
    assert.equal(storage.raw, "previous save");
  }
});

test("storage checks relic ownership, copies, maximum HP and boss reward consistency", () => {
  const counts = Array(16).fill(0); counts[2] = 1;
  assert.equal(isStoredPracticeGame(combat({ ownedRelics: [2], relicCounts: counts, equippedRelic: 2, maxHp: 120 })), true);
  assert.equal(isStoredPracticeGame(combat({ equippedRelic: 2, maxHp: 120 })), false);
  assert.equal(isStoredPracticeGame(combat({ ownedRelics: [2], relicCounts: Array(16).fill(0) })), false);
  const reward = combat({ monsterType: 3, monsterHp: 0, monsterMaxHp: 122, roomsCleared: 10, relicOfferAvailable: true, relicOfferId: 4, relicOfferRarity: 2 });
  assert.equal(isStoredPracticeGame(reward), true);
  assert.equal(isStoredPracticeGame({ ...reward, relicOfferRarity: 1 }), false);
  assert.equal(isStoredPracticeGame({ ...reward, monsterHp: 1 }), false);
  assert.equal(isStoredPracticeGame({ ...reward, relicOfferAvailable: false }), false);
  const claimed = claimRelic(reward, true);
  assert.equal(isStoredPracticeGame(claimed), true);
  assert.equal(claimed.relicCounts[4], 1);
});

test("Practice continues beyond room 40; combat, camp, loot and ended snapshots restore", () => {
  const snapshots = [
    combat({ roomsCleared: 44 }),
    combat({ roomsCleared: 9, monsterHp: 0, gold: 150 }),
    combat({ roomsCleared: 5, monsterHp: 0 }),
    combat({ active: false, hp: 0 }),
    EMPTY_GAME,
  ];
  for (const game of snapshots) assert.deepEqual(loadPracticeRun(memoryStorage(serialized(game))), game);
});

test("real engine transitions produce valid saves, including boss rewards after room 40", (context) => {
  context.mock.method(globalThis.crypto, "getRandomValues", (array: Uint32Array) => { array.fill(0); return array; });
  let game = startRun();
  for (let cleared = 0; cleared < 42; cleared += 1) {
    while (game.monsterHp > 0) {
      // Isolate state-shape coverage from survival/balance; refill the fixture before each turn.
      game = attack({ ...game, hp: game.maxHp });
      assert.equal(isStoredPracticeGame(game), true, `invalid after combat in room ${cleared + 1}`);
    }
    if (game.relicOfferAvailable) {
      game = claimRelic(game, true);
      assert.equal(isStoredPracticeGame(game), true);
    }
    game = enterNextRoom(game);
    assert.equal(isStoredPracticeGame(game), true);
  }
  assert.equal(game.roomsCleared, 42);
});

test("potion feedback separates retaliation and actual net healing at the HP cap", (context) => {
  context.mock.method(globalThis.crypto, "getRandomValues", (array: Uint32Array) => { array.fill(0); return array; });
  const before = combat({ hp: 95 });
  const after = usePotion(before);
  assert.equal(after.hp, 100);
  assert.equal(after.potions, 2);
  assert.equal(after.combatPotionsUsed, 1);
  const feedback = describePracticeAction(before, after, "potion");
  assert.match(feedback.title, /HP 95 → 100 \(\+5\)/);
  assert.match(feedback.detail, /retaliation at half damage/);
  const safe = combat({ hp: 40, monsterHp: 0, roomsCleared: 1 });
  assert.match(describePracticeAction(safe, usePotion(safe), "potion").detail, /no retaliation between rooms/);
});

test("Storm zero damage and lethal damage report their different consequences", (context) => {
  context.mock.method(globalThis.crypto, "getRandomValues", (array: Uint32Array) => { array.fill(0); return array; });
  const before = combat();
  const missed = stormAttack(before);
  const feedback = describePracticeAction(before, missed, "storm");
  assert.equal(missed.lastPlayerDamage, 0);
  assert.match(feedback.title, /Storm · 0 damage/);
  assert.match(feedback.detail, /Storm can miss entirely/);
  const lowHp = combat({ hp: 1 });
  const ended = stormAttack(lowHp);
  assert.equal(ended.active, false);
  assert.equal(describePracticeAction(lowHp, ended, "storm").tone, "danger");
});

test("room display stays on the cleared room through loot, shopping and a boss reward", () => {
  assert.equal(practiceRoom(combat({ roomsCleared: 4 })), 5);
  assert.equal(practiceRoom(combat({ roomsCleared: 5, monsterHp: 0 })), 5);
  assert.equal(practiceRoom(combat({ roomsCleared: 9, monsterHp: 0 })), 9);
  assert.equal(practiceRoom(combat({ roomsCleared: 10, monsterType: 3, monsterHp: 0, relicOfferAvailable: true })), 10);
  assert.equal(practiceRoom(combat({ roomsCleared: 10 })), 11);
});

test("Kevin receipt and loot show useful equipment consequences", () => {
  const before = combat({ roomsCleared: 9, monsterHp: 0, gold: 100 });
  const after = buy(before, "camp-weapon");
  const feedback = describePracticeAction(before, after, "shop");
  assert.match(feedback.title, /60 gold spent/);
  assert.match(feedback.detail, /Weapon level 1 · \+2 base damage/);
  assert.match(practiceLoot({ ...after, lastLootType: 3 }), /\+2 base damage/);
});

test("shared results identify local, self-reported progress without proof or wallet claims", () => {
  const text = practiceShareText(combat({ active: false, hp: 0, roomsCleared: 13, gold: 92 }));
  assert.match(text, /13 rooms cleared · 1 boss defeated · 92 gold remaining/);
  assert.match(text, /Local Practice Mode/);
  assert.match(text, /Self-reported result; no onchain record or rewards/);
  assert.match(text, /Play Practice Mode: https:\/\/delveworn\.app\/practice/);
  assert.doesNotMatch(text, /verified|0x[a-f0-9]{40}/i);
});
