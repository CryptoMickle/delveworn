"use client";

import { useEffect } from "react";
import { activeDeployment } from "./chain-config";
import { activeChainIdHex, supportsWallet } from "./chain-runtime";

let bridgeInitialization:
  Promise<void> | undefined;

function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(
      navigator.userAgent
    ) ||
    (
      navigator.maxTouchPoints > 1 &&
      /Macintosh/i.test(
        navigator.userAgent
      )
    )
  );
}

async function initializeMetaMaskBridge() {
  const { createEVMClient } = await import("@metamask/connect-evm");

  /*
    Wagmi intentionally initializes its MetaMask Connect client with
    skipAutoAnnounce=true. Some chain-native wallet flows discover alternative
    signers through EIP-6963, so mobile Safari/Chrome cannot otherwise expose
    MetaMask Mobile to the Instant Play dialog.

    This lightweight client is not used for gameplay. It only announces the
    MetaMask Connect EIP-1193 provider. Provider-specific wallet/session logic
    remains outside the game core and is enabled per deployment configuration.
  */
  await createEVMClient({
    dapp: {
      name: "Rise Dungeon",
      url: window.location.origin,
    },
    api: {
      supportedNetworks: {
        [activeChainIdHex()]: activeDeployment.rpcUrl,
      },
    },
    analytics: {
      enabled: false,
    },
  });
}

export default function MobileMetaMaskInstantPlayBridge() {
  useEffect(() => {
    if (
      !isMobileBrowser() ||
      !supportsWallet("metaMask")
    ) {
      return;
    }

    bridgeInitialization ??=
      initializeMetaMaskBridge()
        .catch((error) => {
          bridgeInitialization =
            undefined;

          console.debug(
            "MetaMask Mobile bridge unavailable:",
            error
          );
        });
  }, []);

  return null;
}
