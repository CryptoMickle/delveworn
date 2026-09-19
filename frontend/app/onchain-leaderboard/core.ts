export const ONCHAIN_LEADERBOARD_VERSION = 1 as const;
export const ONCHAIN_LEADERBOARD_WINDOW_SIZE = 25;

export type OnchainLeaderboardEvent = Readonly<{
  kind: "spawn" | "combat";
  player: `0x${string}`;
  blockNumber: number;
  logIndex: number;
  transactionHash: `0x${string}`;
  timestamp: string;
  room?: number;
  monsterDefeated?: boolean;
}>;

export type OnchainLeaderboardRow = Readonly<{
  position: number;
  player: `0x${string}`;
  roomsCleared: number;
  achievedAt: string;
  achievedAtBlock: number;
  proofTransactionHash: `0x${string}`;
}>;

export type OnchainLeaderboardSnapshot = Readonly<{
  version: typeof ONCHAIN_LEADERBOARD_VERSION;
  boardId: string;
  chainId: number;
  chainName: string;
  contractAddress: `0x${string}`;
  deploymentBlock: number;
  indexedThroughBlock: number;
  generatedAt: string;
  stale: boolean;
  totalPlayers: number;
  rows: readonly OnchainLeaderboardRow[];
}>;

type PlayerProgress = {
  player: `0x${string}`;
  currentRoom: number | null;
  best: Omit<OnchainLeaderboardRow, "position"> | null;
  firstEvent: OnchainLeaderboardEvent;
};

function eventOrder(a: OnchainLeaderboardEvent, b: OnchainLeaderboardEvent): number {
  return a.blockNumber - b.blockNumber
    || a.logIndex - b.logIndex
    || a.transactionHash.localeCompare(b.transactionHash);
}

function progressProof(
  state: PlayerProgress,
  roomsCleared: number,
  event: OnchainLeaderboardEvent,
): void {
  if (roomsCleared < 0 || !Number.isSafeInteger(roomsCleared)) return;
  if (state.best && state.best.roomsCleared >= roomsCleared) return;
  state.best = {
    player: state.player,
    roomsCleared,
    achievedAt: event.timestamp,
    achievedAtBlock: event.blockNumber,
    proofTransactionHash: event.transactionHash,
  };
}

/**
 * Reconstructs each public gameplay account's deepest run from canonical logs.
 * A room-one spawn starts a new run. Spawning room N proves N-1 rooms cleared,
 * while a victorious CombatResolved log proves the currently spawned room too.
 */
export function rankOnchainLeaderboard(
  events: readonly OnchainLeaderboardEvent[],
): OnchainLeaderboardRow[] {
  const players = new Map<string, PlayerProgress>();
  for (const event of [...events].sort(eventOrder)) {
    const key = event.player.toLowerCase();
    let state = players.get(key);
    if (!state) {
      state = {
        player: key as `0x${string}`,
        currentRoom: null,
        best: null,
        firstEvent: event,
      };
      players.set(key, state);
    }

    if (event.kind === "spawn") {
      const room = event.room;
      if (!room || !Number.isSafeInteger(room) || room < 1) continue;
      state.currentRoom = room;
      progressProof(state, room - 1, event);
      continue;
    }

    if (event.monsterDefeated && state.currentRoom !== null) {
      progressProof(state, state.currentRoom, event);
    }
  }

  const ordered = [...players.values()].map(state => state.best ?? {
    player: state.player,
    roomsCleared: 0,
    achievedAt: state.firstEvent.timestamp,
    achievedAtBlock: state.firstEvent.blockNumber,
    proofTransactionHash: state.firstEvent.transactionHash,
  }).sort((a, b) => b.roomsCleared - a.roomsCleared
    || a.achievedAtBlock - b.achievedAtBlock
    || a.player.localeCompare(b.player));

  return ordered.map((row, index, rows) => ({
    ...row,
    position: index > 0 && rows[index - 1].roomsCleared === row.roomsCleared
      ? rows.findIndex(candidate => candidate.roomsCleared === row.roomsCleared) + 1
      : index + 1,
  }));
}

export function onchainLeaderboardWindow(
  rows: readonly OnchainLeaderboardRow[],
  player: string | null,
  size = ONCHAIN_LEADERBOARD_WINDOW_SIZE,
): OnchainLeaderboardRow[] {
  const top = rows.slice(0, size);
  if (!player) return top;
  const ownIndex = rows.findIndex(row => row.player.toLowerCase() === player.toLowerCase());
  if (ownIndex < 0 || ownIndex < size) return top;
  const nearby = rows.slice(Math.max(size, ownIndex - 2), ownIndex + 3);
  return [...top, ...nearby];
}

export function shortPlayerAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
