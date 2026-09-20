import { createRun, transition } from "./engine";
import { bind, hash } from "./protocol";
import { createRun as createLegacyRun, transition as legacyTransition } from "./legacy-v2/engine";
import type { SaveEnvelope as LegacySave } from "./legacy-v2/types";
import type { Command, Run, SaveEnvelope } from "./types";

// Keep the existing storage slot: the envelope, not its key, owns the format version.
export const SAVE_KEY = "delveworn:mind-beneath:v2";
export const MAX_JOURNAL = 12_000;
export const MAX_SAVE_BYTES = 4_000_000;
export function envelope(run: Run): SaveEnvelope {
  const data = { version: 3 as const, rules: "mind-beneath-2" as const, runId: run.runId, seed: run.seed, revision: run.revision, journal: run.journal };
  return { ...data, checksum: hash(data) };
}
export function replay(seed: number, runId: string, journal: SaveEnvelope["journal"]): Run | null {
  let run = createRun(seed, runId);
  for (const entry of journal) {
    if (!entry || entry.revision !== run.revision || !entry.command || typeof entry.command !== "object") return null;
    const next = transition(run, entry.command as Command, entry.revision, false);
    if (next === run) return null;
    run = next;
  }
  run.journal = journal;
  return run;
}
/** Validate every old binding against the frozen rules before translating/rebinding it.
 * Never accept a stale/forged legacy plan merely because its checksum was recomputed.
 * Player-authored maneuver names and all mechanical choices stay untouched.
 */
function migrateV2(save: LegacySave): Run | null {
  let legacy = createLegacyRun(save.seed, save.runId);
  let current = createRun(save.seed, save.runId);
  for (const entry of save.journal) {
    if (!entry || entry.revision !== legacy.revision || !entry.command || typeof entry.command !== "object") return null;
    const verified = legacyTransition(legacy, entry.command, entry.revision, false);
    if (verified === legacy) return null;
    const command = structuredClone(entry.command);
    if (command.type === "commit") {
      command.plan.binding = bind(current, command.plan.binding.requestId, command.plan.binding.generation);
      // Authored plan titles are presentation. A maneuver's chosen name is the player's.
      if (!command.plan.maneuverId) command.plan.name = "A Possible Future";
    }
    const next = transition(current, command, entry.revision);
    if (next === current) return null;
    legacy = verified; current = next;
  }
  return current;
}
export function restore(value: unknown): Run | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as SaveEnvelope | LegacySave;
  if (!(v.version === 3 && v.rules === "mind-beneath-2" || v.version === 2 && v.rules === "mind-beneath-1") || typeof v.runId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.runId)
    || !Number.isSafeInteger(v.seed) || v.seed < 0 || v.seed > 0xffffffff || !Number.isSafeInteger(v.revision)
    || !Array.isArray(v.journal) || v.journal.length > MAX_JOURNAL || v.revision !== v.journal.length) return null;
  const { checksum, ...data } = v;
  if (checksum !== hash(data)) return null;
  try { return v.version === 2 ? migrateV2(v) : replay(v.seed, v.runId, v.journal); } catch { return null; }
}
export function decodeSave(raw: string): Run | null {
  if (raw.length > MAX_SAVE_BYTES) return null;
  try { return restore(JSON.parse(raw)); } catch { return null; }
}
export type SaveResult = "saved" | "conflict" | "unavailable" | "limit";
export function persist(storage: Pick<Storage, "getItem" | "setItem">, run: Run, expected: number | null): SaveResult {
  try {
    const existing = storage.getItem(SAVE_KEY);
    if (existing && expected !== null) {
      const header = JSON.parse(existing) as SaveEnvelope;
      if (header.runId !== run.runId || header.revision !== expected) return "conflict";
    } else if (existing && expected === null) return "conflict";
    const raw = JSON.stringify(envelope(run));
    if (raw.length > MAX_SAVE_BYTES || run.journal.length > MAX_JOURNAL) return "limit";
    storage.setItem(SAVE_KEY, raw);
    return "saved";
  } catch { return "unavailable"; }
}
/** V0 remains untouched. It cannot truthfully be converted into observations it never recorded. */
export function legacyNotice(storage: Pick<Storage, "getItem">): boolean {
  try { return !!storage.getItem("delveworn_living_dungeon_v1"); } catch { return false; }
}
