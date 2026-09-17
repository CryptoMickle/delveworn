import assert from "node:assert/strict";
import test from "node:test";
import {
  isExplicitWalletRejection,
  pollForCanonicalRecovery,
} from "../app/onchain-recovery";

test("delayed inclusion remains locked until canonical state changes", async () => {
  const snapshots = [
    { pendingRequestId: BigInt(0), changed: false },
    { pendingRequestId: BigInt(0), changed: false },
    { pendingRequestId: BigInt(71), changed: true },
  ];
  let reads = 0;
  let now = 0;
  const recovered = await pollForCanonicalRecovery({
    readCanonical: async () => snapshots[Math.min(reads++, snapshots.length - 1)],
    isRecovered: (state) => state.pendingRequestId > BigInt(0) || state.changed,
    wait: async () => {
      now += 250;
    },
    now: () => now,
    deadline: 2_000,
  });

  assert.equal(reads, 3);
  assert.deepEqual(recovered, snapshots[2]);
});

test("delayed loot settlement survives a waiter error before inclusion", async () => {
  const pending = [true, true, false];
  let reads = 0;
  let now = 0;
  const recovered = await pollForCanonicalRecovery({
    readCanonical: async () => ({
      pendingLoot: { available: pending[Math.min(reads++, pending.length - 1)] },
    }),
    isRecovered: (state) => !state.pendingLoot.available,
    wait: async () => {
      now += 250;
    },
    now: () => now,
    deadline: 2_000,
  });

  assert.equal(reads, 3);
  assert.equal(recovered?.pendingLoot.available, false);
});

test("only explicit wallet rejection skips ambiguous-submission recovery", () => {
  assert.equal(isExplicitWalletRejection({ code: 4001 }), true);
  assert.equal(isExplicitWalletRejection(new Error("User rejected the request")), true);
  assert.equal(isExplicitWalletRejection(new Error("receipt transport failed")), false);
  assert.equal(isExplicitWalletRejection(new Error("bundler request rejected")), false);
});
