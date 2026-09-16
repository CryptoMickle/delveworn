import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  attack,
  buy,
  claimRelic,
  enterNextRoom,
  startRun,
  stormAttack,
  usePotion as drinkPotion,
  type PracticeGame,
  type ShopAction,
} from "../app/practice/engine";
import { createSeededRandom, type SeededRandom } from "../app/practice/random";
import { createDescent, enemyIntent, phase, ROOMS, transition, type Descent, type DescentAction } from "../app/descent/model";
import { DESCENT_SAVE_KEY, isDescent, LEGACY_DESCENT_SAVE_KEY, loadDescent, saveDescent } from "../app/descent/storage";

test("classic Practice/Weekly transitions and RNG retain pre-descent golden vectors", () => {
  for (const [seed, digest] of [[12345, "56d74384924ac87430f5d6ec9a63e608b41770534f998ee4f33844080ef851a7"], [123456, "f2c4b638b13bd6c4483352f7420a63ad39d9e8579c42fc9ebb13e870b558d7ea"], [987654, "e4b2971e068a38e318ab83d9757192b3e56890c318b768c0e5a3b34b3ed9f889"]] as const) {
    const rng = createSeededRandom(seed); let g = startRun(rng.nextInt), i = 0;
    while (g.active && g.roomsCleared < 10 && i++ < 200) {
      if (g.relicOfferAvailable) g = claimRelic(g, false);
      else if (g.monsterHp === 0) g = enterNextRoom(g, rng.nextInt);
      else if (g.hp < 40 && g.potions > 0 && g.combatPotionsUsed < (g.monsterType === 3 ? 3 : 2)) g = drinkPotion(g, rng.nextInt);
      else g = i % 5 === 0 ? stormAttack(g, rng.nextInt) : attack(g, rng.nextInt);
    }
    assert.equal(createHash("sha256").update(JSON.stringify({ g, rng: rng.state() })).digest("hex"), digest);
  }
});

test("a descent starts exactly like the curated Practice engine with no relic or build", () => {
  for (const seed of [0, 1, 42, 12345]) {
    const rng = createSeededRandom(seed);
    const expected = startRun(rng.nextInt, ROOMS[0].enemy);
    const run = createDescent(seed, `start-${seed}`);
    assert.deepEqual(run.game, expected);
    assert.equal(run.rngState, rng.state());
    assert.equal("build" in run, false);
    assert.equal(run.game.hp, 100);
    assert.equal(run.game.maxHp, 100);
    assert.equal(run.game.potions, 3);
    assert.equal(run.game.equippedRelic, 0);
    assert.deepEqual(run.game.ownedRelics, []);
    assert.ok(run.game.relicCounts.every(count => count === 0));
    assert.equal(run.pendingLoot, null);
  }
});

test("leaving floor loot forfeits its resources once and persists without changing combat randomness", () => {
  const found = new Set<number>();
  for (let seed = 1; seed < 500 && found.size < 4; seed++) {
    let before = transition(createDescent(seed, `skip-${seed}`), "engage");
    before = { ...before, game: { ...before.game, monsterHp: 1 } };
    const killed = transition(before, "attack");
    if (found.has(killed.game.lastLootType)) continue;
    found.add(killed.game.lastLootType);
    assert.equal(phase(killed), "loot");
    const skipped = transition(killed, "skip-loot");
    assert.equal(phase(skipped), "recovery");
    assert.deepEqual(skipped.game, killed.game, "uncollected resources never enter the inventory");
    assert.equal(skipped.pendingLoot, null);
    assert.equal(skipped.rngState, killed.rngState);
    assert.equal(skipped.turns, killed.turns);
    assert.equal(skipped.revision, killed.revision + 1);
    assert.equal(transition(skipped, "skip-loot"), skipped);
    assert.equal(transition(skipped, "collect"), skipped, "a canceled pickup cannot restore forfeited loot");
    assert.equal(transition(killed, "skip-loot", killed.revision - 1), killed);
    assert.ok(isDescent(JSON.parse(JSON.stringify(skipped))));
    assert.equal(phase(transition(skipped, "enter")), "explore");
  }
  assert.equal(found.size, 4);
});

