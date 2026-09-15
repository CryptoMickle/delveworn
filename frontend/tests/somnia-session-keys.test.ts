import assert from "node:assert/strict";
import test from "node:test";
import { getAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type * as SessionModule from "../app/somnia-session-keys";
import type * as StorageModule from "../app/somnia-session-storage";
import { loadClientModule } from "./helpers/client-module";

const NOW = 1_800_000_000_000;
const DURATION = 8 * 60 * 60;
const owner = getAddress("0x1111111111111111111111111111111111111111");
const smartAddress = getAddress("0x2222222222222222222222222222222222222222");
const dungeon = getAddress("0x07c5D071132ae95C3708031790b3feC740F4c292");
// Public deterministic test key. All SDK calls below are mocked and remain offline.
const privateKey = `0x${"1".padStart(64, "0")}` as const;
const signerAddress = privateKeyToAccount(privateKey).address;
const transactionHash = `0x${"ab".repeat(32)}`;

class FixedDate extends Date { static now() { return NOW; } }
type Account = { address: Address };
type SmartOptions = {
  chain: { id: number }; sponsorGas: boolean;
  overrides?: { accountAddress: Address };
  sessionKey?: { address: Address; permissions: {
    approvedTargets: Address[]; nativeTokenLimitPerTransaction: number;
    permissionStartTimestamp: Date; permissionEndTimestamp: Date;
  } };
};
type Transaction = { to: Address; value: bigint; data: string; chain: { id: number } };

function fixture() {
  const record: StorageModule.SomniaSessionRecord = {
    version: 1, ownerAddress: owner, smartAccountAddress: smartAddress,
    sessionKeyAddress: signerAddress, sessionPrivateKey: privateKey,
    dungeonAddress: dungeon, expiresAt: NOW + DURATION * 1_000,
  };
  const deployment = { key: "somnia-shannon", dungeonAddress: dungeon, rpcUrl: "https://rpc.invalid", chain: {
    id: 50312, name: "Somnia Testnet", nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  } };
  const storage = loadClientModule<typeof StorageModule>("somnia-session-storage", {
    "./chain-config": { activeDeployment: deployment },
  }).module;
  const permissions = {
    signer: signerAddress, approvedTargets: [dungeon], nativeTokenLimitPerTransaction: BigInt(0),
    startTimestamp: BigInt(NOW / 1_000 - 30), endTimestamp: BigInt(record.expiresAt / 1_000),
  };
  const state = { ownerIsAdmin: true, signerIsAdmin: false, connectedOwner: owner, failAt: "" };
  const events: string[] = [];
  const smartCalls: { options: SmartOptions; personalAccount: Account }[] = [];
  let prepared: Transaction | undefined;
  let submitted: { transactions: Transaction[]; adminAccount: Account; smartWalletOptions: SmartOptions } | undefined;
  let revoked: { account: Account; contract: { address: Address }; sessionKeyAddress: Address } | undefined;
  let revocationSender: Account | undefined;
  let receiptInterval: number | undefined;
  let clock = 0;
  const originalFetch = async () => { clock += 7; return new Response("{}"); };
  const rpc = async (method: string) => {
    const fetch = runtime.context.fetch as typeof globalThis.fetch;
    await fetch("https://provider.invalid", { body: JSON.stringify({ method }), method: "POST" });
  };
  function failAt(step: string) { if (state.failAt === step) throw new Error(`synthetic ${step} failure`); }
  const runtime = loadClientModule<typeof SessionModule>("somnia-session-keys", {
    "./chain-config": { activeDeployment: deployment },
    "./session-provider-policy": { SESSION_DURATION_SECONDS: DURATION },
    "./somnia-session-storage": storage,
    "thirdweb/chains": { defineChain: (chain: unknown) => chain },
    "thirdweb/contract": { getContract: (contract: unknown) => contract },
    "viem/accounts": { generatePrivateKey: () => privateKey },
    "thirdweb/wallets/private-key": { privateKeyToAccount: ({ privateKey: key }: { privateKey: typeof privateKey }) => privateKeyToAccount(key) },
    "thirdweb/wallets": { createWallet: (id: string) => {
      assert.equal(id, "io.metamask");
      return { connect: async () => { events.push("owner-connect"); failAt("owner"); return { address: state.connectedOwner }; } };
    } },
    "thirdweb/extensions/erc4337": {
      getPermissionsForSigner: async ({ signer }: { signer: Address }) => {
        events.push("verify"); assert.equal(signer, signerAddress); return permissions;
      },
      isAdmin: async ({ signer }: { signer: Address }) => signer === owner ? state.ownerIsAdmin : state.signerIsAdmin,
      removeSessionKey: (options: NonNullable<typeof revoked>) => { revoked = options; return options; },
    },
    "thirdweb/wallets/smart": {
      smartWallet: (options: SmartOptions) => ({ connect: async ({ personalAccount }: { personalAccount: Account }) => {
        events.push(personalAccount.address === owner ? "admin-connect" : "session-connect");
        smartCalls.push({ options, personalAccount });
        return { address: options.overrides?.accountAddress ?? smartAddress };
      } }),
      createAndSignUserOp: async (options: NonNullable<typeof submitted>) => {
        submitted = options; await rpc("eth_estimateUserOperationGas"); await rpc("pm_sponsorUserOperation");
        failAt("prepare"); return { syntheticUserOp: true };
      },
      bundleUserOp: async () => { await rpc("eth_sendUserOperation"); failAt("bundle"); return "0x1234"; },
      // Thirdweb's real waitForUserOpReceipt rejects reverted user operations.
      waitForUserOpReceipt: async ({ intervalMs }: { intervalMs: number }) => {
        receiptInterval = intervalMs; await rpc("eth_getUserOperationReceipt"); failAt("receipt"); return { transactionHash };
      },
    },
    "thirdweb/transaction": {
      prepareTransaction: (options: Transaction) => { prepared = options; return options; },
      sendTransaction: async ({ account }: { account: Account }) => {
        revocationSender = account; failAt("revoke"); return { transactionHash };
      },
    },
  }, {
    Date: FixedDate, process: { env: { NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "synthetic-public-test-client" } },
    fetch: originalFetch, performance: { now: () => clock },
  });
  return { api: runtime.module, context: runtime.context, record, permissions, state, events, smartCalls, originalFetch,
    captured: () => ({ prepared, submitted, revoked, revocationSender, receiptInterval }) };
}

test("session creation approves only the dungeon for eight hours, then verifies before using the temporary signer", async () => {
  const f = fixture();
  const result = await f.api.createSomniaSession(owner);
  assert.equal(result.account.address, smartAddress);
  assert.equal(result.record.sessionKeyAddress, signerAddress);
  assert.equal(result.record.expiresAt, NOW + DURATION * 1_000);
  assert.deepEqual(f.events, ["owner-connect", "admin-connect", "verify", "session-connect"]);
  const setup = f.smartCalls[0];
  assert.equal(setup.personalAccount.address, owner);
  assert.equal(setup.options.chain.id, 50312);
  assert.equal(setup.options.sponsorGas, true);
  assert.equal(setup.options.sessionKey?.address, signerAddress);
  assert.equal(setup.options.sessionKey?.permissions.approvedTargets.length, 1);
  assert.equal(setup.options.sessionKey?.permissions.approvedTargets[0], dungeon);
  assert.equal(setup.options.sessionKey?.permissions.nativeTokenLimitPerTransaction, 0);
  assert.equal(setup.options.sessionKey?.permissions.permissionStartTimestamp.getTime(), NOW - 30_000);
  assert.equal(setup.options.sessionKey?.permissions.permissionEndTimestamp.getTime(), result.record.expiresAt);
  assert.equal(f.smartCalls[1].options.overrides?.accountAddress, smartAddress);
  assert.equal(f.smartCalls[1].personalAccount.address, signerAddress);
});

test("changed owners, rejected approvals and unsafe granted permissions never produce a usable session", async () => {
  for (const reason of ["changed-owner", "owner-rejected", "broad-permission"]) {
    const f = fixture();
    if (reason === "changed-owner") f.state.connectedOwner = smartAddress;
    if (reason === "owner-rejected") f.state.failAt = "owner";
    if (reason === "broad-permission") f.permissions.approvedTargets.push(owner);
    await assert.rejects(f.api.createSomniaSession(owner), /account changed|owner failure|broader than expected/);
    assert.equal(f.events.includes("session-connect"), false);
  }
});

test("restoration revalidates onchain permissions without requesting the owner's wallet", async () => {
  const f = fixture();
  const restored = await f.api.restoreSomniaSession(f.record);
  assert.equal(restored.account.address, smartAddress);
  assert.deepEqual(f.events, ["verify", "session-connect"]);
  assert.equal(f.smartCalls[0].personalAccount.address, signerAddress);
});

test("restoration rejects expired, revoked, administrative or broadened permissions before connecting", async () => {
  const scenarios: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { f.record.expiresAt = NOW; },
    f => { f.permissions.signer = owner; },
    f => { f.state.ownerIsAdmin = false; },
    f => { f.state.signerIsAdmin = true; },
    f => { f.permissions.approvedTargets = []; },
    f => { f.permissions.approvedTargets = [owner]; },
    f => { f.permissions.approvedTargets.push(owner); },
    f => { f.permissions.nativeTokenLimitPerTransaction = BigInt(1); },
    f => { f.permissions.startTimestamp = BigInt(NOW / 1_000 + 1); },
    f => { f.permissions.endTimestamp = BigInt(NOW / 1_000); },
    f => { f.permissions.endTimestamp += BigInt(1); },
    f => { f.permissions.startTimestamp -= BigInt(1); },
  ];
  for (const change of scenarios) {
    const f = fixture(); change(f);
    await assert.rejects(f.api.restoreSomniaSession(f.record), /expired|broader than expected/);
    assert.equal(f.smartCalls.length, 0);
  }
});

