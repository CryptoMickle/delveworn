import {
  defineChain,
  getAddress,
  type Address,
  type Chain,
} from "viem";
import { riseTestnet } from "viem/chains";

export type InstantPlayProvider =
  | "rise-wallet"
  | null;

export type RandomnessProvider =
  | "rise-vrf"
  | "somnia-native-vrf"
  | "chainlink-vrf"
  | "supra-dvrf"
  | "other";

export type WalletCapabilities = {
  riseWallet: boolean;
  metaMask: boolean;
  sessionKeys: boolean;
  gaslessTransactions: boolean;
  instantPlayProvider: InstantPlayProvider;
};

export type RealtimeCapabilities = {
  websocket: boolean;
  shreds: boolean;
};

export type RandomnessCapabilities = {
  provider: RandomnessProvider;
  providerLabel: string;
  retrySupported: boolean;
};

export type DeploymentConfig = {
  key: string;
  label: string;
  ecosystemName: string;
  selectable: boolean;
  chain: Chain;
  dungeonAddress: Address | null;
  rpcUrl: string;
  wsUrl?: string;
  explorerUrl: string;
  wallet: WalletCapabilities;
  realtime: RealtimeCapabilities;
  randomness: RandomnessCapabilities;
  timing: {
    pollingMs: number;
    minimumRandomnessDisplayMs: number;
    delayedRandomnessNoticeMs: number;
    canonicalFallbackMs: number;
    actionReadyTimeoutMs: number;
    actionReadyPollMs: number;
  };
};

export type ActiveDeploymentConfig = DeploymentConfig & {
  selectable: true;
  dungeonAddress: Address;
};

function requiredAddress(name: string, value: string | undefined): Address {
  if (!value) {
    throw new Error(`${name} is not set.`);
  }

  return getAddress(value);
}

function optionalAddress(value: string | undefined): Address | null {
  return value ? getAddress(value) : null;
}

function validateDeploymentConfig(config: DeploymentConfig) {
  if (!config.ecosystemName.trim()) {
    throw new Error(`Deployment ${config.key} must provide an ecosystem name.`);
  }

  if (config.realtime.websocket && !config.wsUrl) {
    throw new Error(
      `Deployment ${config.key} enables WebSocket realtime but has no wsUrl.`
    );
  }

  if (config.realtime.shreds && !config.realtime.websocket) {
    throw new Error(
      `Deployment ${config.key} enables Shreds without WebSocket realtime.`
    );
  }

  if (config.wallet.sessionKeys && !config.wallet.instantPlayProvider) {
    throw new Error(
      `Deployment ${config.key} enables session keys without an Instant Play provider.`
    );
  }

  if (!config.wallet.sessionKeys && config.wallet.instantPlayProvider) {
    throw new Error(
      `Deployment ${config.key} configures an Instant Play provider while session keys are disabled.`
    );
  }

  if (
    config.wallet.instantPlayProvider === "rise-wallet" &&
    !config.wallet.riseWallet
  ) {
    throw new Error(
      `Deployment ${config.key} selects RISE Wallet for Instant Play while the RISE Wallet connector is disabled.`
    );
  }

  if (!config.randomness.providerLabel.trim()) {
    throw new Error(
      `Deployment ${config.key} must provide a randomness provider label.`
    );
  }

  return config;
}

export function defineDeployment(config: DeploymentConfig): DeploymentConfig {
  return validateDeploymentConfig(config);
}

const somniaShannon = defineChain({
  id: 50_312,
  name: "Somnia Testnet",
  nativeCurrency: {
    name: "Somnia Test Token",
    symbol: "STT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://dream-rpc.somnia.network/"],
    },
  },
  blockExplorers: {
    default: {
      name: "Somnia Shannon Explorer",
      url: "https://shannon-explorer.somnia.network/",
    },
  },
  testnet: true,
});

