import type { RoomLoot, RoomView, SceneCue } from "./dungeon/scene";
import type { GameAudioAction, GameAudioOutcome } from "./game-audio";
import type { LootType } from "./practice/engine";
import type { WalletView } from "./wallet-view-guard";
import type { PendingRoomLootState } from "./onchain-v4";

export type OnchainPresentationSnapshot = Readonly<{
  active: boolean;
  monsterHp: number;
  roomsCleared: number;
  gold: number;
  lastLootType: number;
  lastLootAmount: number;
  relicOfferAvailable: boolean;
  supportsPendingLoot: boolean;
  pendingLoot: PendingRoomLootState;
}>;

export type OnchainPresentationAction =
  | "startGame"
  | "enterNextRoom"
  | "attack"
  | "stormAttack"
  | "usePotion"
  | string;

type CombatCueSnapshot = {
  active: boolean;
  monsterType: number;
  monsterHp: number;
  roomsCleared: number;
  pendingRequestId: bigint;
  relicReviveUsed: boolean;
  lastCritical: boolean;
  lastMonsterDamage: number;
};

/** Animation and sound describe the same resolved exchange, never a pending roll. */
export function confirmedOnchainCombatCue(
  action: OnchainPresentationAction,
  before: CombatCueSnapshot,
  after: CombatCueSnapshot
): { cue: Exclude<SceneCue, null>; actionSound: GameAudioAction; outcomeSound: GameAudioOutcome | null } | null {
  if (after.pendingRequestId !== BigInt(0) || !["attack", "stormAttack", "usePotion"].includes(action)) return null;
  const revived = !before.relicReviveUsed && after.relicReviveUsed;
  const cleared = after.roomsCleared > before.roomsCleared;
  return {
    cue: revived ? "revive" : action === "stormAttack" ? "storm" : action === "usePotion" ? "potion" : after.lastCritical ? "critical" : "attack",
    actionSound: revived || action === "usePotion" ? "potion" : action === "stormAttack" ? "storm" : "attack",
    outcomeSound: !after.active ? "death" : cleared ? before.monsterType === 3 ? "victory" : "loot"
      : action === "usePotion" && after.lastMonsterDamage === 0 ? null : after.lastCritical ? "critical" : "hit",
  };
}

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
      ? after.supportsPendingLoot
        ? null
        : {
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
  snapshot: Pick<OnchainPresentationSnapshot, "active" | "monsterHp" | "roomsCleared" | "relicOfferAvailable" | "supportsPendingLoot" | "pendingLoot">
): RoomView["phase"] {
  if (!snapshot.active) return "lost";
  const current = state.scope === scope ? state : createOnchainPresentationState();
  if (
    snapshot.supportsPendingLoot &&
    snapshot.pendingLoot.available &&
    snapshot.pendingLoot.room === snapshot.roomsCleared &&
    snapshot.monsterHp === 0
  ) return "loot";
  if (current.loot?.room === snapshot.roomsCleared && snapshot.monsterHp === 0) return "loot";
  if (snapshot.relicOfferAvailable) return "reward";
  if (snapshot.monsterHp === 0) return "recovery";
  if (current.encounter?.room === snapshot.roomsCleared + 1 && !current.encounter.engaged) return "explore";
  return "combat";
}

/** V4 loot is reconstructed from the contract on every load; legacy loot stays local. */
export function onchainRoomLoot(
  state: OnchainPresentationState,
  scope: string | null,
  snapshot: Pick<OnchainPresentationSnapshot, "monsterHp" | "roomsCleared" | "supportsPendingLoot" | "pendingLoot">
): (RoomLoot & Readonly<{ room: number }>) | null {
  if (snapshot.supportsPendingLoot) {
    const pending = snapshot.pendingLoot;
    return pending.available && pending.room === snapshot.roomsCleared && snapshot.monsterHp === 0
      ? {
          room: pending.room,
          type: pending.lootType,
          amount: pending.lootAmount,
          gold: pending.gold,
          relicId: 0,
        }
      : null;
  }
  return state.scope === scope ? state.loot : null;
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
  snapshot: Pick<OnchainPresentationSnapshot, "active" | "monsterHp" | "roomsCleared" | "relicOfferAvailable" | "supportsPendingLoot" | "pendingLoot">,
  pending: boolean,
  action: "approach" | "combat" | "safe-potion" | "acknowledge-loot"
) {
  if (pending) return false;
  const phase = onchainPresentationPhase(state, scope, snapshot);
  return action === "approach"
    ? phase === "explore"
    : action === "combat"
      ? phase === "combat"
      : action === "safe-potion"
        ? phase === "loot" || phase === "recovery"
      : phase === "loot";
}

export type OnchainDoorDecision =
  | "blocked"
  | "acknowledge-relic"
  | "discard-loot"
  | "enter-next-room";

/**
 * Keeps a door pass over confirmed floor loot transactional: ordinary rooms
 * enter once, while boss loot yields to the already-confirmed relic decision.
 */
export function onchainDoorDecision(
  state: OnchainPresentationState,
  scope: string | null,
  snapshot: Pick<OnchainPresentationSnapshot, "active" | "monsterHp" | "roomsCleared" | "relicOfferAvailable" | "supportsPendingLoot" | "pendingLoot">,
  pending: boolean,
  leaveLoot: boolean
): OnchainDoorDecision {
  if (pending) return "blocked";
  const phase = onchainPresentationPhase(state, scope, snapshot);
  if (phase === "loot") {
    if (!leaveLoot) return "blocked";
    if (snapshot.supportsPendingLoot && snapshot.relicOfferAvailable) {
      return "discard-loot";
    }
    return snapshot.relicOfferAvailable
      ? "acknowledge-relic"
      : "enter-next-room";
  }
  if (leaveLoot) return "blocked";
  return phase === "recovery" ? "enter-next-room" : "blocked";
}

export function onchainPresentationKey(state: OnchainPresentationState, scope: string | null) {
  const runGeneration = state.scope === scope ? state.runGeneration : 0;
  return `${scope ?? "unscoped"}:${runGeneration}`;
}
