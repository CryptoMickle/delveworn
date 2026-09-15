import { attack, buy, claimRelic, enterNextRoom, startRun, stormAttack, usePotion as drinkPotion, type CombatContext, type MonsterType, type PracticeGame, type ShopAction } from "../practice/engine";
import { createSeededRandom } from "../practice/random";
import { getMaxHpForRelic } from "../relics";

export const DESCENT_RULES = "first-descent-1" as const;
export const ROOMS = [
  { title: "The Unwelcome Committee", enemy: 0, note: "Grave Belle has been expecting someone with a pulse." },
  { title: "Questionable Storage", enemy: 1, note: "Gary considers everything here his. Especially your gold." },
  { title: "The Guard's Office", enemy: 2, note: "Thud's interview process is unusually physical." },
  { title: "The Late Shift", enemy: 0, note: "The undead have a terrible work-life balance." },
  { title: "Supply & Demand", enemy: 1, note: "Clear the room. Kevin has supplies, and invoices." },
  { title: "Cold Storage", enemy: 0, note: "Read the wind-up. A quiet turn is a chance to recover." },
  { title: "Petty Cash", enemy: 1, note: "A raised dagger cannot block the weather." },
  { title: "Heavy Administration", enemy: 2, note: "A probing blow. Then a crushing one. Plan ahead." },
  { title: "The Last Break", enemy: 2, note: "Kevin's camp is just beyond this guard." },
  { title: "Management", enemy: 3, note: "Your performance review will be conducted in person." },
] as const;

export const BUILDS = [
  { id: "warden", name: "Warden", relic: 2, style: "Survive the next mistake.", hint: "+20 max HP · −5% damage. Read heavy blows and save gold for armor." },
  { id: "duelist", name: "Duelist", relic: 3, style: "Make the steady hit count.", hint: "+5 points of Attack crit · −20% Storm. Invest in your weapon." },
  { id: "stormcaller", name: "Stormcaller", relic: 6, style: "A little weather. A lot of risk.", hint: "+30% Storm · −5% Attack. Storm ignores an enemy's guard; it can still roll zero." },
] as const;
export type BuildId = typeof BUILDS[number]["id"];
export type Descent = {
  rules: typeof DESCENT_RULES; runId: string; seed: number; rngState: number;
  revision: number; build: BuildId; game: PracticeGame; engaged: boolean;
  roomTurns: number; turns: number; damageDealt: number; damageTaken: number;
  potionsUsed: number;
};
export type DescentAction = "engage" | "attack" | "storm" | "potion" | "enter" | "claim" | ShopAction;
export type Intent = CombatContext & { name: string; hint: string; kind: "steady" | "guard" | "heavy" | "windup" };

/** turn is zero-based; no animation, movement or audio advances it. */
export function enemyIntent(type: MonsterType, turn: number): Intent {
  const normal = { attackPercent: 100, replyPercent: 100, name: "Retaliate", hint: "Survives your action, then hits back.", kind: "steady" } as const;
  if (type === 0) {
    if (turn % 3 === 2) return { ...normal, replyPercent: 0, name: "Winding up", hint: "No retaliation this turn. A safe moment to heal; a heavy blow comes next.", kind: "windup" };
    if (turn > 0 && turn % 3 === 0) return { ...normal, replyPercent: 150, name: "Dead weight", hint: "A heavy reply. Finish the fight or soften it with a potion.", kind: "heavy" };
  }
  if (type === 1 && turn % 3 === 2) return { ...normal, attackPercent: 75, name: "Dagger guard", hint: "Attack deals 25% less. Storm bypasses the guard.", kind: "guard" };
  if (type === 2) return turn % 2 === 0
    ? { ...normal, replyPercent: 50, name: "Testing swing", hint: "A light reply. The next swing will be heavy." }
    : { ...normal, replyPercent: 150, name: "Crushing swing", hint: "A heavy reply. Potion halves it; a killing blow stops it.", kind: "heavy" };
  if (type === 3) {
    if (turn % 3 === 1) return { ...normal, attackPercent: 75, replyPercent: 50, name: "Executive guard", hint: "Attack deals 25% less; Storm bypasses it. A crushing blow follows.", kind: "guard" };
    if (turn % 3 === 2) return { ...normal, replyPercent: 175, name: "Final warning", hint: "175% reply before armor. Finish him, or use a potion to halve it.", kind: "heavy" };
    return { ...normal, name: "Performance review", hint: "A normal reply. Next comes a guard, then a crushing blow." };
  }
  return normal;
}

