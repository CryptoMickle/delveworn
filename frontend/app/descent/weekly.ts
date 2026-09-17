import { challengeIdForDate, getChallengeDefinition } from "../challenge/core";
import {
  createDescent,
  phase,
  transition,
  type Descent,
  type DescentAction,
} from "./model";

export const WEEKLY_DESCENT_RULES_VERSION = 2 as const;
export const WEEKLY_DESCENT_TARGET_ROOMS = 10 as const;
export const WEEKLY_DESCENT_MAX_ACTIONS = 320;
export const WEEKLY_DESCENT_MAX_PROOF_LENGTH = 2_048;

export type WeeklyDescentDefinition = {
  id: string;
  rulesVersion: typeof WEEKLY_DESCENT_RULES_VERSION;
  seed: number;
  startsAt: string;
  endsAt: string;
  targetRooms: typeof WEEKLY_DESCENT_TARGET_ROOMS;
};

export const WEEKLY_DESCENT_ACTIONS = {
  E: "engage",
  A: "attack",
  S: "storm",
  P: "potion",
  N: "enter",
  L: "collect",
  X: "skip-loot",
  K: "claim",
  Q: "claim-equip",
  B: "supply-bandage",
  T: "supply-potion",
  R: "camp-rest",
  C: "camp-potion",
  W: "camp-weapon",
  O: "camp-armor",
} as const satisfies Record<string, DescentAction>;

export type WeeklyDescentActionCode = keyof typeof WEEKLY_DESCENT_ACTIONS;

export type WeeklyDescent = Descent & {
  weekly: {
    challengeId: string;
    rulesVersion: typeof WEEKLY_DESCENT_RULES_VERSION;
    actions: WeeklyDescentActionCode[];
  };
};

export type WeeklyDescentResult = {
  challengeId: string;
  rulesVersion: typeof WEEKLY_DESCENT_RULES_VERSION;
  seed: number;
  score: number;
  outcome: "cleared" | "defeated";
  roomsCleared: number;
  hp: number;
  gold: number;
  potions: number;
  weaponLevel: number;
  armorLevel: number;
  relicId: number;
  combatTurns: number;
  actionCount: number;
};

export type VerifiedWeeklyDescent = {
  proof: string;
  runId: string;
  result: WeeklyDescentResult;
  run: WeeklyDescent;
};

export type VerifiedWeeklyDescentResult = VerifiedWeeklyDescent;

export class WeeklyDescentProofError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WeeklyDescentProofError";
    this.code = code;
  }
}

const ACTION_CODES = Object.fromEntries(
  Object.entries(WEEKLY_DESCENT_ACTIONS).map(([code, action]) => [action, code])
) as Record<DescentAction, WeeklyDescentActionCode>;

function seedForWeeklyDescent(id: string): number {
  const input = `delveworn:weekly:${WEEKLY_DESCENT_RULES_VERSION}:${id}`;
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

export function getWeeklyDescentDefinition(id: string): WeeklyDescentDefinition | null {
  const calendar = getChallengeDefinition(id);
  if (!calendar) return null;
  return {
    id: calendar.id,
    rulesVersion: WEEKLY_DESCENT_RULES_VERSION,
    seed: seedForWeeklyDescent(calendar.id),
    startsAt: calendar.startsAt,
    endsAt: calendar.endsAt,
    targetRooms: WEEKLY_DESCENT_TARGET_ROOMS,
  };
}

export function weeklyDescentIdForDate(date = new Date()): string {
  return challengeIdForDate(date);
}

function requireDefinition(definition: WeeklyDescentDefinition): WeeklyDescentDefinition {
  const canonical = getWeeklyDescentDefinition(definition.id);
  if (!canonical
    || canonical.rulesVersion !== definition.rulesVersion
    || canonical.seed !== definition.seed
    || canonical.startsAt !== definition.startsAt
    || canonical.endsAt !== definition.endsAt
    || canonical.targetRooms !== definition.targetRooms) {
    throw new WeeklyDescentProofError("invalid_challenge", "The weekly descent definition is invalid.");
  }
  return canonical;
}

function requireRunId(runId: string): void {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(runId)) {
    throw new WeeklyDescentProofError("invalid_run_id", "The weekly descent run ID is invalid.");
  }
}

