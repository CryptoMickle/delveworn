import type { ActivePact, PactAction, PactIntent, PactOffer } from "./pact-schema";
import type { DungeonBelief, BossPreparationId } from "./beliefs";
import type { DungeonFact } from "./facts";

export const LIVING_DUNGEON_SCHEMA_VERSION = 1 as const;
export const LIVING_DUNGEON_RULES = "living-dungeon-v0" as const;
export const LIVING_DUNGEON_RESOLVER = "living-dungeon-resolver-v0" as const;
export const LIVING_DUNGEON_ORIGIN = "UNBOUND_WANDERER" as const;

export type LivingDungeonVariant = "menu" | "ai";
export type LivingDungeonPhase = "explore" | "combat" | "room-cleared" | "pact" | "camp" | "won" | "lost";
export type LivingDungeonRoomKind = "combat" | "pact" | "camp";
export type LivingDungeonRoomId = "warmup" | "pact-room" | "pressure" | "witness" | "camp" | "boss";

export type LivingDungeonRoom = Readonly<{
  id: LivingDungeonRoomId;
  title: string;
  kind: LivingDungeonRoomKind;
  enemyId: LivingDungeonEnemyId | null;
}>;

export const LIVING_DUNGEON_ROOMS: readonly LivingDungeonRoom[] = [
  { id: "warmup", title: "The First Answer", kind: "combat", enemyId: "grave-attendant" },
  { id: "pact-room", title: "The Living Bargain", kind: "pact", enemyId: null },
  { id: "pressure", title: "The Cost of Certainty", kind: "combat", enemyId: "oath-hound" },
  { id: "witness", title: "Someone Is Watching", kind: "combat", enemyId: "dungeon-scrivener" },
  { id: "camp", title: "A Convenient Temptation", kind: "camp", enemyId: null },
  { id: "boss", title: "The Dungeon Remembers", kind: "combat", enemyId: "keeper-of-conclusions" },
] as const;

export type LivingDungeonEnemyId = "grave-attendant" | "oath-hound" | "dungeon-scrivener" | "keeper-of-conclusions";
export type LivingDungeonEnemyDefinition = Readonly<{
  id: LivingDungeonEnemyId;
  name: string;
  maxHp: number;
  minRetaliation: number;
  maxRetaliation: number;
}>;

export const LIVING_DUNGEON_ENEMIES: Readonly<Record<LivingDungeonEnemyId, LivingDungeonEnemyDefinition>> = {
  "grave-attendant": { id: "grave-attendant", name: "Grave Attendant", maxHp: 28, minRetaliation: 4, maxRetaliation: 6 },
  "oath-hound": { id: "oath-hound", name: "Oath Hound", maxHp: 40, minRetaliation: 6, maxRetaliation: 8 },
  "dungeon-scrivener": { id: "dungeon-scrivener", name: "Dungeon Scrivener", maxHp: 44, minRetaliation: 6, maxRetaliation: 9 },
  "keeper-of-conclusions": { id: "keeper-of-conclusions", name: "Keeper of Conclusions", maxHp: 82, minRetaliation: 9, maxRetaliation: 12 },
};

export type LivingDungeonEnemy = Readonly<{
  id: LivingDungeonEnemyId;
  name: string;
  hp: number;
  maxHp: number;
  minRetaliation: number;
  maxRetaliation: number;
  turn: number;
}>;

export type LivingDungeonPlayer = Readonly<{
  hp: number;
  maxHp: number;
  potions: number;
  gold: number;
  weaponLevel: number;
  armorLevel: number;
}>;

export type WitnessState = Readonly<{
  id: "dungeon-scrivener";
  outcome: "UNMET" | "FIGHTING" | "SPARED" | "DEFEATED";
  observedTags: readonly PactAction["tag"][];
}>;

export type PendingBreach = Readonly<{
  action: Extract<LivingDungeonCommand, { type: "storm" | "potion" | "camp-buy" }>;
  pactAction: PactAction;
}>;

export type LivingDungeonStats = Readonly<{
  combatTurns: number;
  damageDealt: number;
  damageTaken: number;
  potionsUsed: number;
}>;

export type LivingDungeonCombatOutcome = Readonly<{
  action: "attack" | "storm" | "potion";
  actionId: string;
  revision: number;
  roomId: LivingDungeonRoomId;
  critical: boolean;
  damageDealt: number;
  damageTaken: number;
  healing: number;
  enemyDefeated: boolean;
  playerDefeated: boolean;
}>;

export type LivingDungeon = Readonly<{
  schemaVersion: typeof LIVING_DUNGEON_SCHEMA_VERSION;
  rulesVersion: typeof LIVING_DUNGEON_RULES;
  resolverVersion: typeof LIVING_DUNGEON_RESOLVER;
  runId: string;
  seed: number;
  rngState: number;
  revision: number;
  phase: LivingDungeonPhase;
  stageIndex: number;
  roomId: LivingDungeonRoomId;
  variant: LivingDungeonVariant;
  originId: typeof LIVING_DUNGEON_ORIGIN;
  player: LivingDungeonPlayer;
  encounter: LivingDungeonEnemy | null;
  pact: ActivePact | null;
  pendingOffer: PactOffer | null;
  pactOfferAttempts: number;
  pactInterpretationAttempts: number;
  pactClarificationAttempts: number;
  pendingBreach: PendingBreach | null;
  facts: readonly DungeonFact[];
  beliefs: readonly DungeonBelief[];
  witness: WitnessState;
  bossPreparation: BossPreparationId;
  storyBeatId: string;
  stats: LivingDungeonStats;
  lastCombatOutcome: LivingDungeonCombatOutcome | null;
  lastAction: string | null;
}>;

type SimpleLivingDungeonCommand =
  | "engage" | "attack" | "storm" | "potion" | "continue" | "decline-pact"
  | "camp-skip" | "confirm-breach" | "cancel-breach" | "spare-witness"
  | "record-pact-interpretation" | "record-pact-clarification";

export type LivingDungeonCommand =
  | { [K in SimpleLivingDungeonCommand]: Readonly<{ type: K }> }[SimpleLivingDungeonCommand]
  | Readonly<{ type: "prepare-pact"; intent: PactIntent; offerSeed: number }>
  | Readonly<{ type: "accept-pact"; pactId: string }>
  | Readonly<{ type: "camp-buy"; item: "BANDAGE" | "POTION" }>;

export function currentLivingDungeonRoom(run: Pick<LivingDungeon, "stageIndex">): LivingDungeonRoom {
  return LIVING_DUNGEON_ROOMS[run.stageIndex] ?? LIVING_DUNGEON_ROOMS[LIVING_DUNGEON_ROOMS.length - 1];
}
