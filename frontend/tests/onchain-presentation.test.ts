import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeOnchainLoot,
  applyConfirmedOnchainPresentation,
  canUseOnchainPresentationAction,
  confirmedOnchainCombatCue,
  createOnchainPresentationState,
  engageOnchainEncounter,
  onchainDoorDecision,
  onchainPresentationKey,
  onchainPresentationPhase,
  onchainPresentationScope,
  onchainRoomLoot,
  type OnchainPresentationSnapshot,
} from "../app/onchain-presentation";
import { EMPTY_PENDING_ROOM_LOOT } from "../app/onchain-v4";
import { createWalletViewGuard } from "../app/wallet-view-guard";

const fight = (overrides: Partial<OnchainPresentationSnapshot> = {}): OnchainPresentationSnapshot => ({
  active: true,
  monsterHp: 30,
  roomsCleared: 0,
  gold: 0,
  lastLootType: 0,
  lastLootAmount: 0,
  relicOfferAvailable: false,
  supportsPendingLoot: false,
  pendingLoot: EMPTY_PENDING_ROOM_LOOT,
  ...overrides,
});

const pendingLoot = (overrides: Partial<OnchainPresentationSnapshot["pendingLoot"]> = {}) => ({
  available: true,
  room: 1,
  gold: 12,
  lootType: 3 as const,
  lootAmount: 1,
  ...overrides,
});

test("combat animation and audio wait for VRF, including interrupted-confirmation recovery", () => {
  const before = { active: true, monsterType: 1, monsterHp: 30, roomsCleared: 0,
    pendingRequestId: BigInt(0), relicReviveUsed: false, lastCritical: false, lastMonsterDamage: 0 };
  for (const action of ["attack", "stormAttack", "usePotion"]) {
    assert.equal(confirmedOnchainCombatCue(action, before, { ...before, pendingRequestId: BigInt(87) }), null);
  }
  const resolved = { ...before, monsterHp: 20, lastMonsterDamage: 4 };
  assert.deepEqual(confirmedOnchainCombatCue("attack", before, resolved), { cue: "attack", actionSound: "attack", outcomeSound: "hit" });
  assert.deepEqual(confirmedOnchainCombatCue("stormAttack", before, resolved), { cue: "storm", actionSound: "storm", outcomeSound: "hit" });
  assert.deepEqual(confirmedOnchainCombatCue("usePotion", before, resolved), { cue: "potion", actionSound: "potion", outcomeSound: "hit" });
  assert.equal(confirmedOnchainCombatCue("enterNextRoom", before, resolved), null);
});

test("confirmed scene sounds distinguish critical, boss kill, revive, death and safe healing", () => {
  const before = { active: true, monsterType: 3, monsterHp: 30, roomsCleared: 9,
    pendingRequestId: BigInt(0), relicReviveUsed: false, lastCritical: false, lastMonsterDamage: 0 };
  assert.deepEqual(confirmedOnchainCombatCue("attack", before, { ...before, lastCritical: true }),
    { cue: "critical", actionSound: "attack", outcomeSound: "critical" });
  assert.equal(confirmedOnchainCombatCue("attack", before, { ...before, monsterHp: 0, roomsCleared: 10 })?.outcomeSound, "victory");
  assert.equal(confirmedOnchainCombatCue("attack", { ...before, monsterType: 1 }, { ...before, monsterHp: 0, roomsCleared: 10 })?.outcomeSound, "loot");
  assert.equal(confirmedOnchainCombatCue("attack", before, { ...before, active: false })?.outcomeSound, "death");
  assert.deepEqual(confirmedOnchainCombatCue("attack", before, { ...before, relicReviveUsed: true }),
    { cue: "revive", actionSound: "potion", outcomeSound: "hit" });
  assert.deepEqual(confirmedOnchainCombatCue("usePotion", before, before),
    { cue: "potion", actionSound: "potion", outcomeSound: null });
});

test("confirmed kills expose optional floor loot without changing credited resources", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const before = fight({ monsterHp: 4, gold: 10 });
  const credited = fight({ monsterHp: 0, roomsCleared: 1, gold: 27, lastLootType: 3, lastLootAmount: 1 });
  const shown = applyConfirmedOnchainPresentation(createOnchainPresentationState(), scope, "attack", before, credited);

  assert.deepEqual(shown.loot, { room: 1, type: 3, amount: 1, gold: 17, relicId: 0 });
  assert.equal(onchainPresentationPhase(shown, scope, credited), "loot");
  const acknowledged = acknowledgeOnchainLoot(shown, scope, 1);
  assert.equal(acknowledged.loot, null);
  assert.deepEqual(credited, fight({ monsterHp: 0, roomsCleared: 1, gold: 27, lastLootType: 3, lastLootAmount: 1 }));
  assert.equal(onchainPresentationPhase(acknowledged, scope, credited), "recovery");
});