test("walking to the door leaves loot and enters atomically without credit or duplicate entry", () => {
  const combat = transition(createDescent(99, "door-bypass"), "engage");
  const killed = transition({ ...combat, game: { ...combat.game, monsterHp: 1 } }, "attack");
  assert.equal(phase(killed), "loot");
  const entered = transition(killed, "enter");
  const expected = transition(transition(killed, "skip-loot"), "enter");
  assert.equal(phase(entered), "explore");
  assert.deepEqual(entered.game, expected.game);
  assert.equal(entered.rngState, expected.rngState, "only the existing room entry consumes randomness");
  assert.equal(entered.pendingLoot, null);
  assert.equal(entered.turns, killed.turns);
  assert.equal(entered.revision, killed.revision + 1, "discard and entry are one save transition");
  assert.equal(transition(killed, "enter", killed.revision - 1), killed);
  assert.equal(transition(entered, "enter"), entered, "replayed arrival cannot skip another room");
  assert.equal(transition(entered, "collect"), entered, "left loot cannot be collected later");
  assert.ok(isDescent(JSON.parse(JSON.stringify(entered))));
});

test("safe potions preserve pending loot and its collect-or-leave balance without turns or randomness", () => {
  const combat = transition(createDescent(99, "loot-potion"), "engage");
  const killed = transition({ ...combat, game: { ...combat.game, hp: 40, monsterHp: 1 } }, "attack");
  assert.equal(phase(killed), "loot");
  assert.ok(killed.pendingLoot);

  const healed = transition(killed, "potion");
  assert.equal(phase(healed), "loot");
  assert.equal(healed.game.hp, 65);
  assert.equal(healed.game.potions, killed.game.potions - 1);
  assert.equal(healed.game.combatPotionsUsed, killed.game.combatPotionsUsed);
  assert.equal(healed.game.lastMonsterDamage, 0);
  assert.strictEqual(healed.pendingLoot, killed.pendingLoot);
  assert.equal(healed.rngState, killed.rngState);
  assert.equal(healed.turns, killed.turns);
  assert.equal(healed.roomTurns, killed.roomTurns);
  assert.equal(healed.damageDealt, killed.damageDealt);
  assert.equal(healed.damageTaken, killed.damageTaken);
  assert.equal(healed.potionsUsed, killed.potionsUsed + 1);
  assert.equal(healed.revision, killed.revision + 1);
  assert.ok(isDescent(healed));

  const collected = transition(healed, "collect");
  assert.equal(collected.pendingLoot, null);
  assert.equal(collected.game.gold, healed.game.gold + killed.pendingLoot.gold);
  assert.equal(collected.game.potions, healed.game.potions + killed.pendingLoot.potions);
  assert.equal(collected.game.weaponLevel, healed.game.weaponLevel + killed.pendingLoot.weapon);
  assert.equal(collected.game.armorLevel, healed.game.armorLevel + killed.pendingLoot.armor);
  assert.ok(isDescent(collected));

  const entered = transition(healed, "enter");
  const skipped = transition(healed, "skip-loot");
  const enteredAfterSkip = transition(skipped, "enter");
  assert.equal(phase(entered), "explore");
  assert.equal(entered.pendingLoot, null);
  assert.equal(entered.game.gold, enteredAfterSkip.game.gold);
  assert.equal(entered.game.potions, enteredAfterSkip.game.potions);
  assert.equal(entered.game.weaponLevel, enteredAfterSkip.game.weaponLevel);
  assert.equal(entered.game.armorLevel, enteredAfterSkip.game.armorLevel);
  assert.equal(entered.rngState, enteredAfterSkip.rngState);
  assert.equal(entered.revision, healed.revision + 1);
  assert.ok(isDescent(entered));
});

