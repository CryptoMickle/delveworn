import {
  attack,
  buy,
  campAvailable,
  campPrices,
  enterNextRoom,
  startRun,
  stormAttack,
  supplyAvailable,
  supplyPrices,
  usePotion as drinkPotion,
  type PracticeGame,
  type ShopAction,
} from "../practice/engine";
import { createSeededRandom } from "../practice/random";

export const CHALLENGE_RULES_VERSION = 1;
export const CHALLENGE_TARGET_ROOMS = 10;
export const CHALLENGE_MAX_ACTIONS = 320;
export const CHALLENGE_MAX_PROOF_LENGTH = 2_048;

export type ChallengeDefinition = {
  id: string;
  rulesVersion: typeof CHALLENGE_RULES_VERSION;
  startsAt: string;
  endsAt: string;
  seed: number;
  targetRooms: typeof CHALLENGE_TARGET_ROOMS;
};

export const CHALLENGE_ACTIONS = {
  A: "attack",
  S: "storm",
  P: "potion",
  N: "next-room",
  B: "supply-bandage",
  T: "supply-potion",
  R: "camp-rest",
  C: "camp-potion",
  W: "camp-weapon",
  O: "camp-armor",
} as const;

export type ChallengeActionCode = keyof typeof CHALLENGE_ACTIONS;
export type ChallengeAction = (typeof CHALLENGE_ACTIONS)[ChallengeActionCode];

export type ChallengeRun = {
  definition: ChallengeDefinition;
  game: PracticeGame;
  randomState: number;
  actions: ChallengeActionCode[];
};

export type ChallengeResult = {
  challengeId: string;
  rulesVersion: number;
  seed: number;
  outcome: "cleared" | "defeated";
  roomsCleared: number;
  hp: number;
  gold: number;
  potions: number;
  weaponLevel: number;
  armorLevel: number;
  relicId: number;
  actionCount: number;
  score: number;
};

export type VerifiedChallengeResult = {
  proof: string;
  runId: string;
  run: ChallengeRun;
  result: ChallengeResult;
};

export class ChallengeProofError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChallengeProofError";
    this.code = code;
  }
}

function isoWeekStart(year: number, week: number): Date {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const dayFromMonday = (januaryFourth.getUTCDay() + 6) % 7;
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(januaryFourth.getUTCDate() - dayFromMonday);
  const start = new Date(firstMonday);
  start.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  return start;
}

