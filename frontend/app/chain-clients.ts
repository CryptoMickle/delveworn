import { createPublicClient, http, webSocket } from "viem";
import { activeDeployment } from "./chain-config";

export function createActivePublicClient() {
  return createPublicClient({
    chain: activeDeployment.chain,
    transport: http(activeDeployment.rpcUrl),
    pollingInterval: activeDeployment.timing.pollingMs,
  });
}

export function createActiveWebSocketClient() {
  if (!activeDeployment.wsUrl) {
    return null;
  }

  return createPublicClient({
    chain: activeDeployment.chain,
    transport: webSocket(activeDeployment.wsUrl),
  });
}