export function createWeeklyDescent(
  definition: WeeklyDescentDefinition,
  runId: string
): WeeklyDescent {
  const canonical = requireDefinition(definition);
  requireRunId(runId);
  return {
    ...createDescent(canonical.seed, runId),
    weekly: {
      challengeId: canonical.id,
      rulesVersion: WEEKLY_DESCENT_RULES_VERSION,
      actions: [],
    },
  };
}

/** Rejected inputs preserve object identity and consume neither RNG nor trace space. */
export function transitionWeeklyDescent(
  run: WeeklyDescent,
  action: DescentAction
): WeeklyDescent {
  if (run.weekly.actions.length >= WEEKLY_DESCENT_MAX_ACTIONS) return run;
  const next = transition(run, action);
  if (next === run) return run;
  return {
    ...next,
    weekly: {
      ...run.weekly,
      actions: [...run.weekly.actions, ACTION_CODES[action]],
    },
  };
}

function invalidAction(message: string): never {
  throw new WeeklyDescentProofError("invalid_action", message);
}

export function replayWeeklyDescent(
  definition: WeeklyDescentDefinition,
  runId: string,
  actions: readonly WeeklyDescentActionCode[]
): WeeklyDescent {
  if (actions.length > WEEKLY_DESCENT_MAX_ACTIONS) {
    throw new WeeklyDescentProofError("too_many_actions", "The weekly descent action limit was exceeded.");
  }
  return actions.reduce((run, code) => {
    const action = (WEEKLY_DESCENT_ACTIONS as Record<string, DescentAction | undefined>)[code];
    if (!action) invalidAction("The weekly descent contains an unknown action.");
    const next = transitionWeeklyDescent(run, action);
    if (next === run) invalidAction("The weekly descent contains an action that is illegal in this state.");
    return next;
  }, createWeeklyDescent(definition, runId));
}

export function isWeeklyDescentComplete(run: WeeklyDescent): boolean {
  const current = phase(run);
  return current === "won" || current === "lost";
}

/**
 * A weekly score rewards progress and held resources, then charges only combat
 * turns. Exploration, loot interaction, and rendering never add a time cost.
 */
export function weeklyDescentScore(run: WeeklyDescent): number {
  const game = run.game;
  const score = game.roomsCleared * 10_000
    + (phase(run) === "won" ? 5_000 : 0)
    + Math.max(0, game.hp) * 20
    + game.gold * 5
    + game.potions * 100
    + (game.weaponLevel + game.armorLevel) * 250
    - run.turns * 10;
  return Math.max(0, score);
}

