import { metaMask } from "wagmi/connectors/metaMask";
import { RiseWallet } from "rise-wallet";
import { riseWallet } from "rise-wallet/wagmi";
import { supportsWallet } from "./chain-runtime";

export function createActiveMetaMaskConnector() {
  if (!supportsWallet("metaMask")) {
    return null;
  }

  return metaMask({
    dapp: {
      name: "Delveworn",
      url:
        typeof window === "undefined"
          ? "https://delveworn.vercel.app"
          : window.location.origin,
    },
  });
}

export function createActiveRiseWalletConnector() {
  if (!supportsWallet("riseWallet")) {
    return null;
  }

  return riseWallet(RiseWallet.defaultConfig);
}