export function challengeIdForDate(date = new Date()): string {
  const day = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const year = day.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((day.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function seedForChallenge(id: string): number {
  const input = `delveworn:weekly:${CHALLENGE_RULES_VERSION}:${id}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) || 0x6d2b79f5;
}

export function getChallengeDefinition(id: string): ChallengeDefinition | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (year < 2026 || year > 2100 || week < 1 || week > 53) return null;
  const start = isoWeekStart(year, week);
  if (challengeIdForDate(start) !== id) return null;
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return {
    id,
    rulesVersion: CHALLENGE_RULES_VERSION,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    seed: seedForChallenge(id),
    targetRooms: CHALLENGE_TARGET_ROOMS,
  };
}

function actionCode(action: ChallengeAction): ChallengeActionCode {
  const match = Object.entries(CHALLENGE_ACTIONS).find(([, value]) => value === action);
  if (!match) throw new ChallengeProofError("unknown_action", "The action is not part of these rules.");
  return match[0] as ChallengeActionCode;
}

export function isChallengeComplete(run: Pick<ChallengeRun, "game">): boolean {
  return !run.game.active || run.game.roomsCleared >= CHALLENGE_TARGET_ROOMS;
}

function invalidAction(message: string): never {
  throw new ChallengeProofError("invalid_action", message);
}

function validateShopAction(game: PracticeGame, action: ShopAction): void {
  if (!game.active || game.monsterHp > 0) invalidAction("Shop actions are only valid between rooms.");
  if (action.startsWith("supply-") && !supplyAvailable(game)) {
    invalidAction("This run is not at a supply stop.");
  }
  if (action.startsWith("camp-") && !campAvailable(game)) {
    invalidAction("This run is not at a boss camp.");
  }

  const supplies = supplyPrices(game);
  const camp = campPrices(game);
  const cost = action === "supply-bandage" ? supplies.bandage
    : action === "supply-potion" ? supplies.potion
      : action === "camp-rest" ? camp.rest
        : action === "camp-potion" ? camp.potion
          : action === "camp-weapon" ? camp.weapon
            : camp.armor;
  if (game.gold < cost) invalidAction("The run does not have enough gold for this purchase.");
  if (action === "supply-bandage" && (game.supplyBandageUsed || game.hp >= game.maxHp)) {
    invalidAction("The supply bandage cannot be used now.");
  }
  if (action === "supply-potion" && (game.supplyPotionsBought >= 2 || game.potions >= 5)) {
    invalidAction("The supply potion cannot be bought now.");
  }
  if (action === "camp-rest" && (game.campRestUsed || game.hp >= game.maxHp)) {
    invalidAction("Camp rest cannot be used now.");
  }
  if (action === "camp-potion" && (game.campPotionsBought >= 2 || game.potions >= 5)) {
    invalidAction("The camp potion cannot be bought now.");
  }
}

function applyGameAction(
  game: PracticeGame,
  action: ChallengeAction,
  randomInt: (maxExclusive: number) => number
): PracticeGame {
  if (action === "attack" || action === "storm") {
    if (!game.active || game.monsterHp <= 0) invalidAction("Combat has already ended for this room.");
    return action === "attack" ? attack(game, randomInt) : stormAttack(game, randomInt);
  }
  if (action === "potion") {
    const combatLimit = game.monsterType === 3 ? 3 : 2;
    if (
      !game.active ||
      game.potions <= 0 ||
      game.hp >= game.maxHp ||
      (game.monsterHp > 0 && game.combatPotionsUsed >= combatLimit)
    ) {
      invalidAction("A potion cannot be used in this state.");
    }
    return drinkPotion(game, randomInt);
  }
  if (action === "next-room") {
    if (
      !game.active ||
      game.monsterHp > 0 ||
      game.relicOfferAvailable ||
      game.roomsCleared >= CHALLENGE_TARGET_ROOMS
    ) {
      invalidAction("The next room cannot be entered from this state.");
    }
    return enterNextRoom(game, randomInt);
  }

  validateShopAction(game, action);
  return buy(game, action);
}

export function startChallengeRun(definition: ChallengeDefinition): ChallengeRun {
  const random = createSeededRandom(definition.seed);
  const game = startRun(random.nextInt);
  return {
    definition,
    game: {
      ...game,
      log: [
        `🏁 ${definition.id} begins. Every challenger receives the same seed.`,
        ...game.log.slice(0, 11),
      ],
    },
    randomState: random.state(),
    actions: [],
  };
}

export function applyChallengeAction(
  run: ChallengeRun,
  action: ChallengeAction
): ChallengeRun {
  if (isChallengeComplete(run)) invalidAction("The challenge run is already complete.");
  if (run.actions.length >= CHALLENGE_MAX_ACTIONS) {
    throw new ChallengeProofError("too_many_actions", "The challenge action limit was reached.");
  }
  const random = createSeededRandom(run.definition.seed, run.randomState);
  const game = applyGameAction(run.game, action, random.nextInt);
  return {
    ...run,
    game,
    randomState: random.state(),
    actions: [...run.actions, actionCode(action)],
  };
}

export function replayChallenge(
  definition: ChallengeDefinition,
  actions: readonly ChallengeActionCode[]
): ChallengeRun {
  if (actions.length > CHALLENGE_MAX_ACTIONS) {
    throw new ChallengeProofError("too_many_actions", "The challenge action limit was exceeded.");
  }
  return actions.reduce((run, code) => {
    const action = CHALLENGE_ACTIONS[code];
    if (!action) throw new ChallengeProofError("unknown_action", "The proof contains an unknown action.");
    return applyChallengeAction(run, action);
  }, startChallengeRun(definition));
}

export function challengeScore(run: ChallengeRun): number {
  const game = run.game;
  const score = game.roomsCleared * 10_000
    + (game.roomsCleared >= CHALLENGE_TARGET_ROOMS ? 5_000 : 0)
    + Math.max(0, game.hp) * 20
    + game.gold * 5
    + game.potions * 100
    + (game.weaponLevel + game.armorLevel) * 250
    - run.actions.length * 10;
  return Math.max(0, score);
}

export function challengeResult(run: ChallengeRun): ChallengeResult {
  if (!isChallengeComplete(run)) {
    throw new ChallengeProofError("incomplete_run", "A result can only be created after the run ends.");
  }
  return {
    challengeId: run.definition.id,
    rulesVersion: run.definition.rulesVersion,
    seed: run.definition.seed,
    outcome: run.game.roomsCleared >= CHALLENGE_TARGET_ROOMS ? "cleared" : "defeated",
    roomsCleared: run.game.roomsCleared,
    hp: run.game.hp,
    gold: run.game.gold,
    potions: run.game.potions,
    weaponLevel: run.game.weaponLevel,
    armorLevel: run.game.armorLevel,
    relicId: run.game.equippedRelic,
    actionCount: run.actions.length,
    score: challengeScore(run),
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ChallengeProofError("invalid_encoding", "The proof uses invalid base64url characters.");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new ChallengeProofError("invalid_encoding", "The proof could not be decoded.");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digestFor(id: string, actions: string): Promise<string> {
  const canonical = JSON.stringify([
    "delveworn-weekly-proof",
    CHALLENGE_RULES_VERSION,
    id,
    actions,
  ]);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createChallengeProof(run: ChallengeRun): Promise<VerifiedChallengeResult> {
  const result = challengeResult(run);
  const actions = run.actions.join("");
  const digest = await digestFor(run.definition.id, actions);
  const payload = JSON.stringify([
    CHALLENGE_RULES_VERSION,
    run.definition.id,
    actions,
    digest,
  ]);
  const proof = bytesToBase64Url(new TextEncoder().encode(payload));
  return { proof, runId: digest.slice(0, 12), run, result };
}

export async function verifyChallengeProof(
  expectedChallengeId: string,
  proof: string
): Promise<VerifiedChallengeResult> {
  if (!proof || proof.length > CHALLENGE_MAX_PROOF_LENGTH) {
    throw new ChallengeProofError("proof_size", "The result proof is empty or too large.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(proof)));
  } catch (error) {
    if (error instanceof ChallengeProofError) throw error;
    throw new ChallengeProofError("invalid_json", "The result proof is not valid JSON.");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 4 ||
    parsed[0] !== CHALLENGE_RULES_VERSION ||
    typeof parsed[1] !== "string" ||
    typeof parsed[2] !== "string" ||
    typeof parsed[3] !== "string"
  ) {
    throw new ChallengeProofError("invalid_schema", "The result proof has an unsupported schema.");
  }
  const [, challengeId, actionString, suppliedDigest] = parsed;
  if (challengeId !== expectedChallengeId) {
    throw new ChallengeProofError("challenge_mismatch", "This result belongs to a different weekly challenge.");
  }
  const definition = getChallengeDefinition(challengeId);
  if (!definition) throw new ChallengeProofError("invalid_challenge", "The challenge ID is invalid.");
  if (actionString.length > CHALLENGE_MAX_ACTIONS || !/^[ASPNBTRCWO]*$/.test(actionString)) {
    throw new ChallengeProofError("invalid_actions", "The result contains unknown or too many actions.");
  }
  if (!/^[0-9a-f]{64}$/.test(suppliedDigest)) {
    throw new ChallengeProofError("invalid_digest", "The result integrity code is invalid.");
  }
  const expectedDigest = await digestFor(challengeId, actionString);
  if (suppliedDigest !== expectedDigest) {
    throw new ChallengeProofError("digest_mismatch", "The result payload was changed after it was created.");
  }
  const actions = [...actionString] as ChallengeActionCode[];
  const run = replayChallenge(definition, actions);
  const result = challengeResult(run);
  return { proof, runId: expectedDigest.slice(0, 12), run, result };
}

export function challengeShareUrl(
  origin: string,
  verified: Pick<VerifiedChallengeResult, "proof" | "runId" | "result">
): string {
  const url = new URL(`/challenge/${verified.result.challengeId}`, origin);
  url.searchParams.set("r", verified.proof);
  url.searchParams.set("ref", verified.runId);
  return url.href;
}
