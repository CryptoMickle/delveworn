"use client";

import type { ThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { getContract } from "thirdweb/contract";
import {
  getPermissionsForSigner,
  isAdmin,
  removeSessionKey,
} from "thirdweb/extensions/erc4337";
import { createWallet, type Account } from "thirdweb/wallets";
import { privateKeyToAccount } from "thirdweb/wallets/private-key";
import {
  bundleUserOp,
  createAndSignUserOp,
  smartWallet,
  waitForUserOpReceipt,
} from "thirdweb/wallets/smart";
import {
  prepareTransaction,
  sendTransaction,
} from "thirdweb/transaction";
import {
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey } from "viem/accounts";
import { activeDeployment } from "./chain-config";
import { SESSION_DURATION_SECONDS } from "./session-provider-policy";
import {
  normalizeSomniaSessionRecord,
  type SomniaSessionRecord,
} from "./somnia-session-storage";

const CLOCK_SKEW_MS = 30_000;
const USER_OPERATION_RECEIPT_POLL_INTERVAL_MS = 250;

export type SomniaSessionHandle = {
  account: Account;
  record: SomniaSessionRecord;
};

export type SomniaSessionTransactionBenchmark = {
  preparationMs: number;
  gasEstimationMs: number;
  paymasterMs: number;
  bundlerSubmissionMs: number;
  inclusionWaitMs: number;
  receiptPollCount: number;
  receiptPollingIntervalMs: number;
  totalMs: number;
};

function benchmarkNowMs() {
  return globalThis.performance?.now() ?? Date.now();
}

function jsonRpcMethod(
  body: BodyInit | null | undefined
): string | null {
  if (typeof body !== "string") {
    return null;
  }

  try {
    const payload = JSON.parse(body) as {
      method?: unknown;
    };

    return typeof payload.method === "string"
      ? payload.method
      : null;
  } catch {
    return null;
  }
}

const somniaChain = defineChain({
  id: activeDeployment.chain.id,
  name: activeDeployment.chain.name,
  rpc: activeDeployment.rpcUrl,
  nativeCurrency: activeDeployment.chain.nativeCurrency,
  blockExplorers: activeDeployment.chain.blockExplorers
    ? [
        {
          name: activeDeployment.chain.blockExplorers.default.name,
          url: activeDeployment.chain.blockExplorers.default.url,
        },
      ]
    : undefined,
  testnet: true,
});

let cachedClient: ThirdwebClient | null = null;

function thirdwebClient() {
  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "Somnia Instant Play requires NEXT_PUBLIC_THIRDWEB_CLIENT_ID."
    );
  }

  cachedClient ??= {
    clientId,
    secretKey: undefined,
  };

  return cachedClient;
}

function sessionPermissions(expiresAt: number) {
  return {
    approvedTargets: [activeDeployment.dungeonAddress],
    nativeTokenLimitPerTransaction: 0,
    permissionStartTimestamp: new Date(Date.now() - CLOCK_SKEW_MS),
    permissionEndTimestamp: new Date(expiresAt),
  };
}

async function connectMetaMaskOwner(ownerAddress: Address) {
  const wallet = createWallet("io.metamask");
  const account = await wallet.connect({
    client: thirdwebClient(),
    chain: somniaChain,
  });

  if (account.address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("Connected MetaMask account changed during session setup.");
  }

  return account;
}

async function connectSessionSigner(record: SomniaSessionRecord) {
  const client = thirdwebClient();
  const signer = privateKeyToAccount({
    client,
    privateKey: record.sessionPrivateKey,
  });
  const wallet = smartWallet({
    chain: somniaChain,
    sponsorGas: true,
    overrides: {
      accountAddress: record.smartAccountAddress,
    },
  });

  return wallet.connect({
    client,
    personalAccount: signer,
  });
}

