import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_GAME, attack, buy, claimRelic, enterNextRoom, startRun, stormAttack, usePotion, type PracticeGame } from "./engine";
import { describePracticeAction, practiceLoot, practiceRoom, practiceShareText } from "./feedback";
import { canRunPracticeLocalAction, collectPracticeLoot, countPracticeTurn, createPracticeGrid, engagePracticeGrid, enterPracticeRoom, holdPracticeLoot, legacyPracticeGrid, passPracticeLootAtDoor, practiceGridPhase, skipPracticeLoot } from "./grid-state";
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
  assert.deepEqual(inspectPracticeRun(saved), { status: "restored", game, grid: legacyPracticeGrid(game), legacy: true });
  assert.deepEqual(loadPracticeRun(saved), game);
  assert.equal(saved.writes, 0);
  assert.deepEqual(inspectPracticeRun(memoryStorage()), { status: "empty" });
});

test("old saves resume combat and keep already credited loot without rewriting", () => {
  const fighting = combat({ roomsCleared: 18 });
  const fightStorage = memoryStorage(serialized(fighting));
  const fight = inspectPracticeRun(fightStorage);
  assert.equal(fight.status, "restored");
  if (fight.status === "restored") {
    assert.equal(fight.legacy, true);
    assert.equal(fight.grid.engaged, true);
    assert.equal(fight.grid.pendingLoot, null);
    assert.equal(practiceGridPhase(fight.game, fight.grid), "combat");
  }

  const credited = combat({ roomsCleared: 19, monsterHp: 0, gold: 321, weaponLevel: 3, lastLootType: 3, lastLootAmount: 1 });
  const creditedStorage = memoryStorage(serialized(credited));
  const recovery = inspectPracticeRun(creditedStorage);
  assert.equal(recovery.status, "restored");
  if (recovery.status === "restored") {
    assert.equal(recovery.grid.pendingLoot, null);
    assert.equal(practiceGridPhase(recovery.game, recovery.grid), "recovery");
    assert.equal(recovery.game.gold, 321);
    assert.equal(recovery.game.weaponLevel, 3);
  }
  assert.equal(fightStorage.writes, 0);
  assert.equal(creditedStorage.writes, 0);
});

test("new rooms start with an approach and the grid phase follows loot, reward and recovery", () => {
  const game = combat();
  const grid = createPracticeGrid(0x1234abcd);
  assert.equal(practiceGridPhase(game, grid), "explore");
  const engaged = engagePracticeGrid(grid);
  assert.equal(practiceGridPhase(game, engaged), "combat");
  assert.equal(countPracticeTurn(engaged).roomTurns, 1);

  const held = holdPracticeLoot(game, {
    ...game,
    monsterHp: 0,
    roomsCleared: 1,
    gold: 17,
    potions: 4,
    lastLootType: 1,
    lastLootAmount: 1,
  }, engaged);
  assert.deepEqual(held.grid.pendingLoot, { gold: 17, potions: 1, weapon: 0, armor: 0 });
  assert.equal(held.game.gold, 0);
  assert.equal(held.game.potions, 3);
  assert.equal(practiceGridPhase(held.game, held.grid), "loot");

  const collected = collectPracticeLoot(held.game, held.grid);
  assert.equal(collected.game.gold, 17);
  assert.equal(collected.game.potions, 4);
  assert.equal(practiceGridPhase(collected.game, collected.grid), "recovery");

  const bossLoot = holdPracticeLoot(
    combat({ roomsCleared: 9, monsterType: 3, monsterHp: 1, monsterMaxHp: 122 }),
    combat({ roomsCleared: 10, monsterType: 3, monsterHp: 0, monsterMaxHp: 122, gold: 30, lastLootType: 2, lastLootAmount: 12, relicOfferAvailable: true, relicOfferRarity: 1, relicOfferId: 1 }),
    engaged,
  );
  assert.equal(practiceGridPhase(bossLoot.game, bossLoot.grid), "loot");
  assert.equal(practiceGridPhase(bossLoot.game, skipPracticeLoot(bossLoot.grid)), "reward");
});