export const deployments = {
  riseTestnet: defineDeployment({
    key: "rise-testnet",
    label: "RISE Testnet",
    ecosystemName: "RISE",
    selectable: true,
    chain: riseTestnet,
    dungeonAddress: optionalAddress(
      process.env.NEXT_PUBLIC_RISE_TESTNET_DUNGEON_ADDRESS ??
        process.env.NEXT_PUBLIC_DUNGEON_ADDRESS
    ),
    rpcUrl:
      process.env.NEXT_PUBLIC_RISE_TESTNET_RPC_URL ??
      process.env.NEXT_PUBLIC_RPC_URL ??
      "https://testnet.riselabs.xyz",
    wsUrl:
      process.env.NEXT_PUBLIC_RISE_TESTNET_WS_URL ??
      process.env.NEXT_PUBLIC_WS_URL ??
      "wss://testnet.riselabs.xyz/ws",
    explorerUrl:
      process.env.NEXT_PUBLIC_RISE_TESTNET_EXPLORER_URL ??
      process.env.NEXT_PUBLIC_EXPLORER_URL ??
      "https://explorer.testnet.riselabs.xyz",
    wallet: {
      riseWallet: true,
      metaMask: true,
      sessionKeys: true,
      gaslessTransactions: false,
      instantPlayProvider: "rise-wallet",
    },
    realtime: {
      websocket: true,
      shreds: true,
    },
    randomness: {
      provider: "rise-vrf",
      providerLabel: "RISE VRF",
      retrySupported: true,
    },
    timing: {
      pollingMs: 50,
      minimumRandomnessDisplayMs: 300,
      delayedRandomnessNoticeMs: 5_000,
      canonicalFallbackMs: 20_000,
      actionReadyTimeoutMs: 45_000,
      actionReadyPollMs: 250,
    },
  }),
  somniaShannon: defineDeployment({
    key: "somnia-shannon",
    label: "Somnia Shannon Testnet",
    ecosystemName: "Somnia",
    selectable: true,
    chain: somniaShannon,
    dungeonAddress: requiredAddress(
      "NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS",
      process.env.NEXT_PUBLIC_SOMNIA_SHANNON_DUNGEON_ADDRESS ??
        "0x07c5D071132ae95C3708031790b3feC740F4c292"
    ),
    rpcUrl:
      process.env.NEXT_PUBLIC_SOMNIA_SHANNON_RPC_URL ??
      "https://dream-rpc.somnia.network/",
    explorerUrl:
      process.env.NEXT_PUBLIC_SOMNIA_SHANNON_EXPLORER_URL ??
      "https://shannon-explorer.somnia.network/",
    wallet: {
      riseWallet: false,
      metaMask: true,
      sessionKeys: false,
      gaslessTransactions: false,
      instantPlayProvider: null,
    },
    realtime: {
      websocket: false,
      shreds: false,
    },
    randomness: {
      provider: "somnia-native-vrf",
      providerLabel: "Somnia Native VRF",
      retrySupported: true,
    },
    timing: {
      pollingMs: 250,
      minimumRandomnessDisplayMs: 300,
      delayedRandomnessNoticeMs: 5_000,
      canonicalFallbackMs: 20_000,
      actionReadyTimeoutMs: 45_000,
      actionReadyPollMs: 250,
    },
  }),
} as const;

export type DeploymentKey = keyof typeof deployments;

const configuredDeployment =
  (process.env.NEXT_PUBLIC_DEPLOYMENT as DeploymentKey | undefined) ?? "riseTestnet";

if (!(configuredDeployment in deployments)) {
  throw new Error(`Unsupported NEXT_PUBLIC_DEPLOYMENT: ${configuredDeployment}`);
}

const selectedDeployment = deployments[configuredDeployment];

if (!selectedDeployment.selectable) {
  throw new Error(
    `Deployment ${selectedDeployment.key} is registered for benchmarking but is not selectable yet.`
  );
}

if (!selectedDeployment.dungeonAddress) {
  throw new Error(
    `Deployment ${selectedDeployment.key} is selected but has no dungeon contract address.`
  );
}

export const activeDeployment = selectedDeployment as ActiveDeploymentConfig;
