import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeOnchainLoot,
  applyConfirmedOnchainPresentation,
  canUseOnchainPresentationAction,
  createOnchainPresentationState,
  engageOnchainEncounter,
  onchainPresentationKey,
  onchainPresentationPhase,
  onchainPresentationScope,
  type OnchainPresentationSnapshot,
} from "../app/onchain-presentation";
import { createWalletViewGuard } from "../app/wallet-view-guard";

const fight = (overrides: Partial<OnchainPresentationSnapshot> = {}): OnchainPresentationSnapshot => ({
  active: true,
  monsterHp: 30,
  roomsCleared: 0,
  gold: 0,
  lastLootType: 0,
  lastLootAmount: 0,
  relicOfferAvailable: false,
  ...overrides,
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