test("session sends use the temporary signer, fixed dungeon and zero value, then wait for inclusion", async () => {
  const f = fixture();
  const phases: string[] = [];
  const result = await f.api.sendSomniaSessionTransaction(f.record, "0x12345678", phase => phases.push(phase));
  const sent = f.captured();
  assert.equal(sent.prepared?.to, dungeon);
  assert.equal(sent.prepared?.value, BigInt(0));
  assert.equal(sent.prepared?.data, "0x12345678");
  assert.equal(sent.prepared?.chain.id, 50312);
  assert.equal(sent.submitted?.adminAccount.address, signerAddress);
  assert.equal(sent.submitted?.transactions.length, 1);
  assert.equal(sent.submitted?.smartWalletOptions.overrides?.accountAddress, smartAddress);
  assert.equal(sent.submitted?.smartWalletOptions.sponsorGas, true);
  assert.deepEqual(phases, ["preparing", "sponsoring", "submitting", "inclusion"]);
  assert.equal(result.transactionHash, transactionHash);
  assert.equal(sent.receiptInterval, 250);
  assert.equal(result.benchmark.receiptPollCount, 1);
  assert.equal(result.benchmark.paymasterMs, 7);
  assert.equal(f.context.fetch, f.originalFetch);
  assert.equal(f.events.includes("owner-connect"), false);
});

