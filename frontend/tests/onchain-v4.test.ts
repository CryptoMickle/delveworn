import assert from "node:assert/strict";
import test from "node:test";
import {
  DUNGEON_CUSTOM_ERROR_ABI,
  PENDING_ROOM_LOOT_ABI_PARAMETER,
  V4_SNAPSHOT_FUNCTION_SIGNATURE,
  bytecodeAdvertisesFunction,
  createFrontendSnapshotV4AbiParameter,
  executePendingLootAction,
  handleSnapshotCapabilityFailure,
  inheritSnapshotCapabilityProof,
  isMissingSnapshotSelectorError,
  markSnapshotCapabilitySupported,
  parseFrontendSnapshotV4,
  potionInventoryWithPendingLoot,
  scopedSnapshotCapabilities,
  selectorForSessionSignature,
  sessionPermissionAllows,
  shouldProbeSnapshotCapability,
  type SnapshotCapability,
} from "../app/onchain-v4";

test("V4 parser preserves the nested V3 snapshot and normalizes pending loot", () => {
  const base = { hp: BigInt(71), roomsCleared: BigInt(9) };
  const relicSnapshot = { base, relicOffer: 6, ownedRelicsMask: 4 };
  const parsed = parseFrontendSnapshotV4({
    base: relicSnapshot,
    pendingLoot: {
      available: true,
      room: BigInt(9),
      gold: BigInt(23),
      lootType: 1,
      lootAmount: BigInt(1),
    },
  });

  assert.equal(parsed.baseSnapshot, base);
  assert.equal(parsed.relicSnapshot, relicSnapshot);
  assert.deepEqual(parsed.pendingLoot, {
    available: true,
    room: 9,
    gold: 23,
    lootType: 1,
    lootAmount: 1,
  });
});

test("only deterministic selector absence may fall back from an unproven V4 probe", () => {
  const capability: SnapshotCapability = { supported: null, retryAfter: 0 };
  assert.equal(shouldProbeSnapshotCapability(capability, 100), true);
  handleSnapshotCapabilityFailure(
    capability,
    100,
    5_000,
    new Error("missing selector"),
    true
  );
  assert.deepEqual(capability, { supported: false, retryAfter: 5_100 });
  assert.equal(shouldProbeSnapshotCapability(capability, 5_099), false);
  assert.equal(shouldProbeSnapshotCapability(capability, 5_100), true);

  markSnapshotCapabilitySupported(capability);
  assert.deepEqual(capability, { supported: true, retryAfter: 0 });
  assert.throws(
    () => handleSnapshotCapabilityFailure(
      capability,
      10_000,
      5_000,
      new Error("temporary read failure"),
      true
    ),
    /temporary read failure/
  );
  assert.equal(capability.supported, true);
});

test("a fresh transport or decode failure cannot downgrade V4 to a legacy snapshot", () => {
  for (const error of [new Error("transport unavailable"), new Error("decode failed")]) {
    const capability: SnapshotCapability = { supported: null, retryAfter: 0 };
    assert.throws(
      () => handleSnapshotCapabilityFailure(capability, 100, 5_000, error, false),
      new RegExp(error.message)
    );
    assert.deepEqual(capability, { supported: null, retryAfter: 0 });
  }
});

test("a V4 proof from either reader prevents the other from downgrading", () => {
  const realtime: SnapshotCapability = { supported: true, retryAfter: 0 };
  const canonical: SnapshotCapability = { supported: false, retryAfter: 5_000 };

  inheritSnapshotCapabilityProof(canonical, [realtime, canonical]);

  assert.deepEqual(canonical, { supported: true, retryAfter: 0 });
  assert.throws(
    () => handleSnapshotCapabilityFailure(
      canonical,
      100,
      5_000,
      new Error("temporary read failure"),
      false
    ),
    /temporary read failure/
  );
});

test("V4 capability evidence is isolated by chain and contract address", () => {
  const cache = new Map();
  const first = scopedSnapshotCapabilities(
    cache,
    50312,
    "0x0000000000000000000000000000000000000001"
  );
  markSnapshotCapabilitySupported(first.canonical);

  const otherAddress = scopedSnapshotCapabilities(
    cache,
    50312,
    "0x0000000000000000000000000000000000000002"
  );
  const otherChain = scopedSnapshotCapabilities(
    cache,
    50313,
    "0x0000000000000000000000000000000000000001"
  );

  assert.equal(otherAddress.canonical.supported, null);
  assert.equal(otherChain.canonical.supported, null);
});

