import { OPS, type Binding, type Operation, type Run } from "./types";

export function hash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
export function digest(run: Run): string {
  return hash([run.runId, run.revision, run.rng, run.tick, run.room, run.player, run.relic, run.reports, run.hypotheses]);
}
export function bind(run: Run, requestId = "local", generation = "local"): Binding {
  return { runId: run.runId, revision: run.revision, digest: digest(run), requestId, generation };
}
export function currentBinding(run: Run, binding: Binding, expected?: Binding): boolean {
  return !!binding && binding.runId === run.runId && binding.revision === run.revision && binding.digest === digest(run)
    && (!expected || binding.requestId === expected.requestId && binding.generation === expected.generation);
}
export function isOperation(value: unknown): value is Operation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["verb", "target", "at", "signature"].includes(k)) || !OPS.includes(v.verb as Operation["verb"])) return false;
  if (v.target !== undefined && (typeof v.target !== "string" || !/^[a-z0-9-]{1,40}$/.test(v.target))) return false;
  if (v.signature !== undefined && !["mercy", "storm", "force", "cunning", "self-preservation"].includes(v.signature as string)) return false;
  if (v.at !== undefined) {
    if (!v.at || typeof v.at !== "object" || Array.isArray(v.at)) return false;
    const p = v.at as Record<string, unknown>;
    if (Object.keys(p).length !== 2 || !Number.isInteger(p.x) || !Number.isInteger(p.y) || Number(p.x) < 0 || Number(p.x) > 10 || Number(p.y) < 0 || Number(p.y) > 8) return false;
  }
  return true;
}
