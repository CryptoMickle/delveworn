import { attack, buy, claimRelic, enterNextRoom, startRun, stormAttack, usePotion as drinkPotion, type MonsterType, type PracticeGame, type ShopAction } from "../practice/engine";
import { createSeededRandom } from "../practice/random";

export const DESCENT_RULES = "first-descent-2" as const;
export const ROOMS = [
  { title: "The Unwelcome Committee", enemy: 0, note: "Grave Belle has been expecting someone with a pulse." },
  { title: "Questionable Storage", enemy: 1, note: "Gary considers everything here his. Especially your gold." },
  { title: "The Guard's Office", enemy: 2, note: "Thud's interview process is unusually physical." },
  { title: "The Late Shift", enemy: 0, note: "The undead have a terrible work-life balance." },
  { title: "Supply & Demand", enemy: 1, note: "Clear the room. Kevin has supplies, and invoices." },
  { title: "Cold Storage", enemy: 0, note: "Attack is dependable. Storm can hit harder, but it can also miss." },
  { title: "Petty Cash", enemy: 1, note: "Attack is steady. Storm trades certainty for a higher ceiling." },
  { title: "Heavy Administration", enemy: 2, note: "A surviving enemy always answers. Keep an eye on your HP." },
  { title: "The Last Break", enemy: 2, note: "Kevin's camp is just beyond this guard." },
  { title: "Management", enemy: 3, note: "Your performance review will be conducted in person." },
] as const;

export type PendingLoot = Readonly<{
  gold: number;
  potions: number;
  weapon: number;
  armor: number;
}>;

export type Descent = {
  rules: typeof DESCENT_RULES;
  runId: string;
  seed: number;
  rngState: number;
  revision: number;
  game: PracticeGame;
  engaged: boolean;
  pendingLoot: PendingLoot | null;
  roomTurns: number;
  turns: number;
  damageDealt: number;
  damageTaken: number;
  potionsUsed: number;
};

export type DescentAction = "engage" | "attack" | "storm" | "potion" | "enter" | "collect" | "skip-loot" | "claim" | "claim-equip" | ShopAction;
export type Intent = Readonly<{
  attackPercent: number;
  replyPercent: number;
  name: string;
  hint: string;
  kind: "steady" | "guard" | "heavy" | "windup";
}>;

/** Descriptive compatibility data only. Practice combat always uses its default rules. */
export function enemyIntent(type: MonsterType, turn: number): Intent {
  void turn;
  const descriptions: Record<MonsterType, Pick<Intent, "name" | "hint">> = {
    0: { name: "Zombie shamble", hint: "Attack is reliable; Storm can hit harder or miss. A surviving Zombie retaliates." },
    1: { name: "Goblin ready", hint: "Attack is reliable; Storm can hit harder or miss. A surviving Goblin retaliates." },
    2: { name: "Orc ready", hint: "Attack is reliable; Storm can hit harder or miss. A surviving Orc retaliates." },
    3: { name: "Management awaits", hint: "Attack is reliable; Storm can hit harder or miss. A surviving boss retaliates." },
  };
  return { attackPercent: 100, replyPercent: 100, kind: "steady", ...descriptions[type] };
}

export function roomNumber(run: Descent): number {
  return Math.min(10, run.game.roomsCleared + (run.game.monsterHp > 0 ? 1 : 0));
}

export function phase(run: Descent): "explore" | "combat" | "loot" | "recovery" | "reward" | "won" | "lost" {
  if (!run.game.active) return "lost";
  if (run.pendingLoot !== null) return "loot";
  if (run.game.roomsCleared === 10) return run.game.relicOfferAvailable ? "reward" : "won";
  if (run.game.monsterHp === 0) return "recovery";
  return run.engaged ? "combat" : "explore";
}

export function createDescent(seed: number, runId: string): Descent {
  const rng = createSeededRandom(seed);
  const game = startRun(rng.nextInt, ROOMS[0].enemy);
  return {
    rules: DESCENT_RULES,
    runId,
    seed: seed >>> 0,
    rngState: rng.state(),
    revision: 0,
    game,
    engaged: false,
    pendingLoot: null,
    roomTurns: 0,
    turns: 0,
    damageDealt: 0,
    damageTaken: 0,
    potionsUsed: 0,
  };
}

