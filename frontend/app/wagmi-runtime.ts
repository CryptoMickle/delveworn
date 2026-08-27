import { http } from "viem";
import { createConfig } from "wagmi";
import { activeDeployment } from "./chain-config";
import {
  createActiveMetaMaskConnector,
  createActiveRiseWalletConnector,
} from "./wallet-connectors";

export function createActiveWagmiConfig() {
  const connectors = [];

  const riseWalletConnector =
    createActiveRiseWalletConnector();
  const metaMaskConnector =
    createActiveMetaMaskConnector();

  if (riseWalletConnector) {
    connectors.push(
      riseWalletConnector
    );
  }

  if (metaMaskConnector) {
    connectors.push(
      metaMaskConnector
    );
  }

  return createConfig({
    ssr: true,
    chains: [
      activeDeployment.chain,
    ],
    connectors,
    transports: {
      [activeDeployment.chain.id]:
        http(
          activeDeployment.rpcUrl
        ),
    },
  });
}

export const wagmiConfig =
  createActiveWagmiConfig();