test("a safe potion preserves held loot, its save and either loot resolution path", () => {
  const before = combat({
    hp: 60,
    potions: 2,
    roomsCleared: 1,
    monsterHp: 0,
    lastLootType: 1,
    lastLootAmount: 1,
  });
  const pendingLoot = { gold: 17, potions: 1, weapon: 0, armor: 0 } as const;
  const grid = { ...createPracticeGrid(0x5afe), pendingLoot, roomTurns: 3 };
  let randomCalls = 0;

  assert.equal(canRunPracticeLocalAction(before, grid, "potion"), true);
  assert.equal(canRunPracticeLocalAction(before, grid, "attack"), false);
  assert.equal(canRunPracticeLocalAction(before, grid, "encounter"), false);

  const after = usePotion(before, () => {
    randomCalls += 1;
    throw new Error("Safe healing must not draw randomness");
  });
  const settled = holdPracticeLoot(before, after, grid);

  assert.equal(randomCalls, 0);
  assert.equal(settled.game.hp, 85);
  assert.equal(settled.game.potions, 1);
  assert.equal(settled.game.combatPotionsUsed, before.combatPotionsUsed);
  assert.equal(settled.game.lastMonsterDamage, 0);
  assert.equal(settled.grid, grid);
  assert.equal(settled.grid.pendingLoot, pendingLoot);
  assert.equal(settled.grid.roomTurns, 3);
  assert.equal(practiceGridPhase(settled.game, settled.grid), "loot");

  const saved = memoryStorage();
  assert.equal(savePracticeRun(saved, settled.game, settled.grid), "saved");
  assert.deepEqual(inspectPracticeRun(saved), { status: "restored", game: settled.game, grid: settled.grid, legacy: false });

  const collected = collectPracticeLoot(settled.game, settled.grid);
  assert.equal(collected.game.hp, 85);
  assert.equal(collected.game.potions, 2);
  assert.equal(collected.game.gold, 17);
  assert.equal(collected.grid.pendingLoot, null);

  const bypassed = passPracticeLootAtDoor(settled.game, settled.grid, current => ({
    ...current,
    monsterHp: 30,
    monsterMaxHp: 30,
  }));
  assert.ok(bypassed);
  assert.equal(bypassed.game.hp, 85);
  assert.equal(bypassed.game.potions, 1);
  assert.equal(bypassed.game.gold, 0);
  assert.equal(bypassed.grid.pendingLoot, null);
  assert.equal(bypassed.grid.roomTurns, 0);
});

test("safe potion eligibility covers recovery but keeps the resolved boss reward choice blocking", () => {
  const grid = createPracticeGrid(0x600d);
  const recovery = combat({ hp: 90, potions: 1, roomsCleared: 1, monsterHp: 0 });
  assert.equal(canRunPracticeLocalAction(recovery, grid, "potion"), true);

  const capped = usePotion(recovery, () => { throw new Error("Safe healing must not draw randomness"); });
  assert.equal(capped.hp, capped.maxHp);
  assert.equal(capped.potions, 0);
  assert.equal(canRunPracticeLocalAction(capped, grid, "potion"), false);
  const rejected = usePotion(capped);
  assert.equal(rejected.hp, capped.maxHp);
  assert.equal(rejected.potions, 0);

  const reward = combat({
    hp: 50,
    potions: 1,
    roomsCleared: 10,
    monsterType: 3,
    monsterHp: 0,
    monsterMaxHp: 122,
    relicOfferAvailable: true,
    relicOfferRarity: 1,
    relicOfferId: 1,
  });
  assert.equal(practiceGridPhase(reward, grid), "reward");
  assert.equal(canRunPracticeLocalAction(reward, grid, "potion"), false);
  assert.equal(canRunPracticeLocalAction(reward, grid, "encounter"), false);

  const bossLoot = {
    ...grid,
    pendingLoot: { gold: 30, potions: 0, weapon: 0, armor: 0 },
  };
  assert.equal(practiceGridPhase(reward, bossLoot), "loot");
  assert.equal(canRunPracticeLocalAction(reward, bossLoot, "potion"), true);

  const livingEnemy = combat({ hp: 50, potions: 1 });
  assert.equal(canRunPracticeLocalAction(livingEnemy, grid, "potion"), true);
  assert.equal(canRunPracticeLocalAction({ ...livingEnemy, combatPotionsUsed: 2 }, grid, "potion"), false);
});

test("walking past ordinary loot discards it and enters exactly once", (context) => {
  context.mock.method(globalThis.crypto, "getRandomValues", (array: Uint32Array) => { array.fill(0); return array; });
  const game = combat({
    roomsCleared: 1,
    monsterHp: 0,
    gold: 0,
    weaponLevel: 0,
    lastLootType: 3,
    lastLootAmount: 1,
  });
  const grid = {
    ...createPracticeGrid(19),
    pendingLoot: { gold: 9, potions: 0, weapon: 1, armor: 0 },
    roomTurns: 2,
  };
  let entries = 0;
  const result = passPracticeLootAtDoor(game, grid, current => {
    entries += 1;
    return enterNextRoom(current);
  });

  assert.ok(result);
  assert.equal(result.entered, true);
  assert.equal(entries, 1);
  assert.equal(result.game.roomsCleared, 1);
  assert.ok(result.game.monsterHp > 0);
  assert.equal(result.game.gold, 0);
  assert.equal(result.game.weaponLevel, 0);
  assert.equal(result.grid.pendingLoot, null);
  assert.equal(result.grid.roomTurns, 0);
  assert.equal(practiceGridPhase(result.game, result.grid), "explore");

  const duplicate = passPracticeLootAtDoor(result.game, result.grid, current => {
    entries += 1;
    return enterNextRoom(current);
  });
  assert.equal(duplicate, null);
  assert.equal(entries, 1);
  assert.notEqual(grid.pendingLoot, null);
});

