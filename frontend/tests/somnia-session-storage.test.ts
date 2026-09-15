import assert from "node:assert/strict";
import test from "node:test";
import { getAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type * as StorageModule from "../app/somnia-session-storage";
import { loadClientModule, MemoryStorage } from "./helpers/client-module";

const owner = getAddress("0x1111111111111111111111111111111111111111");
const otherOwner = getAddress("0x2222222222222222222222222222222222222222");
const dungeon = getAddress("0x07c5D071132ae95C3708031790b3feC740F4c292");
// Public deterministic test key. Never used with a wallet, provider or network.
const privateKey = `0x${"1".padStart(64, "0")}` as const;

function storageFixture(contract = dungeon, deployment = "somnia-shannon") {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const storage = loadClientModule<typeof StorageModule>("somnia-session-storage", {
    "./chain-config": { activeDeployment: { key: deployment, dungeonAddress: contract } },
  }, { localStorage, sessionStorage }).module;
  const record: StorageModule.SomniaSessionRecord = {
    version: 1, ownerAddress: owner, smartAccountAddress: otherOwner,
    sessionKeyAddress: privateKeyToAccount(privateKey).address,
    sessionPrivateKey: privateKey, dungeonAddress: contract, expiresAt: Date.now() + 60_000,
  };
  return { storage, record, localStorage, sessionStorage };
}

test("Somnia records survive reload while owner, contract and deployment scopes stay isolated", () => {
  const { storage, record, localStorage, sessionStorage } = storageFixture();
  storage.writeSomniaSessionRecord(record);
  storage.setSomniaSessionMode(owner, true);
  const restored = storage.readSomniaSessionRecord(owner);
  assert.equal(restored?.sessionPrivateKey, privateKey);
  assert.equal(restored?.dungeonAddress, dungeon);
  assert.equal(storage.wantsSomniaSessionMode(owner), true);
  assert.equal(storage.readSomniaSessionRecord(otherOwner), null);
  const reloaded = loadClientModule<typeof StorageModule>("somnia-session-storage", {
    "./chain-config": { activeDeployment: { key: "somnia-shannon", dungeonAddress: dungeon } },
  }, { localStorage, sessionStorage }).module;
  assert.equal(reloaded.readSomniaSessionRecord(owner)?.sessionKeyAddress, record.sessionKeyAddress);
  assert.notEqual(storage.somniaSessionStorageKey(owner), storageFixture(otherOwner).storage.somniaSessionStorageKey(owner));
  assert.notEqual(storage.somniaSessionStorageKey(owner), storageFixture(dungeon, "rise-testnet").storage.somniaSessionStorageKey(owner));
});

test("corrupt, expired, wrong-owner and wrong-contract records are discarded with their session mode", () => {
  const { storage, record, localStorage } = storageFixture();
  const malformed = [
    "{broken", "null", JSON.stringify({ ...record, version: 2 }),
    JSON.stringify({ ...record, sessionPrivateKey: "0x1234" }),
    JSON.stringify({ ...record, smartAccountAddress: "invalid" }),
    JSON.stringify({ ...record, expiresAt: Date.now() - 1 }),
    JSON.stringify({ ...record, ownerAddress: otherOwner }),
    JSON.stringify({ ...record, dungeonAddress: otherOwner }),
  ];
  for (const raw of malformed) {
    localStorage.setItem(storage.somniaSessionStorageKey(owner), raw);
    storage.setSomniaSessionMode(owner, true);
    assert.equal(storage.readSomniaSessionRecord(owner), null);
    assert.equal(localStorage.getItem(storage.somniaSessionStorageKey(owner)), null);
    assert.equal(storage.wantsSomniaSessionMode(owner), false);
  }
});

test("clearing a session removes its key and mode without deleting another owner's record", () => {
  const { storage, record } = storageFixture();
  storage.writeSomniaSessionRecord(record);
  storage.writeSomniaSessionRecord({ ...record, ownerAddress: otherOwner });
  storage.setSomniaSessionMode(owner, true);
  storage.setSomniaSessionMode(otherOwner, true);
  storage.clearSomniaSessionRecord(owner);
  assert.equal(storage.readSomniaSessionRecord(owner), null);
  assert.equal(storage.wantsSomniaSessionMode(owner), false);
  assert.equal(storage.readSomniaSessionRecord(otherOwner)?.ownerAddress, otherOwner);
  assert.equal(storage.wantsSomniaSessionMode(otherOwner), true);
  const lowercase = dungeon.toLowerCase() as Address;
  assert.equal(storage.somniaSessionStorageKey(dungeon), storage.somniaSessionStorageKey(lowercase));
});