test("safe potion use is limited to confirmed cleared-room phases and preserves pending loot", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const beforeKill = fight({ monsterHp: 3, gold: 10 });
  const cleared = fight({ monsterHp: 0, roomsCleared: 1, gold: 22, lastLootType: 2, lastLootAmount: 4 });
  const loot = applyConfirmedOnchainPresentation(createOnchainPresentationState(), scope, "attack", beforeKill, cleared);

  assert.equal(canUseOnchainPresentationAction(loot, scope, cleared, false, "safe-potion"), true);
  assert.equal(canUseOnchainPresentationAction(loot, scope, cleared, true, "safe-potion"), false);
  assert.equal(canUseOnchainPresentationAction(loot, scope, fight(), false, "safe-potion"), false);

  const healed = applyConfirmedOnchainPresentation(loot, scope, "usePotion", cleared, cleared);
  assert.deepEqual(healed.loot, loot.loot);
  assert.equal(onchainPresentationPhase(healed, scope, cleared), "loot");

  const acknowledged = acknowledgeOnchainLoot(healed, scope, 1);
  assert.equal(canUseOnchainPresentationAction(acknowledged, scope, cleared, false, "safe-potion"), true);
  assert.equal(
    canUseOnchainPresentationAction(
      acknowledged,
      scope,
      { ...cleared, relicOfferAvailable: true },
      false,
      "safe-potion"
    ),
    false
  );
});

test("a door pass enters after ordinary floor loot only when the transition confirms", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const beforeKill = fight({ monsterHp: 3, gold: 10 });
  const cleared = fight({ monsterHp: 0, roomsCleared: 1, gold: 22, lastLootType: 2, lastLootAmount: 4 });
  const loot = applyConfirmedOnchainPresentation(createOnchainPresentationState(), scope, "attack", beforeKill, cleared);

  assert.equal(onchainDoorDecision(loot, scope, cleared, false, false), "blocked");
  assert.equal(onchainDoorDecision(loot, scope, cleared, true, true), "blocked");
  assert.equal(onchainDoorDecision(loot, scope, cleared, false, true), "enter-next-room");

  // A rejected or interrupted send applies no confirmed snapshot, so the same
  // floor presentation remains available for a retry.
  assert.equal(onchainPresentationPhase(loot, scope, cleared), "loot");
  assert.equal(onchainDoorDecision(loot, scope, cleared, false, true), "enter-next-room");

  const enteredSnapshot = fight({ roomsCleared: 1, monsterHp: 35, gold: 22 });
  const entered = applyConfirmedOnchainPresentation(loot, scope, "enterNextRoom", cleared, enteredSnapshot);
  assert.equal(entered.loot, null);
  assert.equal(onchainPresentationPhase(entered, scope, enteredSnapshot), "explore");
});

test("a boss-loot door pass reveals the confirmed relic decision without entering", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const beforeKill = fight({ monsterHp: 2, roomsCleared: 9 });
  const cleared = fight({ monsterHp: 0, roomsCleared: 10, gold: 40, relicOfferAvailable: true });
  const loot = applyConfirmedOnchainPresentation(createOnchainPresentationState(), scope, "attack", beforeKill, cleared);

  assert.equal(onchainDoorDecision(loot, scope, cleared, false, true), "acknowledge-relic");
  const acknowledged = acknowledgeOnchainLoot(loot, scope, 10);
  assert.equal(acknowledged.loot, null);
  assert.equal(onchainPresentationPhase(acknowledged, scope, cleared), "reward");
});

test("confirmed start and room entry require a local approach and reset stale loot", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const stale = applyConfirmedOnchainPresentation(createOnchainPresentationState(), scope, "attack", fight({ monsterHp: 1 }), fight({ monsterHp: 0, roomsCleared: 1, gold: 8 }));
  const started = applyConfirmedOnchainPresentation(stale, scope, "startGame", fight({ active: false }), fight());

  assert.equal(started.loot, null);
  assert.equal(started.runGeneration, 1);
  assert.equal(onchainPresentationPhase(started, scope, fight()), "explore");
  const engaged = engageOnchainEncounter(started, scope, 1);
  assert.equal(onchainPresentationPhase(engaged, scope, fight()), "combat");

  const entered = applyConfirmedOnchainPresentation(engaged, scope, "enterNextRoom", fight({ monsterHp: 0, roomsCleared: 1 }), fight({ roomsCleared: 1 }));
  assert.equal(entered.encounter?.room, 2);
  assert.equal(onchainPresentationPhase(entered, scope, fight({ roomsCleared: 1 })), "explore");
});

