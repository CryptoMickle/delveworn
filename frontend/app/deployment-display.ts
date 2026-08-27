import { activeDeployment } from "./chain-config";

export const ACTIVE_ECOSYSTEM_NAME =
  activeDeployment.ecosystemName;

export const ACTIVE_NETWORK_LABEL =
  activeDeployment.label;

export function builtOnLabel() {
  return "FULLY ONCHAIN";
}

export function connectedNetworkLabel(address?: string | null) {
  if (!address) {
    return activeDeployment.label;
  }

  return `${activeDeployment.label} · ${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function runtimeFooterLabel() {
  return `${activeDeployment.label} · ${activeDeployment.randomness.providerLabel}`;
}