test("preparation, bundler and reverted-operation failures propagate and restore fetch instrumentation", async () => {
  for (const step of ["prepare", "bundle", "receipt"]) {
    const f = fixture(); f.state.failAt = step;
    await assert.rejects(f.api.sendSomniaSessionTransaction(f.record, "0x12345678"), new RegExp(`synthetic ${step} failure`));
    assert.equal(f.context.fetch, f.originalFetch);
  }
});

test("revocation reconnects the matching owner and removes only the recorded signer from its smart account", async () => {
  const f = fixture();
  const result = await f.api.revokeSomniaSession(f.record);
  const revoked = f.captured();
  assert.equal(result.transactionHash, transactionHash);
  assert.equal(revoked.revoked?.account.address, owner);
  assert.equal(revoked.revoked?.contract.address, smartAddress);
  assert.equal(revoked.revoked?.sessionKeyAddress, signerAddress);
  assert.equal(revoked.revocationSender?.address, smartAddress);
  assert.equal(f.smartCalls[0].personalAccount.address, owner);
  assert.equal(f.smartCalls[0].options.overrides?.accountAddress, smartAddress);
  assert.equal(f.smartCalls[0].options.sessionKey, undefined);
  const changed = fixture(); changed.state.connectedOwner = smartAddress;
  await assert.rejects(changed.api.revokeSomniaSession(changed.record), /account changed/);
  assert.equal(changed.captured().revoked, undefined);
  const rejected = fixture(); rejected.state.failAt = "revoke";
  await assert.rejects(rejected.api.revokeSomniaSession(rejected.record), /synthetic revoke failure/);
});