async function verifyStoredPermissions(record: SomniaSessionRecord) {
  const client = thirdwebClient();
  const contract = getContract({
    client,
    chain: somniaChain,
    address: record.smartAccountAddress,
  });
  const [permissions, ownerIsAdmin, sessionSignerIsAdmin] = await Promise.all([
    getPermissionsForSigner({
      contract,
      signer: record.sessionKeyAddress,
    }),
    isAdmin({
      contract,
      signer: record.ownerAddress,
    }),
    isAdmin({
      contract,
      signer: record.sessionKeyAddress,
    }),
  ]);
  const nowSeconds = BigInt(Math.floor(Date.now() / 1_000));
  const recordExpirySeconds = BigInt(
    Math.floor(record.expiresAt / 1_000)
  );
  const maximumPermissionDuration = BigInt(
    SESSION_DURATION_SECONDS + Math.ceil(CLOCK_SKEW_MS / 1_000)
  );
  const targetsAreRestricted =
    permissions.approvedTargets.length === 1 &&
    permissions.approvedTargets[0]?.toLowerCase() ===
      activeDeployment.dungeonAddress.toLowerCase();
  const permissionDuration =
    permissions.endTimestamp - permissions.startTimestamp;

  if (
    permissions.signer.toLowerCase() !== record.sessionKeyAddress.toLowerCase() ||
    !ownerIsAdmin ||
    sessionSignerIsAdmin ||
    !targetsAreRestricted ||
    permissions.nativeTokenLimitPerTransaction !== BigInt(0) ||
    permissions.startTimestamp > nowSeconds ||
    permissions.endTimestamp <= nowSeconds ||
    permissions.endTimestamp > recordExpirySeconds ||
    permissionDuration > maximumPermissionDuration
  ) {
    throw new Error(
      "Stored Somnia session permission is inactive or broader than expected."
    );
  }
}

export async function restoreSomniaSession(
  record: SomniaSessionRecord
): Promise<SomniaSessionHandle> {
  const normalized = normalizeSomniaSessionRecord(record);

  if (normalized.expiresAt <= Date.now()) {
    throw new Error("Stored Somnia session has expired.");
  }

  await verifyStoredPermissions(normalized);

  return {
    account: await connectSessionSigner(normalized),
    record: normalized,
  };
}

export async function createSomniaSession(
  ownerAddress: Address
): Promise<SomniaSessionHandle> {
  const client = thirdwebClient();
  const adminAccount = await connectMetaMaskOwner(ownerAddress);

  const sessionPrivateKey = generatePrivateKey();
  const sessionSigner = privateKeyToAccount({
    client,
    privateKey: sessionPrivateKey,
  });
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1_000;
  const wallet = smartWallet({
    chain: somniaChain,
    sponsorGas: true,
    sessionKey: {
      address: sessionSigner.address,
      permissions: sessionPermissions(expiresAt),
    },
  });
  const adminSmartAccount = await wallet.connect({
    client,
    personalAccount: adminAccount,
  });
  const record: SomniaSessionRecord = normalizeSomniaSessionRecord({
    version: 1,
    ownerAddress,
    smartAccountAddress: getAddress(adminSmartAccount.address),
    sessionKeyAddress: getAddress(sessionSigner.address),
    sessionPrivateKey,
    dungeonAddress: activeDeployment.dungeonAddress,
    expiresAt,
  });

  await verifyStoredPermissions(record);

  return {
    account: await connectSessionSigner(record),
    record,
  };
}