test("missing-selector evidence requires the expected execution error and absent dispatcher selector", () => {
  const noData = {
    name: "ContractFunctionExecutionError",
    cause: { name: "ContractFunctionZeroDataError" },
  };
  const selector = selectorForSessionSignature(V4_SNAPSHOT_FUNCTION_SIGNATURE).slice(2);

  assert.equal(isMissingSnapshotSelectorError(noData), true);
  assert.equal(isMissingSnapshotSelectorError(new Error("network timeout")), false);
  assert.equal(
    bytecodeAdvertisesFunction(`0x600063${selector}14610000`, V4_SNAPSHOT_FUNCTION_SIGNATURE),
    true
  );
  assert.equal(
    bytecodeAdvertisesFunction("0x60006000", V4_SNAPSHOT_FUNCTION_SIGNATURE),
    false
  );
});

test("the V4 ABI keeps the exact nested V3 and pending-loot tuple order", () => {
  const v3Components = [{ name: "baseMarker", type: "uint256" }] as const;
  const snapshot = createFrontendSnapshotV4AbiParameter(v3Components);

  assert.deepEqual(snapshot.components, [
    { name: "base", type: "tuple", components: v3Components },
    PENDING_ROOM_LOOT_ABI_PARAMETER,
  ]);
  assert.deepEqual(PENDING_ROOM_LOOT_ABI_PARAMETER.components, [
    { name: "available", type: "bool" },
    { name: "room", type: "uint256" },
    { name: "gold", type: "uint256" },
    { name: "lootType", type: "uint8" },
    { name: "lootAmount", type: "uint256" },
  ]);
});

test("the frontend ABI includes the finalized core custom errors", () => {
  assert.deepEqual(
    DUNGEON_CUSTOM_ERROR_ABI.map((entry) => entry.name),
    [
      "BossLootPending",
      "GameNotActive",
      "InvalidCoordinator",
      "InvalidRarity",
      "InvalidRelic",
      "InvalidRelicOffer",
      "InvalidRequest",
      "InvalidRoom",
      "LootActionUnavailable",
      "NoPendingRandomness",
      "OnlyCoordinator",
      "RandomnessPending",
      "RequestMismatch",
      "UnknownRequest",
      "VrfRequestNotTimedOut",
      "WrongRandomNumberCount",
    ]
  );
});

test("old RISE grants cannot use new loot selectors while new grants can", () => {
  const dungeon = "0x07c5D071132ae95C3708031790b3feC740F4c292";
  const oldGrant = {
    permissions: {
      calls: [{ to: dungeon, signature: selectorForSessionSignature("attack()") }],
    },
  };
  const newGrant = {
    permissions: {
      calls: [{ to: dungeon, signature: selectorForSessionSignature("collectLoot()") }],
    },
  };

  assert.equal(sessionPermissionAllows(oldGrant, dungeon, "collectLoot()"), false);
  assert.equal(sessionPermissionAllows(newGrant, dungeon, "collectLoot()"), true);
  assert.equal(
    sessionPermissionAllows(newGrant, "0x1111111111111111111111111111111111111111", "collectLoot()"),
    false
  );
});

test("a pending potion reserves inventory space until it is collected or left", () => {
  const pendingPotion = {
    available: true,
    room: 5,
    gold: 17,
    lootType: 1 as const,
    lootAmount: 1,
  };
  assert.equal(potionInventoryWithPendingLoot(4, pendingPotion), 5);
  assert.equal(
    potionInventoryWithPendingLoot(4, { ...pendingPotion, available: false }),
    4
  );
});

test("a receipt timeout after inclusion recovers the settled canonical loot", async () => {
  let pending = true;
  const recovered = await executePendingLootAction(
    async () => {
      pending = false;
      throw new Error("receipt status timed out");
    },
    async () => ({ pendingLoot: { available: pending } })
  );

  assert.equal(recovered.pendingLoot.available, false);
});

test("a rejected loot send keeps canonical pending loot visible", async () => {
  await assert.rejects(
    executePendingLootAction(
      async () => {
        throw new Error("user rejected");
      },
      async () => ({ pendingLoot: { available: true } })
    ),
    /user rejected/
  );
});
