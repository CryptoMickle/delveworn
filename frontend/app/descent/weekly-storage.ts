import {
  WEEKLY_DESCENT_MAX_ACTIONS,
  getWeeklyDescentDefinition,
  replayWeeklyDescent,
  type WeeklyDescent,
  type WeeklyDescentActionCode,
} from "./weekly";

export const WEEKLY_DESCENT_SAVE_PREFIX = "delveworn_weekly_descent_v2:";
const MAX_STORED_WEEKLY_DESCENT_LENGTH = 1_024;

type StorageSource = () => Pick<Storage, "getItem" | "setItem">;

type StoredWeeklyDescent = {
  id: string;
  runId: string;
  actions: string;
};

export type WeeklyDescentLoadResult =
  | { status: "restored"; run: WeeklyDescent }
  | { status: "empty" | "invalid" | "unavailable" };

export function weeklyDescentSaveKey(id: string): string {
  return `${WEEKLY_DESCENT_SAVE_PREFIX}${id}`;
}

function strictStoredRun(value: unknown): value is StoredWeeklyDescent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return keys.length === 3
    && keys[0] === "actions"
    && keys[1] === "id"
    && keys[2] === "runId"
    && typeof record.id === "string"
    && typeof record.runId === "string"
    && /^[a-zA-Z0-9-]{1,80}$/.test(record.runId)
    && typeof record.actions === "string"
    && record.actions.length <= WEEKLY_DESCENT_MAX_ACTIONS;
}

export function loadWeeklyDescent(
  source: StorageSource,
  id: string
): WeeklyDescentLoadResult {
  const definition = getWeeklyDescentDefinition(id);
  if (!definition) return { status: "invalid" };
  try {
    const raw = source().getItem(weeklyDescentSaveKey(id));
    if (raw === null) return { status: "empty" };
    if (raw.length > MAX_STORED_WEEKLY_DESCENT_LENGTH) return { status: "invalid" };
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { status: "invalid" }; }
    if (!strictStoredRun(value) || value.id !== id) return { status: "invalid" };
    try {
      const actions = [...value.actions] as WeeklyDescentActionCode[];
      return { status: "restored", run: replayWeeklyDescent(definition, value.runId, actions) };
    } catch {
      return { status: "invalid" };
    }
  } catch {
    return { status: "unavailable" };
  }
}

function canonicalRun(run: WeeklyDescent): WeeklyDescent | null {
  const definition = getWeeklyDescentDefinition(run.weekly.challengeId);
  if (!definition) return null;
  try {
    const replayed = replayWeeklyDescent(definition, run.runId, run.weekly.actions);
    return JSON.stringify(replayed) === JSON.stringify(run) ? replayed : null;
  } catch {
    return null;
  }
}

function sameStoredRun(current: WeeklyDescent, previous: WeeklyDescent | null): boolean {
  return previous !== null
    && current.weekly.challengeId === previous.weekly.challengeId
    && current.runId === previous.runId
    && current.weekly.actions.join("") === previous.weekly.actions.join("");
}

/** Compare-before-write rejects stale tabs; only replay inputs are persisted. */
export function saveWeeklyDescent(
  source: StorageSource,
  next: WeeklyDescent,
  previous: WeeklyDescent | null,
  replace = false
): "saved" | "conflict" | "unavailable" {
  const canonical = canonicalRun(next);
  if (!canonical) return "conflict";
  const id = canonical.weekly.challengeId;
  const stored = loadWeeklyDescent(source, id);
  if (stored.status === "unavailable") return "unavailable";
  if (!replace && (stored.status === "invalid"
    || (stored.status === "restored" && !sameStoredRun(stored.run, previous))
    || (stored.status === "empty" && previous !== null))) return "conflict";

  const value: StoredWeeklyDescent = {
    id,
    runId: canonical.runId,
    actions: canonical.weekly.actions.join(""),
  };
  try {
    source().setItem(weeklyDescentSaveKey(id), JSON.stringify(value));
    return "saved";
  } catch {
    return "unavailable";
  }
}
