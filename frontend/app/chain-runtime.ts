import { numberToHex } from "viem";
import { activeDeployment } from "./chain-config";

export function activeChainIdHex() {
  return numberToHex(activeDeployment.chain.id);
}

export function activeWalletAddChainParams() {
  const chain = activeDeployment.chain;

  return {
    chainId: activeChainIdHex(),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [activeDeployment.rpcUrl],
    blockExplorerUrls: [activeDeployment.explorerUrl],
  };
}

export function activeTransportConfig() {
  return {
    chain: activeDeployment.chain,
    rpcUrl: activeDeployment.rpcUrl,
    wsUrl: activeDeployment.wsUrl,
    dungeonAddress: activeDeployment.dungeonAddress,
    timing: activeDeployment.timing,
  } as const;
}

export function supportsWallet(capability: keyof typeof activeDeployment.wallet) {
  return activeDeployment.wallet[capability];
}
