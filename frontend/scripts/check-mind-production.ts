import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createRun, transition } from "../app/living-dungeon/mind/engine";
import { bind } from "../app/living-dungeon/mind/protocol";
import { envelope } from "../app/living-dungeon/mind/storage";
import { validReply, type MindReply, type MindRequest } from "../app/living-dungeon/mind/ai-contract";

async function main() {
const origin = process.env.MIND_CHECK_ORIGIN ?? "https://delveworn.app";
const out = process.env.MIND_CHECK_OUTPUT ?? "/private/tmp/mind-production-check.json";
const run = transition(createRun(20260920, "mind-production-verification"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
const results: Record<string, unknown>[] = [];
const mechanics: unknown[] = [];
for (const path of ["/living-dungeon", "/practice", "/challenge", "/onchain"]) {
  const response = await fetch(origin + path);
  const body = await response.text();
  results.push({ path, status: response.status, bytes: body.length });
  assert.equal(response.status, 200, path);
  if (path === "/living-dungeon") assert.ok(body.includes("The Mind Beneath"));
}
const cases = [
  { task: "teach" as const, text: "Når en uskyldig er i fare, skal du beskytte dem før meg." },
  { task: "plan" as const, text: "Slukk vaktlykten. Bruk tiendeklokken til å avlede vokteren. Frigjør kartografen uten å skade vokteren." },
  { task: "plan" as const, text: "Extinguish the guard lamp. Use the tithe bell to distract the guard. Release the cartographer without harming the guard." },
];
for (const [index, entry] of cases.entries()) {
  const binding = bind(run, `live-${index}-${Date.now()}`, `generation-${index}`), request: MindRequest = { ...entry, binding, save: envelope(run) };
  const started = Date.now();
  const response = await fetch(origin + "/api/living-dungeon/mind", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(request), signal: AbortSignal.timeout(15000) });
  const reply = await response.json() as MindReply;
  results.push({ task: entry.task, language: index === 2 ? "en" : "nb", status: response.status, source: reply.source, reason: reply.reason, latencyMs: Date.now() - started, usage: reply.usage, line: reply.line, teaching: reply.teaching, operations: reply.plan?.steps.filter(s => s.verb !== "MOVE"), validBinding: validReply(run, reply, binding) });
  await writeFile(out, JSON.stringify(results, null, 2));
  assert.equal(response.status, 200);
  assert.ok(validReply(run, reply, binding));
  assert.ok(reply.source === "ai" || reply.source === "cache", `Real AI unavailable: ${reply.reason}`);
  if (entry.task === "teach") assert.equal(reply.teaching?.principle, "protect");
  else {
    assert.ok(reply.plan?.steps.some(s => s.verb === "RELEASE" && s.target === "captive"));
    let executed = transition(run, { type: "commit", plan: reply.plan! });
    for (let turn = 0; executed.activePlan && turn < 50; turn++) executed = transition(executed, { type: "step" });
    assert.equal(executed.activePlan, null);
    assert.equal(executed.room.solved, true);
    mechanics.push({ room: executed.room, player: executed.player, energy: executed.relic.energy });
  }
}
assert.deepEqual(mechanics[0], mechanics[1], "Equivalent Norwegian and English intentions must have identical mechanical outcomes");
results.push({ equivalentIntents: "identical mechanical outcomes" });
await writeFile(out, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