function withHeldLoot(before: PracticeGame, after: PracticeGame): { game: PracticeGame; pendingLoot: PendingLoot } {
  const pendingLoot = {
    gold: after.gold - before.gold,
    potions: after.potions - before.potions,
    weapon: after.weaponLevel - before.weaponLevel,
    armor: after.armorLevel - before.armorLevel,
  };
  return {
    pendingLoot,
    game: {
      ...after,
      gold: after.gold - pendingLoot.gold,
      potions: after.potions - pendingLoot.potions,
      weaponLevel: after.weaponLevel - pendingLoot.weapon,
      armorLevel: after.armorLevel - pendingLoot.armor,
    },
  };
}

function collectLoot(game: PracticeGame, loot: PendingLoot): PracticeGame {
  return {
    ...game,
    gold: game.gold + loot.gold,
    potions: game.potions + loot.potions,
    weaponLevel: game.weaponLevel + loot.weapon,
    armorLevel: game.armorLevel + loot.armor,
  };
}

/** Guarded authority boundary. Rejected/stale inputs preserve identity and RNG. */
export function transition(run: Descent, action: DescentAction, expectedRevision = run.revision): Descent {
  if (expectedRevision !== run.revision) return run;
  const current = phase(run), before = run.game;
  if (current === "won" || current === "lost") return run;
  if (action === "engage") return current === "explore" ? { ...run, engaged: true, revision: run.revision + 1 } : run;
  if (action === "collect" || action === "skip-loot") {
    if (current !== "loot" || run.pendingLoot === null) return run;
    return {
      ...run,
      game: action === "collect" ? collectLoot(before, run.pendingLoot) : before,
      pendingLoot: null,
      revision: run.revision + 1,
    };
  }
  // Door arrival leaves floor resources in one saved transition. A boss still
  // requires its separate relic choice before any further progression.
  if (action === "enter" && current === "loot" && (before.relicOfferAvailable || before.roomsCleared >= 10)) {
    return { ...run, pendingLoot: null, revision: run.revision + 1 };
  }

  const rng = createSeededRandom(run.seed, run.rngState);
  let game = before, roomTurns = run.roomTurns, engaged = run.engaged;
  let combatTurn = false;
  if (action === "attack" || action === "storm") {
    if (current !== "combat") return run;
    game = (action === "attack" ? attack : stormAttack)(before, rng.nextInt);
    combatTurn = true;
  } else if (action === "potion") {
    if ((current !== "combat" && current !== "recovery") || before.hp >= before.maxHp || before.potions === 0
      || (current === "combat" && before.combatPotionsUsed >= (before.monsterType === 3 ? 3 : 2))) return run;
    game = drinkPotion(before, rng.nextInt);
    combatTurn = current === "combat";
  } else if (action === "enter") {
    if ((current !== "recovery" && current !== "loot") || before.relicOfferAvailable || before.roomsCleared >= 10) return run;
    game = enterNextRoom(before, rng.nextInt, ROOMS[before.roomsCleared].enemy);
    roomTurns = 0;
    engaged = false;
  } else if (action === "claim" || action === "claim-equip") {
    if (current !== "reward") return run;
    game = claimRelic(before, action === "claim-equip");
  } else {
    if (current !== "recovery" || !["supply-bandage", "supply-potion", "camp-rest", "camp-potion", "camp-weapon", "camp-armor"].includes(action)) return run;
    game = buy(before, action);
    if (game.gold === before.gold) return run;
  }

  let pendingLoot = action === "enter" ? null : run.pendingLoot;
  if (before.monsterHp > 0 && game.monsterHp === 0 && game.active) {
    const held = withHeldLoot(before, game);
    game = held.game;
    pendingLoot = held.pendingLoot;
  }
  if (combatTurn) roomTurns++;
  if (game.monsterHp === 0 || !game.active) engaged = false;
  return {
    ...run,
    game,
    engaged,
    pendingLoot,
    roomTurns,
    revision: run.revision + 1,
    rngState: rng.state(),
    turns: run.turns + Number(combatTurn),
    damageDealt: run.damageDealt + (combatTurn ? game.lastPlayerDamage : 0),
    damageTaken: run.damageTaken + (combatTurn ? game.lastMonsterDamage : 0),
    potionsUsed: run.potionsUsed + Number(action === "potion"),
  };
}
