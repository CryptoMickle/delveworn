import assert from "node:assert/strict";
import test from "node:test";
import { createWalletViewGuard } from "../app/wallet-view-guard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

test("a delayed standard-player read cannot replace a newly selected popup-free player", async () => {
  const guard = createWalletViewGuard();
  const ownerRun = Object.freeze({ address: "0xOwner", roomsCleared: 13, gold: 47 });
  const ownerRead = deferred<typeof ownerRun>();
  const standard = guard.select("0xOwner", "standard");
  let visible = { address: "0xSmartAccount", roomsCleared: 2, gold: 9 };
  const pending = ownerRead.promise.then(run => {
    if (guard.isCurrent(standard)) visible = run;
  });

  const session = guard.select("0xOwner", "somnia-session");
  ownerRead.resolve(ownerRun);
  await pending;

  assert.equal(visible.address, "0xSmartAccount");
  assert.equal(guard.isCurrent(session), true);
  assert.equal(ownerRun.roomsCleared, 13);
  assert.equal(ownerRun.gold, 47);
});

test("returning to standard play invalidates an unfinished session restore even for the same owner", async () => {
  const guard = createWalletViewGuard();
  const restore = deferred<{ address: string }>();
  const session = guard.select("0xOwner", "somnia-session");
  let restored = false;
  const pending = restore.promise.then(() => {
    if (guard.isCurrent(session)) restored = true;
  });
  const standard = guard.select("0xOwner", "standard");
  restore.resolve({ address: "0xSmartAccount" });
  await pending;
  assert.equal(restored, false);
  assert.equal(guard.capture(), standard);
  assert.equal(standard.mode, "standard");
});

test("an older rejected restore cannot clear a newer session for the same owner and mode", async () => {
  const guard = createWalletViewGuard();
  const oldRestore = deferred<void>();
  const oldView = guard.select("0xOwner", "somnia-session");
  let storedSession: string | null = "newly-approved-session";
  const pending = oldRestore.promise.catch(() => {
    if (guard.isCurrent(oldView)) storedSession = null;
  });
  const newView = guard.select("0xOWNER", "somnia-session");
  oldRestore.reject(new Error("old permission expired"));
  await pending;
  assert.notEqual(oldView, newView);
  assert.equal(storedSession, "newly-approved-session");
  assert.equal(newView.owner, "0xowner");
  assert.equal(guard.isCurrent(newView), true);
});

test("account changes, disconnect and reconnect invalidate old tickets without accepting forged copies", async () => {
  const guard = createWalletViewGuard();
  assert.equal(guard.capture(), null);
  assert.equal(guard.isCurrent(null), false);
  const ownerA = guard.select("0xA", "somnia-session");
  const ownerB = guard.select("0xB", "somnia-session");
  assert.equal(guard.isCurrent(ownerA), false);
  assert.equal(guard.isCurrent({ ...ownerB }), false);
  assert.equal(Object.isFrozen(ownerB), true);
  const approval = deferred<void>();
  let writes = 0;
  const pending = approval.promise.then(() => { if (guard.isCurrent(ownerB)) writes += 1; });
  guard.clear();
  assert.equal(guard.capture(), null);
  assert.equal(guard.isCurrent(ownerB), false);
  const reconnected = guard.select("0xB", "somnia-session");
  approval.resolve();
  await pending;
  assert.equal(writes, 0);
  assert.equal(guard.isCurrent(reconnected), true);
});