export function weeklyDescentResult(run: WeeklyDescent): WeeklyDescentResult {
  if (!isWeeklyDescentComplete(run)) {
    throw new WeeklyDescentProofError("incomplete_run", "A result can only be created after the weekly descent ends.");
  }
  return {
    challengeId: run.weekly.challengeId,
    rulesVersion: run.weekly.rulesVersion,
    seed: run.seed,
    score: weeklyDescentScore(run),
    outcome: phase(run) === "won" ? "cleared" : "defeated",
    roomsCleared: run.game.roomsCleared,
    hp: run.game.hp,
    gold: run.game.gold,
    potions: run.game.potions,
    weaponLevel: run.game.weaponLevel,
    armorLevel: run.game.armorLevel,
    relicId: run.game.equippedRelic,
    combatTurns: run.turns,
    actionCount: run.weekly.actions.length,
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
    throw new WeeklyDescentProofError("invalid_encoding", "The proof uses invalid base64url characters.");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new WeeklyDescentProofError("invalid_encoding", "The proof could not be decoded.");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digestFor(id: string, actions: string): Promise<string> {
  const canonical = JSON.stringify([
    "delveworn-weekly-proof",
    WEEKLY_DESCENT_RULES_VERSION,
    id,
    actions,
  ]);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical)
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function canonicalRun(run: WeeklyDescent): WeeklyDescent {
  const definition = getWeeklyDescentDefinition(run.weekly.challengeId);
  if (!definition || run.weekly.rulesVersion !== WEEKLY_DESCENT_RULES_VERSION || run.seed !== definition.seed) {
    throw new WeeklyDescentProofError("invalid_challenge", "The run does not belong to a valid weekly descent.");
  }
  const replayed = replayWeeklyDescent(definition, run.runId, run.weekly.actions);
  if (JSON.stringify(replayed) !== JSON.stringify(run)) {
    throw new WeeklyDescentProofError("invalid_run", "The weekly descent state does not match its action trace.");
  }
  return replayed;
}

export async function createWeeklyDescentProof(run: WeeklyDescent): Promise<VerifiedWeeklyDescent> {
  const checked = canonicalRun(run);
  weeklyDescentResult(checked);
  const actions = checked.weekly.actions.join("");
  const digest = await digestFor(checked.weekly.challengeId, actions);
  const proof = bytesToBase64Url(new TextEncoder().encode(JSON.stringify([
    WEEKLY_DESCENT_RULES_VERSION,
    checked.weekly.challengeId,
    actions,
    digest,
  ])));
  const runId = digest.slice(0, 12);
  const canonical = replayWeeklyDescent(
    requireDefinition(getWeeklyDescentDefinition(checked.weekly.challengeId)!),
    runId,
    checked.weekly.actions
  );
  return { proof, runId, result: weeklyDescentResult(canonical), run: canonical };
}

export async function verifyWeeklyDescentProof(
  expectedChallengeId: string,
  proof: string
): Promise<VerifiedWeeklyDescent> {
  if (!proof || proof.length > WEEKLY_DESCENT_MAX_PROOF_LENGTH) {
    throw new WeeklyDescentProofError("proof_size", "The result proof is empty or too large.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(proof)));
  } catch (error) {
    if (error instanceof WeeklyDescentProofError) throw error;
    throw new WeeklyDescentProofError("invalid_json", "The result proof is not valid JSON.");
  }
  if (!Array.isArray(parsed)
    || parsed.length !== 4
    || parsed[0] !== WEEKLY_DESCENT_RULES_VERSION
    || typeof parsed[1] !== "string"
    || typeof parsed[2] !== "string"
    || typeof parsed[3] !== "string") {
    throw new WeeklyDescentProofError("invalid_schema", "The result proof has an unsupported schema.");
  }
  const [, challengeId, actionString, suppliedDigest] = parsed;
  if (challengeId !== expectedChallengeId) {
    throw new WeeklyDescentProofError("challenge_mismatch", "This result belongs to a different weekly challenge.");
  }
  const definition = getWeeklyDescentDefinition(challengeId);
  if (!definition) throw new WeeklyDescentProofError("invalid_challenge", "The weekly challenge ID is invalid.");
  if (actionString.length > WEEKLY_DESCENT_MAX_ACTIONS
    || ![...actionString].every((code) => code in WEEKLY_DESCENT_ACTIONS)) {
    throw new WeeklyDescentProofError("invalid_actions", "The result contains unknown or too many actions.");
  }
  if (!/^[0-9a-f]{64}$/.test(suppliedDigest)) {
    throw new WeeklyDescentProofError("invalid_digest", "The result integrity code is invalid.");
  }
  const expectedDigest = await digestFor(challengeId, actionString);
  if (suppliedDigest !== expectedDigest) {
    throw new WeeklyDescentProofError("digest_mismatch", "The result payload was changed after it was created.");
  }
  const runId = expectedDigest.slice(0, 12);
  const actions = [...actionString] as WeeklyDescentActionCode[];
  const run = replayWeeklyDescent(definition, runId, actions);
  return { proof, runId, result: weeklyDescentResult(run), run };
}

export function weeklyDescentShareUrl(
  origin: string,
  verified: Pick<VerifiedWeeklyDescent, "proof" | "runId" | "result">
): string {
  const url = new URL(`/challenge/${verified.result.challengeId}`, origin);
  url.searchParams.set("v", String(WEEKLY_DESCENT_RULES_VERSION));
  url.searchParams.set("r", verified.proof);
  url.searchParams.set("ref", verified.runId);
  return url.href;
}