test("Kevin trades against held inventory while floor loot remains pending", () => {
  const started = createDescent(99, "loot-shop");
  const pendingLoot = { gold: 9, potions: 1, weapon: 0, armor: 0 } as const;
  const loot = {
    ...started,
    revision: 8,
    game: {
      ...started.game,
      roomsCleared: 5,
      monsterType: 1 as const,
      monsterHp: 0,
      hp: 50,
      gold: 40,
      potions: 2,
      lastLootType: 1 as const,
      lastLootAmount: 1,
    },
    pendingLoot,
  };
  assert.equal(phase(loot), "loot");
  assert.ok(isDescent(loot));

  const shopped = transition(loot, "supply-bandage");
  assert.equal(phase(shopped), "loot");
  assert.equal(shopped.game.hp, 75);
  assert.equal(shopped.game.gold, 20, "the purchase uses only gold already held");
  assert.equal(shopped.game.potions, 2, "pending potions remain on the floor");
  assert.strictEqual(shopped.pendingLoot, pendingLoot, "shopping does not collect or replace floor loot");
  assert.equal(shopped.revision, loot.revision + 1);
  assert.equal(shopped.rngState,loot.rngState,"shopping does not draw combat randomness");
  assert.equal(shopped.turns,loot.turns,"shopping does not spend a combat turn");
  assert.equal(shopped.roomTurns,loot.roomTurns,"shopping does not spend a room turn");
  assert.ok(isDescent(shopped),"the purchase remains a valid save while loot waits");

  const poor={...loot,game:{...loot.game,gold:15}};
  assert.strictEqual(transition(poor,"supply-bandage"),poor,"pending floor gold cannot finance a purchase");
  const combat={...loot,pendingLoot:null,engaged:true,game:{...loot.game,monsterHp:10}};
  assert.equal(phase(combat),"combat");
  assert.strictEqual(transition(combat,"supply-bandage"),combat,"Kevin remains unavailable during combat");

  const collected = transition(shopped, "collect");
  assert.equal(collected.game.gold, 29);
  assert.equal(collected.game.potions, 3);
  assert.equal(collected.pendingLoot, null);

  const bypassed = transition(shopped, "enter");
  assert.equal(phase(bypassed), "explore");
  assert.equal(bypassed.game.gold, 20, "the doorway still forfeits pending gold");
  assert.equal(bypassed.game.potions, 2, "the doorway still forfeits pending items");
  assert.equal(bypassed.pendingLoot, null);
});

test("safe potion guards reject stale, full-health, empty-stock and unsafe-phase actions", () => {
  const combat = transition(createDescent(99, "potion-guards"), "engage");
  const killed = transition({ ...combat, game: { ...combat.game, hp: 50, monsterHp: 1, potions: 1 } }, "attack");
  const healed = transition(killed, "potion");
  assert.equal(healed.game.hp, 75);
  assert.equal(healed.game.potions, 0);
  assert.equal(transition(healed, "potion"), healed, "empty stock cannot heal again");
  assert.equal(transition(healed, "potion", killed.revision), healed, "a replay cannot spend another potion");

  const full = { ...killed, game: { ...killed.game, hp: killed.game.maxHp } };
  assert.equal(transition(full, "potion"), full, "full health does not spend stock");
  const exploring = createDescent(99, "unsafe-potion");
  assert.equal(transition(exploring, "potion"), exploring, "an uncleared room is not a safe healing phase");
});

test("enemy descriptions never alter Practice damage or replies", () => {
  for (const type of [0, 1, 2, 3] as const) {
    for (let turn = 0; turn < 8; turn++) {
      const intent = enemyIntent(type, turn);
      assert.equal(intent.attackPercent, 100);
      assert.equal(intent.replyPercent, 100);
      assert.equal(intent.kind, "steady");
    }
  }
});

