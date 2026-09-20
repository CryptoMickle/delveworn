import { createRun, transition } from "./engine";
import { hash } from "./protocol";
import type { Command, Run, SaveEnvelope } from "./types";

export const SAVE_KEY = "delveworn:mind-beneath:v2";
export const MAX_JOURNAL = 12_000;
export const MAX_SAVE_BYTES = 4_000_000;
export function envelope(run: Run): SaveEnvelope {
  const data = { version: 2 as const, rules: "mind-beneath-1" as const, runId: run.runId, seed: run.seed, revision: run.revision, journal: run.journal };
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
export function restore(value: unknown): Run | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as SaveEnvelope;
  if (v.version !== 2 || v.rules !== "mind-beneath-1" || typeof v.runId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.runId)
    || !Number.isSafeInteger(v.seed) || v.seed < 0 || v.seed > 0xffffffff || !Number.isSafeInteger(v.revision)
    || !Array.isArray(v.journal) || v.journal.length > MAX_JOURNAL || v.revision !== v.journal.length) return null;
  const { checksum, ...data } = v;
  if (checksum !== hash(data)) return null;
  try { return replay(v.seed, v.runId, v.journal); } catch { return null; }
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
