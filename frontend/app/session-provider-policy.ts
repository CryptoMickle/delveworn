import type { Address } from "viem";
import { activeDeployment } from "./chain-config";

export const SESSION_DURATION_SECONDS = 8 * 60 * 60;
export const SESSION_PERMISSION_VERSION = "4";

export const RISE_WALLET_CONNECTOR_ID = "com.risechain.wallet";
export const METAMASK_CONNECTOR_ID = "metaMaskSDK";
export const METAMASK_CONNECTOR_NAME = "MetaMask";

export function activeInstantPlayProvider() {
  return activeDeployment.wallet.instantPlayProvider;
}

export function supportsInstantPlay() {
  return Boolean(
    activeDeployment.wallet.sessionKeys &&
      activeDeployment.wallet.instantPlayProvider
  );
}

export function isRiseWalletConnector(connector?: {
  id?: string;
  name?: string;
} | null) {
  return (
    activeDeployment.wallet.riseWallet &&
    activeDeployment.wallet.instantPlayProvider === "rise-wallet" &&
    connector?.id === RISE_WALLET_CONNECTOR_ID
  );
}

export function isMetaMaskConnector(connector?: {
  id?: string;
  name?: string;
} | null) {
  return (
    activeDeployment.wallet.metaMask &&
    (connector?.id === METAMASK_CONNECTOR_ID ||
      connector?.name === METAMASK_CONNECTOR_NAME)
  );
}

export function sessionStorageKey(address: Address) {
  return `rise_dungeon_${activeDeployment.key}_${activeDeployment.dungeonAddress.toLowerCase()}_${address.toLowerCase()}_session_v${SESSION_PERMISSION_VERSION}_key`;
}