function collectedGame(run: Descent): PracticeGame {
  if (run.pendingLoot === null) return run.game;
  return {
    ...run.game,
    gold: run.game.gold + run.pendingLoot.gold,
    potions: run.game.potions + run.pendingLoot.potions,
    weaponLevel: run.game.weaponLevel + run.pendingLoot.weapon,
    armorLevel: run.game.armorLevel + run.pendingLoot.armor,
  };
}

function directTransition(game: PracticeGame, action: DescentAction, rng: SeededRandom): PracticeGame {
  if (action === "attack") return attack(game, rng.nextInt);
  if (action === "storm") return stormAttack(game, rng.nextInt);
  if (action === "potion") return drinkPotion(game, rng.nextInt);
  if (action === "enter") return enterNextRoom(game, rng.nextInt, ROOMS[game.roomsCleared].enemy);
  if (action === "claim" || action === "claim-equip") return claimRelic(game, action === "claim-equip");
  if (action.startsWith("supply-") || action.startsWith("camp-")) return buy(game, action as ShopAction);
  return game;
}

function tracePolicy(run: Descent): DescentAction {
  const current = phase(run), g = run.game;
  if (current === "explore") return "engage";
  if (current === "loot") return "collect";
  if (current === "reward") return "claim";
  if (current === "recovery") {
    if (g.hp <= g.maxHp - 25 && g.potions > 0) return "potion";
    return "enter";
  }
  if (run.roomTurns % 3 === 1) return "storm";
  if (run.roomTurns % 3 === 2 && g.hp < g.maxHp && g.potions > 0
    && g.combatPotionsUsed < (g.monsterType === 3 ? 3 : 2)) return "potion";
  return "attack";
}

test("attack, storm, potion, encounters and RNG match the Practice engine through complete traces", () => {
  const seen = new Set<DescentAction>();
  let completed = false;
  for (const seed of [7, 42, 336, 12345]) {
    const rng = createSeededRandom(seed);
    let expected = startRun(rng.nextInt, ROOMS[0].enemy);
    let run = createDescent(seed, `trace-${seed}`);
    for (let i = 0; i < 300 && !["won", "lost"].includes(phase(run)); i++) {
      const action = tracePolicy(run);
      seen.add(action);
      expected = directTransition(expected, action, rng);
      const next = transition(run, action);
      assert.notEqual(next, run, `trace stalled for ${action} at room ${run.game.roomsCleared + 1}`);
      assert.equal(next.rngState, rng.state(), `RNG diverged after ${action}`);
      assert.deepEqual(collectedGame(next), expected, `engine state diverged after ${action}`);
      assert.ok(isDescent(next));
      run = next;
    }
    assert.ok(["won", "lost"].includes(phase(run)), `seed ${seed} did not finish`);
    completed ||= phase(run) === "won";
  }
  for (const action of ["attack", "storm", "potion", "collect"] as const) assert.ok(seen.has(action), `${action} was not exercised`);
  assert.ok(completed, "the parity traces did not include a complete ten-room win");
});

