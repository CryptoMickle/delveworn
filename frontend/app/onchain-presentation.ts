import type { RoomLoot, RoomView } from "./dungeon/scene";
import type { LootType } from "./practice/engine";
import type { WalletView } from "./wallet-view-guard";

export type OnchainPresentationSnapshot = Readonly<{
  active: boolean;
  monsterHp: number;
  roomsCleared: number;
  gold: number;
  lastLootType: number;
  lastLootAmount: number;
  relicOfferAvailable: boolean;
}>;

export type OnchainPresentationAction =
  | "startGame"
  | "enterNextRoom"
  | "attack"
  | "stormAttack"
  | "usePotion"
  | string;

export type OnchainPresentationState = Readonly<{
  scope: string | null;
  runGeneration: number;
  encounter: Readonly<{
    room: number;
    engaged: boolean;
    roomTurns: number;
  }> | null;
  loot: (RoomLoot & Readonly<{ room: number }>) | null;
}>;

export function createOnchainPresentationState(): OnchainPresentationState {
  return { scope: null, runGeneration: 0, encounter: null, loot: null };
}

/** Mirrors the wallet guard ticket and also distinguishes the contract player being read. */
export function onchainPresentationScope(
  chainId: number,
  actingPlayer: string | null,
  view: WalletView | null
): string | null {
  if (!actingPlayer || !view) return null;
  return `${chainId}:${view.generation}:${view.mode}:${view.owner}:${actingPlayer.toLowerCase()}`;
}

function stateInScope(state: OnchainPresentationState, scope: string | null) {
  return state.scope === scope
    ? state
    : { ...createOnchainPresentationState(), scope };
}

/** Applies only snapshots that the transaction flow has already confirmed. */
export function applyConfirmedOnchainPresentation(
  state: OnchainPresentationState,
  scope: string | null,
  action: OnchainPresentationAction,
  before: OnchainPresentationSnapshot,
  after: OnchainPresentationSnapshot
): OnchainPresentationState {
  const current = stateInScope(state, scope);
  if (!scope) return current;

  if (
    (action === "startGame" || action === "enterNextRoom") &&
    after.active &&
    after.monsterHp > 0
  ) {
    return {
      scope,
      runGeneration: current.runGeneration + Number(action === "startGame"),
      encounter: {
        room: after.roomsCleared + 1,
        engaged: false,
        roomTurns: 0,
      },
      loot: null,
    };
  }

  const combatAction =
    action === "attack" ||
    action === "stormAttack" ||
    action === "usePotion";
  const encounter =
    combatAction &&
    before.monsterHp > 0 &&
    current.encounter?.room === before.roomsCleared + 1
      ? {
          ...current.encounter,
          roomTurns: current.encounter.roomTurns + 1,
        }
      : current.encounter;
  const defeated =
    before.monsterHp > 0 &&
    after.monsterHp === 0 &&
    after.roomsCleared === before.roomsCleared + 1;

  return {
    ...current,
    encounter,
    loot: defeated
      ? {
          room: after.roomsCleared,
          type: after.lastLootType as LootType,
          amount: after.lastLootAmount,
          gold: Math.max(0, after.gold - before.gold),
          relicId: 0,
        }
      : current.loot,
  };
}

export function onchainPresentationPhase(
  state: OnchainPresentationState,
  scope: string | null,
  snapshot: Pick<OnchainPresentationSnapshot, "active" | "monsterHp" | "roomsCleared" | "relicOfferAvailable">
): RoomView["phase"] {
  if (!snapshot.active) return "lost";
  const current = state.scope === scope ? state : createOnchainPresentationState();
  if (current.loot?.room === snapshot.roomsCleared && snapshot.monsterHp === 0) return "loot";
  if (snapshot.relicOfferAvailable) return "reward";
  if (snapshot.monsterHp === 0) return "recovery";
  if (current.encounter?.room === snapshot.roomsCleared + 1 && !current.encounter.engaged) return "explore";
  return "combat";
}

export function engageOnchainEncounter(
  state: OnchainPresentationState,
  scope: string | null,
  room: number
): OnchainPresentationState {
  if (state.scope !== scope || state.encounter?.room !== room || state.encounter.engaged) return state;
  return { ...state, encounter: { ...state.encounter, engaged: true } };
}

export function acknowledgeOnchainLoot(
  state: OnchainPresentationState,
  scope: string | null,
  room: number
): OnchainPresentationState {
  if (state.scope !== scope || state.loot?.room !== room) return state;
  return { ...state, loot: null };
}

export function canUseOnchainPresentationAction(
  state: OnchainPresentationState,
  scope: string | null,
  snapshot: Pick<OnchainPresentationSnapshot, "active" | "monsterHp" | "roomsCleared" | "relicOfferAvailable">,
  pending: boolean,
  action: "approach" | "combat" | "acknowledge-loot"
) {
  if (pending) return false;
  const phase = onchainPresentationPhase(state, scope, snapshot);
  return action === "approach"
    ? phase === "explore"
    : action === "combat"
      ? phase === "combat"
      : phase === "loot";
}

export function onchainPresentationKey(state: OnchainPresentationState, scope: string | null) {
  const runGeneration = state.scope === scope ? state.runGeneration : 0;
  return `${scope ?? "unscoped"}:${runGeneration}`;
}
