import { createPracticeGrid, type PracticeGridState } from "../practice/grid-state";
import { enterNextRoom, type PracticeGame } from "../practice/engine";
import type { RandomInt } from "../practice/random";
import {
  inspectPracticeRun,
  isPracticeImportIdentity,
  isStoredPracticeGame,
  PRACTICE_RUN_STORAGE_KEY,
  savePracticeRunIfUnchanged,
  type PracticeImportIdentity,
  type PracticeRunStorage,
} from "../practice/storage";
import { DESCENT_RULES, phase, type Descent } from "./model";
import { isDescent } from "./storage";

const HANDOFF_VERSION = 1 as const;
const HANDOFF_KEY_PREFIX = "delveworn_first_descent_handoff_v1:";
const MAX_HANDOFF_LENGTH = 40_000;

export type PracticeHandoff = Readonly<{
  version: typeof HANDOFF_VERSION;
  id: string;
  sourceRules: typeof DESCENT_RULES;
  sourceRunId: string;
  sourceRevision: number;
  sourceWeekly?: Readonly<{
    challengeId: string;
    rulesVersion: 2;
  }>;
  game: PracticeGame;
}>;

export type PracticeHandoffLoad =
  | { status: "restored"; handoff: PracticeHandoff }
  | { status: "empty" | "invalid" | "unavailable" };

export type PracticeHandoffSave = "saved" | "exists" | "conflict" | "unavailable";

export type PracticeContinuationResult =
  | {
      status: "imported" | "resumed";
      game: PracticeGame;
      grid: PracticeGridState;
      identity: PracticeImportIdentity;
      practiceRaw: string;
    }
  | { status: "needs-confirmation"; expectedPractice: string }
  | { status: "conflict" | "invalid" | "unavailable" | "busy" };

export type PracticeContinuationLocks = {
  request: <T>(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: unknown | null) => T,
  ) => Promise<T>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRunId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value);
}

function validHandoffId(value: unknown): value is string {
  return typeof value === "string" && /^fd-[a-zA-Z0-9-]{1,80}$/.test(value);
}

function integer(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function weeklySource(value: unknown): PracticeHandoff["sourceWeekly"] {
  if (!record(value)) return undefined;
  const weekly = value.weekly;
  if (!record(weekly) || typeof weekly.challengeId !== "string"
    || !/^\d{4}-W\d{2}$/.test(weekly.challengeId) || weekly.rulesVersion !== 2) return undefined;
  return { challengeId: weekly.challengeId, rulesVersion: 2 };
}

function validWeeklySource(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value)) return false;
  return typeof value.challengeId === "string" && /^\d{4}-W\d{2}$/.test(value.challengeId)
    && value.rulesVersion === 2;
}

function claimedFirstBoss(game: PracticeGame): boolean {
  if (!game.hasStarted || !game.active || game.roomsCleared !== 10 || game.monsterType !== 3
    || game.monsterHp !== 0 || game.relicOfferAvailable || game.relicOfferId !== 0
    || game.relicOfferRarity !== 0 || game.ownedRelics.length !== 1) return false;
  const relic = game.ownedRelics[0];
  return game.relicCounts[relic] === 1
    && game.relicCounts.every((count, id) => id === relic ? count === 1 : count === 0)
    && (game.equippedRelic === 0 || game.equippedRelic === relic);
}

export function practiceHandoffId(sourceRunId: string): string {
  if (!validRunId(sourceRunId)) throw new RangeError("Invalid First Descent run ID");
  return `fd-${sourceRunId}`;
}

export function practiceHandoffStorageKey(id: string): string {
  if (!validHandoffId(id)) throw new RangeError("Invalid Practice handoff ID");
  return `${HANDOFF_KEY_PREFIX}${id}`;
}

export function isPracticeHandoff(value: unknown): value is PracticeHandoff {
  if (!record(value)) return false;
  if (value.version !== HANDOFF_VERSION || value.sourceRules !== DESCENT_RULES
    || !validRunId(value.sourceRunId) || !validHandoffId(value.id)
    || value.id !== practiceHandoffId(value.sourceRunId)
    || !integer(value.sourceRevision, 1_000_000)
    || !validWeeklySource(value.sourceWeekly)
    || !isStoredPracticeGame(value.game)) return false;
  return claimedFirstBoss(value.game);
}

/** Build an immutable transfer record only from a fully settled First Descent. */
export function createPracticeHandoff(run: Descent): PracticeHandoff | null {
  if (!isDescent(run) || phase(run) !== "won" || run.pendingLoot !== null || !claimedFirstBoss(run.game)) {
    return null;
  }
  const sourceWeekly = weeklySource(run);
  return {
    version: HANDOFF_VERSION,
    id: practiceHandoffId(run.runId),
    sourceRules: DESCENT_RULES,
    sourceRunId: run.runId,
    sourceRevision: run.revision,
    ...(sourceWeekly ? { sourceWeekly } : {}),
    game: run.game,
  };
}

