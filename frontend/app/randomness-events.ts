import { getAddress, type Address } from "viem";
import { activeDeployment } from "./chain-config";
import { createActivePublicClient } from "./chain-clients";

const randomnessFulfilledAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "player",
        type: "address",
      },
      {
        indexed: true,
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: false,
        name: "kind",
        type: "uint8",
      },
    ],
    name: "RandomnessFulfilled",
    type: "event",
  },
] as const;

export type RandomnessFulfilledEvent = {
  player: Address;
  requestId: bigint;
  kind: number;
  source: "canonical";
  receivedAt: number;
};

export function watchCanonicalRandomnessFulfilled({
  player,
  onEvent,
  onError,
}: {
  player: Address;
  onEvent: (event: RandomnessFulfilledEvent) => void;
  onError?: (error: Error) => void;
}) {
  const client = createActivePublicClient();
  const watchedPlayer = getAddress(player);

  return client.watchContractEvent({
    address: activeDeployment.dungeonAddress,
    abi: randomnessFulfilledAbi,
    eventName: "RandomnessFulfilled",
    args: {
      player: watchedPlayer,
    },
    pollingInterval: activeDeployment.timing.pollingMs,
    onLogs(logs) {
      for (const log of logs) {
        const args = log.args;

        if (
          !args.player ||
          args.requestId === undefined ||
          args.kind === undefined
        ) {
          continue;
        }

        onEvent({
          player: getAddress(args.player),
          requestId: args.requestId,
          kind: Number(args.kind),
          source: "canonical",
          receivedAt: Date.now(),
        });
      }
    },
    onError(error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error(String(error))
      );
    },
  });
}