export function roomNumber(run: Descent): number {
  return Math.min(10, run.game.roomsCleared + (run.game.monsterHp > 0 ? 1 : 0));
}
export function phase(run: Descent): "explore" | "combat" | "recovery" | "reward" | "won" | "lost" {
  if (!run.game.active) return "lost";
  if (run.game.roomsCleared === 10) return run.game.relicOfferAvailable ? "reward" : "won";
  if (run.game.monsterHp === 0) return "recovery";
  return run.engaged ? "combat" : "explore";
}

export function createDescent(build: BuildId, seed: number, runId: string): Descent {
  const loadout = BUILDS.find(item => item.id === build);
  if (!loadout) throw new Error("Unknown training build");
  const rng = createSeededRandom(seed);
  const game = startRun(rng.nextInt, ROOMS[0].enemy);
  const maxHp = getMaxHpForRelic(100, loadout.relic);
  const counts = Array<number>(16).fill(0); counts[loadout.relic] = 1;
  return { rules: DESCENT_RULES, runId, seed: seed >>> 0, rngState: rng.state(), revision: 0, build,
    game: { ...game, maxHp, hp: maxHp, equippedRelic: loadout.relic, ownedRelics: [loadout.relic], relicCounts: counts },
    engaged: false, roomTurns: 0, turns: 0, damageDealt: 0, damageTaken: 0, potionsUsed: 0 };
}

/** Guarded authority boundary. Rejected/stale inputs preserve identity and RNG. */
export function transition(run: Descent, action: DescentAction, expectedRevision = run.revision): Descent {
  if (expectedRevision !== run.revision) return run;
  const current = phase(run), before = run.game;
  if (current === "won" || current === "lost") return run;
  if (action === "engage") return current === "explore" ? { ...run, engaged: true, revision: run.revision + 1 } : run;
  const rng = createSeededRandom(run.seed, run.rngState);
  const intent = enemyIntent(before.monsterType, run.roomTurns);
  let game = before, roomTurns = run.roomTurns, engaged = run.engaged;
  let combatTurn = false;
  if (action === "attack" || action === "storm") {
    if (current !== "combat") return run;
    game = (action === "attack" ? attack : stormAttack)(before, rng.nextInt, intent);
    combatTurn = true;
  } else if (action === "potion") {
    if ((current !== "combat" && current !== "recovery") || before.hp >= before.maxHp || before.potions === 0
      || (current === "combat" && before.combatPotionsUsed >= (before.monsterType === 3 ? 3 : 2))) return run;
    game = drinkPotion(before, rng.nextInt, intent); combatTurn = current === "combat";
  } else if (action === "enter") {
    if (current !== "recovery" || before.relicOfferAvailable || before.roomsCleared >= 10) return run;
    game = enterNextRoom(before, rng.nextInt, ROOMS[before.roomsCleared].enemy);
    roomTurns = 0; engaged = false;
  } else if (action === "claim") {
    if (current !== "reward") return run;
    game = claimRelic(before, false);
  } else {
    if (current !== "recovery" || !["supply-bandage", "supply-potion", "camp-rest", "camp-potion", "camp-weapon", "camp-armor"].includes(action)) return run;
    game = buy(before, action);
    if (game.gold === before.gold) return run;
  }
  if (combatTurn) roomTurns++;
  if (game.monsterHp === 0 || !game.active) engaged = false;
  return { ...run, game, engaged, roomTurns, revision: run.revision + 1, rngState: rng.state(),
    turns: run.turns + Number(combatTurn),
    damageDealt: run.damageDealt + (combatTurn ? game.lastPlayerDamage : 0),
    damageTaken: run.damageTaken + (combatTurn ? game.lastMonsterDamage : 0),
    potionsUsed: run.potionsUsed + Number(action === "potion") };
}