test("a canonical mid-fight reload resumes combat and pending state blocks local actions", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const restored = createOnchainPresentationState();
  assert.equal(onchainPresentationPhase(restored, scope, fight({ monsterHp: 18 })), "combat");
  assert.equal(canUseOnchainPresentationAction(restored, scope, fight(), true, "combat"), false);

  const entered = applyConfirmedOnchainPresentation(restored, scope, "enterNextRoom", fight({ monsterHp: 0 }), fight());
  assert.equal(canUseOnchainPresentationAction(entered, scope, fight(), false, "combat"), false);
  assert.equal(canUseOnchainPresentationAction(entered, scope, fight(), false, "approach"), true);
  assert.equal(canUseOnchainPresentationAction(entered, scope, fight(), true, "approach"), false);

  const loot = applyConfirmedOnchainPresentation(entered, scope, "attack", fight({ monsterHp: 1 }), fight({ monsterHp: 0, roomsCleared: 1 }));
  assert.equal(canUseOnchainPresentationAction(loot, scope, fight({ monsterHp: 0, roomsCleared: 1 }), true, "acknowledge-loot"), false);
});

test("presentation scope follows wallet ticket generation, mode, and acting player", () => {
  const guard = createWalletViewGuard();
  const standard = onchainPresentationScope(50312, "0xOwner", guard.select("0xOwner", "standard"));
  const session = onchainPresentationScope(50312, "0xSmart", guard.select("0xOwner", "somnia-session"));
  const reselected = onchainPresentationScope(50312, "0xOwner", guard.select("0xOwner", "standard"));

  assert.notEqual(standard, session);
  assert.notEqual(standard, reselected);
  assert.notEqual(reselected, onchainPresentationScope(50312, "0xDifferent", guard.capture()));
  const state = applyConfirmedOnchainPresentation(createOnchainPresentationState(), standard, "startGame", fight({ active: false }), fight());
  assert.notEqual(onchainPresentationKey(state, standard), onchainPresentationKey(state, session));
});

test("V4 reload restores pending floor loot entirely from the canonical snapshot", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const restored = fight({
    monsterHp: 0,
    roomsCleared: 1,
    supportsPendingLoot: true,
    pendingLoot: pendingLoot(),
  });
  const local = createOnchainPresentationState();

  assert.equal(onchainPresentationPhase(local, scope, restored), "loot");
  assert.deepEqual(onchainRoomLoot(local, scope, restored), {
    room: 1,
    type: 3,
    amount: 1,
    gold: 12,
    relicId: 0,
  });
});

test("V4 collect changes the floor only after a confirmed snapshot settles it", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const before = fight({
    monsterHp: 0,
    roomsCleared: 1,
    gold: 4,
    supportsPendingLoot: true,
    pendingLoot: pendingLoot({ lootType: 2, lootAmount: 7, gold: 12 }),
  });
  const local = createOnchainPresentationState();

  // A rejected send applies no later snapshot, so the same canonical floor
  // object remains visible and collectible.
  assert.equal(onchainPresentationPhase(local, scope, before), "loot");
  assert.equal(onchainRoomLoot(local, scope, before)?.gold, 12);

  const after = fight({
    monsterHp: 0,
    roomsCleared: 1,
    gold: 16,
    supportsPendingLoot: true,
    pendingLoot: EMPTY_PENDING_ROOM_LOOT,
  });
  const confirmed = applyConfirmedOnchainPresentation(local, scope, "collectLoot", before, after);
  assert.equal(onchainRoomLoot(confirmed, scope, after), null);
  assert.equal(onchainPresentationPhase(confirmed, scope, after), "recovery");
});

test("V4 safe potion confirmation preserves canonical pending loot", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const before = fight({
    monsterHp: 0,
    roomsCleared: 5,
    supportsPendingLoot: true,
    pendingLoot: pendingLoot({ room: 5, lootType: 1, lootAmount: 1 }),
  });
  const after = { ...before };
  const state = applyConfirmedOnchainPresentation(
    createOnchainPresentationState(),
    scope,
    "usePotion",
    before,
    after
  );

  assert.equal(canUseOnchainPresentationAction(state, scope, after, false, "safe-potion"), true);
  assert.deepEqual(onchainRoomLoot(state, scope, after), {
    room: 5,
    type: 1,
    amount: 1,
    gold: 12,
    relicId: 0,
  });
});

test("V4 door bypass is atomic for ordinary rooms and confirmed discard gates boss relics", () => {
  const guard = createWalletViewGuard();
  const scope = onchainPresentationScope(50312, "0xPlayer", guard.select("0xOwner", "standard"));
  const local = createOnchainPresentationState();
  const ordinary = fight({
    monsterHp: 0,
    roomsCleared: 1,
    supportsPendingLoot: true,
    pendingLoot: pendingLoot(),
  });
  assert.equal(onchainDoorDecision(local, scope, ordinary, false, true), "enter-next-room");

  const boss = fight({
    monsterHp: 0,
    roomsCleared: 10,
    relicOfferAvailable: true,
    supportsPendingLoot: true,
    pendingLoot: pendingLoot({ room: 10 }),
  });
  assert.equal(onchainDoorDecision(local, scope, boss, false, true), "discard-loot");
  assert.equal(onchainPresentationPhase(local, scope, boss), "loot");

  const discarded = { ...boss, pendingLoot: EMPTY_PENDING_ROOM_LOOT };
  assert.equal(onchainPresentationPhase(local, scope, discarded), "reward");
});
