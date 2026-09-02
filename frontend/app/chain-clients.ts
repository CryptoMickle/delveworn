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
  if (
    !activeDeployment.realtime.websocket ||
    activeDeployment.realtime.shreds ||
    !activeDeployment.wsUrl
  ) {
    return null;
  }

  return createPublicClient({
    chain: activeDeployment.chain,
    cacheTime: 0,
    transport: webSocket(activeDeployment.wsUrl, {
      keepAlive: {
        interval: 5_000,
      },
      reconnect: {
        attempts: 100,
        delay: 500,
      },
      retryCount: 5,
      retryDelay: 100,
      timeout: 15_000,
    }),
  });
}
