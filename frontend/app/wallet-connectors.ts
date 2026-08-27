import { metaMask } from "wagmi/connectors";
import { RiseWallet } from "rise-wallet";
import { riseWallet } from "rise-wallet/wagmi";
import { supportsWallet } from "./chain-runtime";

export function createActiveMetaMaskConnector() {
  if (!supportsWallet("metaMask")) {
    return null;
  }

  return metaMask({
    dapp: {
      name: "Rise Dungeon",
      url:
        typeof window === "undefined"
          ? "https://rise-dungeon-frontend.vercel.app"
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
