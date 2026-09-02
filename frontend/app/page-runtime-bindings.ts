import { activeDeployment } from "./chain-config";
import {
  createActivePublicClient,
  createActiveWebSocketClient,
} from "./chain-clients";
import { wagmiConfig } from "./wagmi-runtime";
import { ensureActiveChain } from "./wallet-network";
import {
  METAMASK_CONNECTOR_ID,
  METAMASK_CONNECTOR_NAME,
  RISE_WALLET_CONNECTOR_ID,
  SESSION_DURATION_SECONDS,
  activeInstantPlayProvider,
  isMetaMaskConnector,
  isRiseWalletConnector,
  sessionStorageKey,
  supportsInstantPlay,
  supportsThirdwebSessionKeys,
} from "./session-provider-policy";
import {
  activeRandomnessProvider,
  activeRandomnessProviderLabel,
  delayedRandomnessText,
  delayedRandomnessTitle,
  supportsRandomnessRetry,
} from "./randomness-provider-policy";
import {
  ACTIVE_ECOSYSTEM_NAME,
  ACTIVE_NETWORK_LABEL,
  builtOnLabel,
  connectedNetworkLabel,
  runtimeFooterLabel,
} from "./deployment-display";

export const DUNGEON_ADDRESS =
  activeDeployment.dungeonAddress;

export const DUNGEON_EXPLORER_URL =
  `${activeDeployment.explorerUrl.replace(/\/$/, "")}/address/${DUNGEON_ADDRESS}`;

export const RPC_URL =
  activeDeployment.rpcUrl;

export const WS_URL =
  activeDeployment.wsUrl;

export const TESTNET_POLLING_MS =
  activeDeployment.timing.pollingMs;

export const MIN_VRF_DISPLAY_MS =
  activeDeployment.timing.minimumRandomnessDisplayMs;

export const VRF_DELAYED_NOTICE_MS =
  activeDeployment.timing.delayedRandomnessNoticeMs;

export const VRF_CANONICAL_FALLBACK_MS =
  activeDeployment.timing.canonicalFallbackMs;

export const ACTION_READY_TIMEOUT_MS =
  activeDeployment.timing.actionReadyTimeoutMs;

export const ACTION_READY_POLL_MS =
  activeDeployment.timing.actionReadyPollMs;

export const ACTIVE_CHAIN =
  activeDeployment.chain;

export const ACTIVE_CHAIN_LABEL =
  activeDeployment.label;

export const ACTIVE_CHAIN_ID =
  activeDeployment.chain.id;

export const publicClient =
  createActivePublicClient();

export const eventWebSocketClient =
  createActiveWebSocketClient();

export {
  ACTIVE_ECOSYSTEM_NAME,
  ACTIVE_NETWORK_LABEL,
  METAMASK_CONNECTOR_ID,
  METAMASK_CONNECTOR_NAME,
  RISE_WALLET_CONNECTOR_ID,
  SESSION_DURATION_SECONDS,
  activeInstantPlayProvider,
  activeRandomnessProvider,
  activeRandomnessProviderLabel,
  builtOnLabel,
  connectedNetworkLabel,
  delayedRandomnessText,
  delayedRandomnessTitle,
  ensureActiveChain,
  isMetaMaskConnector,
  isRiseWalletConnector,
  runtimeFooterLabel,
  sessionStorageKey,
  supportsInstantPlay,
  supportsThirdwebSessionKeys,
  supportsRandomnessRetry,
  wagmiConfig,
};