test("every engine loot result waits for collection, survives reload, and applies exactly once", () => {
  const found = new Set<number>();
  for (let seed = 1; seed <= 5_000 && found.size < 4; seed++) {
    let before = transition(createDescent(seed, `loot-${seed}`), "engage");
    before = { ...before, game: { ...before.game, monsterHp: 1 } };
    const directRng = createSeededRandom(before.seed, before.rngState);
    const granted = attack(before.game, directRng.nextInt);
    if (found.has(granted.lastLootType)) continue;
    found.add(granted.lastLootType);

    const killed = transition(before, "attack");
    assert.equal(phase(killed), "loot");
    assert.equal(killed.rngState, directRng.state());
    assert.deepEqual(killed.pendingLoot, {
      gold: granted.gold - before.game.gold,
      potions: granted.potions - before.game.potions,
      weapon: granted.weaponLevel - before.game.weaponLevel,
      armor: granted.armorLevel - before.game.armorLevel,
    });
    assert.deepEqual({
      gold: killed.game.gold,
      potions: killed.game.potions,
      weapon: killed.game.weaponLevel,
      armor: killed.game.armorLevel,
    }, {
      gold: before.game.gold,
      potions: before.game.potions,
      weapon: before.game.weaponLevel,
      armor: before.game.armorLevel,
    });

    const map = new Map<string, string>();
    const source = () => ({
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value); },
    });
    assert.equal(saveDescent(source, killed, null), "saved");
    const loaded = loadDescent(source);
    assert.equal(loaded.status, "restored");
    if (loaded.status !== "restored") throw new Error("pending loot did not reload");
    assert.deepEqual(loaded.run, killed);

    for (const action of ["engage", "attack", "storm", "claim", "claim-equip", "supply-bandage", "camp-rest"] as const) {
      assert.equal(transition(loaded.run, action), loaded.run, `${action} progressed before pickup`);
    }
    assert.equal(transition(loaded.run, "collect", loaded.run.revision - 1), loaded.run);

    const picked = transition(loaded.run, "collect");
    assert.equal(picked.rngState, loaded.run.rngState);
    assert.equal(picked.turns, loaded.run.turns);
    assert.equal(picked.roomTurns, loaded.run.roomTurns);
    assert.equal(picked.pendingLoot, null);
    assert.deepEqual(picked.game, granted);
    assert.equal(transition(picked, "collect"), picked);
    assert.equal(transition(picked, "collect", loaded.run.revision), picked);
  }
  assert.deepEqual([...found].sort(), [1, 2, 3, 4]);
});

test("boss loot is collected before the original keep or equip relic choice", () => {
  let ready = transition(createDescent(99, "boss"), "engage");
  ready = {
    ...ready,
    game: {
      ...ready.game,
      hp: 50,
      roomsCleared: 9,
      monsterType: 3,
      monsterHp: 1,
      monsterMaxHp: 122,
    },
  };
  assert.ok(isDescent(ready));
  const killed = transition(ready, "attack");
  assert.equal(phase(killed), "loot");
  assert.ok(isDescent(killed));
  assert.ok(killed.game.relicOfferAvailable);
  assert.ok(killed.game.relicOfferId > 0);
  assert.deepEqual(killed.game.ownedRelics, []);
  assert.equal(killed.game.equippedRelic, 0);
  assert.equal(transition(killed, "claim"), killed);

  const healed = transition(killed, "potion");
  assert.equal(phase(healed), "loot", "boss supplies stay on the floor while healing");
  assert.strictEqual(healed.pendingLoot, killed.pendingLoot);
  assert.equal(healed.game.hp, 75);
  assert.equal(healed.game.potions, killed.game.potions - 1);
  assert.equal(healed.game.relicOfferId, killed.game.relicOfferId);
  assert.equal(healed.rngState, killed.rngState);

  const door = transition(healed, "enter");
  assert.equal(phase(door), "reward", "the exit preserves the required boss relic choice");
  assert.deepEqual(door.game, healed.game);
  assert.equal(door.pendingLoot, null);
  assert.equal(door.rngState, healed.rngState);
  assert.equal(door.revision, healed.revision + 1);
  assert.equal(transition(door, "enter"), door);

  const left = transition(healed, "skip-loot");
  assert.equal(phase(left), "reward", "leaving supplies still allows the existing boss relic decision");
  assert.deepEqual(left.game, healed.game);
  assert.equal(left.rngState, healed.rngState);
  assert.equal(phase(transition(left, "claim")), "won");
  assert.ok(isDescent(transition(left, "claim")));

  const reward = transition(healed, "collect");
  assert.equal(phase(reward), "reward");
  assert.ok(isDescent(reward));
  assert.deepEqual(reward.game.ownedRelics, []);

  const kept = transition(reward, "claim");
  assert.deepEqual(kept.game, claimRelic(reward.game, false));
  assert.equal(kept.game.equippedRelic, 0);
  assert.ok(kept.game.ownedRelics.includes(reward.game.relicOfferId));
  assert.equal(phase(kept), "won");
  assert.ok(isDescent(kept));

  const equipped = transition(reward, "claim-equip");
  assert.deepEqual(equipped.game, claimRelic(reward.game, true));
  assert.equal(equipped.game.equippedRelic, reward.game.relicOfferId);
  assert.ok(equipped.game.ownedRelics.includes(reward.game.relicOfferId));
  assert.equal(phase(equipped), "won");
  assert.ok(isDescent(equipped));
});