test("a failed pass-by entry leaves held loot and game state untouched", (context) => {
  const game = combat({ roomsCleared: 1, monsterHp: 0, lastLootType: 2, lastLootAmount: 12 });
  const grid = {
    ...createPracticeGrid(20),
    pendingLoot: { gold: 21, potions: 0, weapon: 0, armor: 0 },
  };
  context.mock.method(globalThis.crypto, "getRandomValues", () => { throw new DOMException("Unavailable", "OperationError"); });

  assert.throws(() => passPracticeLootAtDoor(game, grid, enterNextRoom), /Unavailable/);
  assert.equal(game.monsterHp, 0);
  assert.equal(game.gold, 0);
  assert.deepEqual(grid.pendingLoot, { gold: 21, potions: 0, weapon: 0, armor: 0 });
  assert.equal(practiceGridPhase(game, grid), "loot");
});

test("walking past boss loot reveals the relic choice without entering", () => {
  const game = combat({
    roomsCleared: 10,
    monsterType: 3,
    monsterHp: 0,
    monsterMaxHp: 122,
    relicOfferAvailable: true,
    relicOfferRarity: 1,
    relicOfferId: 1,
    lastLootType: 1,
    lastLootAmount: 1,
  });
  const grid = {
    ...createPracticeGrid(21),
    pendingLoot: { gold: 30, potions: 1, weapon: 0, armor: 0 },
  };
  let entries = 0;
  const result = passPracticeLootAtDoor(game, grid, current => {
    entries += 1;
    return enterNextRoom(current);
  });

  assert.ok(result);
  assert.equal(result.entered, false);
  assert.equal(entries, 0);
  assert.equal(result.game, game);
  assert.equal(result.game.gold, 0);
  assert.equal(result.game.potions, 3);
  assert.equal(result.grid.pendingLoot, null);
  assert.equal(result.game.relicOfferAvailable, true);
  assert.equal(practiceGridPhase(result.game, result.grid), "reward");
  assert.equal(passPracticeLootAtDoor(result.game, result.grid, enterNextRoom), null);
});

test("Practice game and held loot share one validated atomic save", () => {
  const killed = combat({ roomsCleared: 1, monsterHp: 0, gold: 0, lastLootType: 3, lastLootAmount: 1 });
  const grid = {
    ...createPracticeGrid(77),
    pendingLoot: { gold: 9, potions: 0, weapon: 1, armor: 0 },
  };
  const storage = memoryStorage();
  assert.equal(savePracticeRun(storage, killed, grid), "saved");
  assert.equal(storage.writes, 1);
  assert.deepEqual(inspectPracticeRun(storage), { status: "restored", game: killed, grid, legacy: false });

  const invalid = memoryStorage("previous save");
  assert.equal(savePracticeRun(invalid, { ...killed, potions: 5 }, { ...grid, pendingLoot: { gold: 9, potions: 1, weapon: 0, armor: 0 } }), "invalid");
  assert.equal(invalid.raw, "previous save");
  assert.equal(invalid.writes, 0);
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

test("the grid adapter preserves real endless engine progression through every artwork tier", (context) => {
  context.mock.method(globalThis.crypto, "getRandomValues", (array: Uint32Array) => { array.fill(0); return array; });
  let game = startRun();
  let grid = createPracticeGrid(0xdecafbad);
  const tierEntrances = new Set<number>();

  while (game.roomsCleared < 42) {
    const currentRoom = game.roomsCleared + 1;
    if ([1, 11, 21, 31, 41].includes(currentRoom)) {
      assert.equal(practiceGridPhase(game, grid), "explore", `room ${currentRoom} should begin with an approach`);
      tierEntrances.add(currentRoom);
    }
    grid = engagePracticeGrid(grid);
    assert.equal(practiceGridPhase(game, grid), "combat");

    while (game.monsterHp > 0) {
      const before = { ...game, hp: game.maxHp };
      const resolved = attack(before);
      grid = countPracticeTurn(grid);
      const held = holdPracticeLoot(before, resolved, grid);
      game = held.game;
      grid = held.grid;
      assert.equal(isStoredPracticeGame(game), true, `invalid grid-backed game in room ${currentRoom}`);
    }

    assert.equal(practiceGridPhase(game, grid), "loot");
    const collected = collectPracticeLoot(game, grid);
    game = collected.game;
    grid = collected.grid;
    assert.equal(practiceGridPhase(game, grid), game.relicOfferAvailable ? "reward" : "recovery");
    if (game.relicOfferAvailable) game = claimRelic(game, false);
    if (game.roomsCleared === 42) break;
    game = enterNextRoom(game);
    grid = enterPracticeRoom(grid);
  }

  assert.deepEqual([...tierEntrances], [1, 11, 21, 31, 41]);
  assert.equal(game.roomsCleared, 42);
  assert.equal(practiceGridPhase(game, grid), "recovery");
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