export function loadPracticeHandoff(storage: PracticeRunStorage, id: string): PracticeHandoffLoad {
  let key: string;
  try {
    key = practiceHandoffStorageKey(id);
  } catch {
    return { status: "invalid" };
  }
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { status: "empty" };
    if (raw.length > MAX_HANDOFF_LENGTH) return { status: "invalid" };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { status: "invalid" }; }
    return isPracticeHandoff(parsed)
      ? { status: "restored", handoff: parsed }
      : { status: "invalid" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Never replaces an existing transfer record with different contents. */
export function savePracticeHandoff(storage: PracticeRunStorage, handoff: PracticeHandoff): PracticeHandoffSave {
  if (!isPracticeHandoff(handoff)) return "conflict";
  const key = practiceHandoffStorageKey(handoff.id);
  const serialized = JSON.stringify(handoff);
  try {
    const current = storage.getItem(key);
    if (current !== null) return current === serialized ? "exists" : "conflict";
    storage.setItem(key, serialized);
    return storage.getItem(key) === serialized ? "saved" : "conflict";
  } catch {
    return "unavailable";
  }
}

function continuationIdentity(handoff: PracticeHandoff): PracticeImportIdentity {
  return {
    source: "first-descent",
    sourceRunId: handoff.sourceRunId,
    handoffId: handoff.id,
  };
}

function sameImport(identity: PracticeImportIdentity | undefined, handoff: PracticeHandoff): boolean {
  return Boolean(identity
    && identity.source === "first-descent"
    && identity.sourceRunId === handoff.sourceRunId
    && identity.handoffId === handoff.id);
}

/**
 * Compare-before-write import authority. Call inside `withPracticeContinuationLock`
 * in browsers; the raw comparison is retained as a fallback and protects a
 * confirmation from replacing a save that changed after it was shown.
 */
export function acceptPracticeHandoff(
  storage: PracticeRunStorage,
  handoff: PracticeHandoff,
  randomInt: RandomInt,
  layoutSeed: () => number,
  options: { replace?: boolean; expectedPractice?: string } = {},
): PracticeContinuationResult {
  if (!isPracticeHandoff(handoff)) return { status: "invalid" };

  let currentRaw: string | null;
  try {
    currentRaw = storage.getItem(PRACTICE_RUN_STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }

  const current = inspectPracticeRun(storage);
  if (current.status === "unavailable") return { status: "unavailable" };
  if (current.status === "restored" && sameImport(current.importedFrom, handoff)) {
    try {
      if (storage.getItem(PRACTICE_RUN_STORAGE_KEY) !== currentRaw || currentRaw === null) {
        return { status: "conflict" };
      }
    } catch {
      return { status: "unavailable" };
    }
    return {
      status: "resumed",
      game: current.game,
      grid: current.grid,
      identity: current.importedFrom!,
      practiceRaw: currentRaw,
    };
  }

  const occupied = current.status === "invalid"
    || (current.status === "restored" && current.game.hasStarted);
  if (occupied && !options.replace) {
    return { status: "needs-confirmation", expectedPractice: currentRaw ?? "" };
  }
  if (occupied && options.expectedPractice !== currentRaw) return { status: "conflict" };

  // Re-read immediately before generating room 11. Under the browser lock this
  // is exclusive; without it, this prevents a stale confirmation in this tab.
  try {
    if (storage.getItem(PRACTICE_RUN_STORAGE_KEY) !== currentRaw) return { status: "conflict" };
  } catch {
    return { status: "unavailable" };
  }

  let game: PracticeGame;
  let grid: PracticeGridState;
  try {
    game = enterNextRoom(handoff.game, randomInt);
    grid = createPracticeGrid(layoutSeed());
  } catch {
    return { status: "unavailable" };
  }
  if (game.roomsCleared !== 10 || game.monsterHp <= 0 || game.monsterType === 3 || !game.active) {
    return { status: "invalid" };
  }

  const identity = continuationIdentity(handoff);
  if (!isPracticeImportIdentity(identity)) return { status: "invalid" };
  const saved = savePracticeRunIfUnchanged(storage, currentRaw, game, grid, identity);
  if (saved.status !== "saved") return { status: saved.status };

  const confirmed = inspectPracticeRun(storage);
  if (confirmed.status !== "restored" || !sameImport(confirmed.importedFrom, handoff)) {
    return { status: "conflict" };
  }
  try {
    if (storage.getItem(PRACTICE_RUN_STORAGE_KEY) !== saved.serialized) return { status: "conflict" };
  } catch {
    return { status: "unavailable" };
  }
  return {
    status: "imported",
    game: confirmed.game,
    grid: confirmed.grid,
    identity: confirmed.importedFrom!,
    practiceRaw: saved.serialized,
  };
}

function browserLocks(): PracticeContinuationLocks | null {
  if (typeof navigator === "undefined" || !navigator.locks) return null;
  return {
    request: (name, options, callback) => navigator.locks.request(name, options, callback),
  };
}

export type PracticeRunLockResult<T> =
  | { status: "acquired"; value: T }
  | { status: "busy" | "unavailable" };

export async function withPracticeRunLock<T>(
  operation: () => T,
  locks: PracticeContinuationLocks | null = browserLocks(),
): Promise<PracticeRunLockResult<T>> {
  try {
    if (!locks) return { status: "acquired", value: operation() };
    return await locks.request(
      PRACTICE_RUN_STORAGE_KEY,
      { ifAvailable: true },
      lock => lock ? { status: "acquired", value: operation() } : { status: "busy" },
    );
  } catch {
    return { status: "unavailable" };
  }
}

export async function withPracticeContinuationLock(
  operation: () => PracticeContinuationResult,
  locks: PracticeContinuationLocks | null = browserLocks(),
): Promise<PracticeContinuationResult> {
  const result = await withPracticeRunLock(operation, locks);
  return result.status === "acquired" ? result.value : { status: result.status };
}
