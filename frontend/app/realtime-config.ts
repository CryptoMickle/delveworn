import { activeDeployment } from "./chain-config";

export type RealtimeMode =
  | "rise-shreds"
  | "websocket"
  | "polling";

export function activeRealtimeMode(): RealtimeMode {
  if (activeDeployment.realtime.shreds) {
    return "rise-shreds";
  }

  if (
    activeDeployment.realtime.websocket &&
    activeDeployment.wsUrl
  ) {
    return "websocket";
  }

  return "polling";
}

export function supportsRealtimeCapability(
  capability: keyof typeof activeDeployment.realtime
) {
  return activeDeployment.realtime[capability];
}
