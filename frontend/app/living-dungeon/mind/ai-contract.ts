import { PRINCIPLES } from "./catalogue";
import { currentBinding, isOperation } from "./protocol";
import type { Binding, Family, Operation, Plan, PrincipleId, Run, SaveEnvelope, Scope } from "./types";

export type MindRequest = { task: "plan" | "teach" | "director"; text: string; binding: Binding; save: SaveEnvelope };
export type MindReply = { source: "ai" | "cache" | "fallback"; binding: Binding; plan: Plan | null; teaching: { principle: PrincipleId; scope: Scope } | null; family: Family | null; line: string; reason: string | null; usage: { model: string; input: number; output: number } | null };
export const AI_TEXT_LIMIT = 400;
export function validReply(run: Run, reply: MindReply, expected: Binding): boolean {
  if (!reply || !["ai", "cache", "fallback"].includes(reply.source) || !currentBinding(run, reply.binding, expected)) return false;
  if (reply.teaching && (!Object.hasOwn(PRINCIPLES, reply.teaching.principle) || !["always", "innocent-at-risk", "no-one-else-hurt", "suspicious-offer"].includes(reply.teaching.scope))) return false;
  if (reply.plan && (!Array.isArray(reply.plan.steps) || !reply.plan.steps.length || reply.plan.steps.length > 48 || !reply.plan.steps.every(isOperation) || !currentBinding(run, reply.plan.binding, expected))) return false;
  return typeof reply.line === "string" && reply.line.length <= 220;
}
export type SemanticOutput = { principle: PrincipleId | "none"; scope: Scope; steps: { verb: Operation["verb"]; target: string; x: number; y: number; signature: "none" | NonNullable<Operation["signature"]> }[]; boundary: "none" | "no-harm" | "free-target"; family: Family; line: string; clarification: boolean };