test("movement, invalid, and stale commands never spend a turn or random draw", () => {
  const run = createDescent(123, "guard");
  for (const action of ["attack", "storm", "enter", "collect", "skip-loot", "claim", "claim-equip", "camp-weapon", "potion"] as const) {
    assert.equal(transition(run, action), run);
  }
  const engaged = transition(run, "engage");
  assert.equal(engaged.rngState, run.rngState);
  assert.equal(engaged.turns, 0);
  const struck = transition(engaged, "attack", engaged.revision);
  assert.equal(transition(struck, "attack", engaged.revision), struck);
  assert.equal(transition(struck, "enter"), struck);
});

test("death restores as death and cannot accept further commands", () => {
  let run = transition(createDescent(7, "death"), "engage");
  run = { ...run, game: { ...run.game, hp: 1 } };
  run = transition(run, "attack");
  assert.equal(phase(run), "lost");
  assert.ok(isDescent(run));
  assert.equal(run.pendingLoot, null);
  assert.equal(transition(run, "potion"), run);
});

test("v2 storage preserves v1 previews and rejects stale or malformed saves", () => {
  const map = new Map<string, string>();
  const source = () => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  });
  const legacy = JSON.stringify({ rules: "first-descent-1", build: "warden" });
  map.set(LEGACY_DESCENT_SAVE_KEY, legacy);
  assert.deepEqual(loadDescent(source), { status: "legacy" });

  const run = createDescent(16, "save");
  const starterRelicCounts = Array<number>(16).fill(0);
  starterRelicCounts[2] = 1;
  let pending = transition(createDescent(44, "pending-validation"), "engage");
  pending = transition({ ...pending, game: { ...pending.game, monsterHp: 1 } }, "attack");
  assert.ok(pending.pendingLoot);
  assert.equal(saveDescent(source, run, null), "saved");
  assert.equal(map.get(LEGACY_DESCENT_SAVE_KEY), legacy);
  const next = transition(run, "engage");
  assert.equal(saveDescent(source, next, run), "saved");
  assert.equal(saveDescent(source, next, run), "conflict");
  assert.deepEqual(loadDescent(source), { status: "restored", run: next });

  for (const raw of [
    '{"rules":"future"}',
    "{",
    JSON.stringify({ ...run, rules: "first-descent-1", build: "warden" }),
    JSON.stringify({ ...run, rngState: 0 }),
    JSON.stringify({ ...run, pendingLoot: { gold: 0, potions: 1, weapon: 0, armor: 0 } }),
    JSON.stringify({ ...pending, pendingLoot: { ...pending.pendingLoot!, gold: pending.pendingLoot!.gold + 1 } }),
    JSON.stringify({
      ...run,
      game: {
        ...run.game,
        hp: 120,
        maxHp: 120,
        equippedRelic: 2,
        ownedRelics: [2],
        relicCounts: starterRelicCounts,
      },
    }),
    JSON.stringify({ ...run, game: { ...run.game, monsterHp: 999999 } }),
  ]) {
    map.set(DESCENT_SAVE_KEY, raw);
    assert.equal(loadDescent(source).status, "invalid");
    assert.equal(saveDescent(source, run, null), "conflict");
    assert.equal(map.get(DESCENT_SAVE_KEY), raw);
    assert.equal(map.get(LEGACY_DESCENT_SAVE_KEY), legacy);
  }
  assert.equal(loadDescent(() => { throw Error("blocked"); }).status, "unavailable");
});
