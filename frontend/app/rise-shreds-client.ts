import { createPublicClient, webSocket } from "viem";
import { shredActions } from "shreds/viem";
import { activeDeployment } from "./chain-config";
import { supportsRealtimeCapability } from "./realtime-config";

export function createRiseShredsClient() {
  if (!supportsRealtimeCapability("shreds")) {
    return null;
  }

  if (!activeDeployment.wsUrl) {
    throw new Error(
      `Deployment ${activeDeployment.key} enables Shreds but has no WebSocket URL.`
    );
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
  }).extend(shredActions);
}
