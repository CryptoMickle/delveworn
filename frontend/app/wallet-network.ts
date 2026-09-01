import type { EIP1193Provider } from "viem";
import { activeChainIdHex, activeWalletAddChainParams } from "./chain-runtime";

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return Number((error as { code: unknown }).code);
  }

  return undefined;
}

export async function ensureActiveChain(
  provider: Pick<EIP1193Provider, "request">
) {
  const chainId = activeChainIdHex();

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    if (getErrorCode(error) !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [activeWalletAddChainParams()],
    });
  }
}