export async function sendSomniaSessionTransaction(
  record: SomniaSessionRecord,
  data: Hex
) {
  const client = thirdwebClient();
  const sessionSigner = privateKeyToAccount({
    client,
    privateKey: record.sessionPrivateKey,
  });
  const smartWalletOptions = {
    chain: somniaChain,
    sponsorGas: true,
    overrides: {
      accountAddress: record.smartAccountAddress,
    },
  } as const;
  const transaction = prepareTransaction({
    client,
    chain: somniaChain,
    to: activeDeployment.dungeonAddress,
    data,
    value: BigInt(0),
  });
  const startedAt = benchmarkNowMs();
  const originalFetch = globalThis.fetch;
  let gasEstimationMs = 0;
  let paymasterMs = 0;
  let bundlerSubmissionMs = 0;
  let receiptPollCount = 0;
  let userOpSubmissionStartedAt: number | null = null;
  let userOpSubmittedAt: number | null = null;

  const benchmarkFetch: typeof globalThis.fetch = async (
    input,
    init
  ) => {
    const method = jsonRpcMethod(init?.body);
    const requestStartedAt = benchmarkNowMs();

    if (
      method === "eth_sendUserOperation" &&
      userOpSubmissionStartedAt === null
    ) {
      userOpSubmissionStartedAt = requestStartedAt;
    }

    if (method === "eth_getUserOperationReceipt") {
      receiptPollCount += 1;
    }

    try {
      return await originalFetch(input, init);
    } finally {
      const requestCompletedAt = benchmarkNowMs();
      const requestMs = Math.max(
        0,
        requestCompletedAt - requestStartedAt
      );

      if (method === "eth_estimateUserOperationGas") {
        gasEstimationMs += requestMs;
      }

      if (method === "pm_sponsorUserOperation") {
        paymasterMs += requestMs;
      }

      if (method === "eth_sendUserOperation") {
        bundlerSubmissionMs += requestMs;
        userOpSubmittedAt = requestCompletedAt;
      }
    }
  };

  globalThis.fetch = benchmarkFetch;

  try {
    const signedUserOp = await createAndSignUserOp({
      transactions: [transaction],
      adminAccount: sessionSigner,
      client,
      smartWalletOptions,
    });
    const bundlerOptions = {
      chain: somniaChain,
      client,
    };
    const userOpHash = await bundleUserOp({
      userOp: signedUserOp,
      options: bundlerOptions,
    });
    const receipt = await waitForUserOpReceipt({
      ...bundlerOptions,
      userOpHash,
      intervalMs: USER_OPERATION_RECEIPT_POLL_INTERVAL_MS,
    });
    const completedAt = benchmarkNowMs();
    const totalMs = Math.max(0, completedAt - startedAt);
    const preparationWindowMs = Math.max(
      0,
      (userOpSubmissionStartedAt ?? completedAt) - startedAt
    );
    const preparationMs = Math.max(
      0,
      preparationWindowMs - paymasterMs
    );
    const inclusionWaitMs = Math.max(
      0,
      userOpSubmittedAt === null
        ? 0
        : completedAt - userOpSubmittedAt
    );
    const benchmark: SomniaSessionTransactionBenchmark = {
      preparationMs,
      gasEstimationMs,
      paymasterMs,
      bundlerSubmissionMs,
      inclusionWaitMs,
      receiptPollCount,
      receiptPollingIntervalMs:
        USER_OPERATION_RECEIPT_POLL_INTERVAL_MS,
      totalMs,
    };

    return {
      chain: somniaChain,
      client,
      transactionHash: receipt.transactionHash,
      benchmark,
    };
  } finally {
    if (globalThis.fetch === benchmarkFetch) {
      globalThis.fetch = originalFetch;
    }
  }
}

export async function revokeSomniaSession(
  record: SomniaSessionRecord
) {
  const client = thirdwebClient();
  const adminAccount = await connectMetaMaskOwner(record.ownerAddress);

  const wallet = smartWallet({
    chain: somniaChain,
    sponsorGas: true,
    overrides: {
      accountAddress: record.smartAccountAddress,
    },
  });
  const smartAccount = await wallet.connect({
    client,
    personalAccount: adminAccount,
  });
  const contract = getContract({
    client,
    chain: somniaChain,
    address: record.smartAccountAddress,
  });
  const transaction = removeSessionKey({
    account: adminAccount,
    contract,
    sessionKeyAddress: record.sessionKeyAddress,
  });

  return sendTransaction({
    account: smartAccount,
    transaction,
  });
}
