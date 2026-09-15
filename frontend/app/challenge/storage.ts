import {
  CHALLENGE_MAX_ACTIONS,
  CHALLENGE_RULES_VERSION,
  getChallengeDefinition,
  replayChallenge,
  type ChallengeActionCode,
  type ChallengeRun,
} from "./core";

export const CHALLENGE_RUN_STORAGE_PREFIX = "delveworn_weekly_challenge_v1:";
const MAX_STORED_RUN_LENGTH = 1_024;

type ChallengeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredChallengeRun = {
  v: typeof CHALLENGE_RULES_VERSION;
  c: string;
  a: string;
  ref: string | null;
};

export type LoadedChallengeRun = {
  run: ChallengeRun;
  referral: string | null;
};

function storageKey(challengeId: string): string {
  return `${CHALLENGE_RUN_STORAGE_PREFIX}${challengeId}`;
}

function validReferral(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^[0-9a-f]{12}$/.test(value));
}

export function saveChallengeRun(
  storage: ChallengeStorage,
  run: ChallengeRun,
  referral: string | null
): boolean {
  try {
    const stored: StoredChallengeRun = {
      v: CHALLENGE_RULES_VERSION,
      c: run.definition.id,
      a: run.actions.join(""),
      ref: validReferral(referral) ? referral : null,
    };
    storage.setItem(storageKey(run.definition.id), JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function loadChallengeRun(
  storage: ChallengeStorage,
  challengeId: string
): LoadedChallengeRun | null {
  try {
    const raw = storage.getItem(storageKey(challengeId));
    if (!raw || raw.length > MAX_STORED_RUN_LENGTH) return null;
    const stored: unknown = JSON.parse(raw);
    if (
      typeof stored !== "object" ||
      stored === null ||
      !("v" in stored) ||
      !("c" in stored) ||
      !("a" in stored) ||
      !("ref" in stored)
    ) return null;
    const value = stored as Record<string, unknown>;
    if (
      value.v !== CHALLENGE_RULES_VERSION ||
      value.c !== challengeId ||
      typeof value.a !== "string" ||
      value.a.length > CHALLENGE_MAX_ACTIONS ||
      !/^[ASPNBTRCWO]*$/.test(value.a) ||
      !validReferral(value.ref)
    ) return null;
    const definition = getChallengeDefinition(challengeId);
    if (!definition) return null;
    const run = replayChallenge(definition, [...value.a] as ChallengeActionCode[]);
    return { run, referral: value.ref };
  } catch {
    return null;
  }
}

export function clearChallengeRun(
  storage: ChallengeStorage,
  challengeId: string
): void {
  try {
    storage.removeItem(storageKey(challengeId));
  } catch {
    // A blocked store must not block wallet-free play.
  }
}
