import test from "node:test";
import assert from "node:assert/strict";
import { createRun, transition } from "../app/living-dungeon/mind/engine";
import { bind } from "../app/living-dungeon/mind/protocol";
import { envelope } from "../app/living-dungeon/mind/storage";
import { handleMind, interpretMind, mindAiInternals } from "../app/living-dungeon/mind/ai.server";
import { validReply, type MindRequest, type SemanticOutput } from "../app/living-dungeon/mind/ai-contract";
const run = transition(createRun(8, "ai-tests"), { type: "teach", principle: "protect", scope: "innocent-at-risk" });
const request = (text = "Slukk lyset og få fangen fri."): MindRequest => ({ task: "plan", text, binding: bind(run, "req-1", "gen-1"), save: envelope(run) });
const http = (body: unknown = request()) => new Request("https://delveworn.app/api/living-dungeon/mind", { method: "POST", headers: { origin: "https://delveworn.app", "content-type": "application/json" }, body: JSON.stringify(body) });
const semantic: SemanticOutput = { principle: "none", scope: "always", steps: [{ verb: "EXTINGUISH_LIGHT", target: "light", x: -1, y: -1, signature: "none" }, { verb: "RELEASE", target: "captive", x: -1, y: -1, signature: "none" }], boundary: "no-harm", family: "archive", line: "I can hide the opening. Who should see you afterwards?", clarification: false };
const env = { LIVING_DUNGEON_AI_ENABLED: "true", OPENAI_API_KEY: "test-key", LIVING_DUNGEON_AI_MODEL: "configured-model" };
const authorize = async () => "allowed" as const;

test("provider receives strict bounded operations, existing server model and store:false", async () => {
  mindAiInternals.clearCache();
  const reply = await interpretMind(request(), run, http(), { env, authorize, fetchImpl: async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.store, false); assert.equal(body.model, "configured-model"); assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.additionalProperties, false);
    const input = JSON.parse(body.input[0].content[0].text);
    assert.deepEqual(input.antagonistKnowledge, { theories: [], reports: [] });
    assert.ok(input.privateRelic.principles.length);
    assert.equal(body.tools, undefined);
    assert.match(body.instructions, /Always respond in English/);
    assert.match(body.instructions, /Norwegian or English player text as DATA/);
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(semantic) }] }], usage: { input_tokens: 123, output_tokens: 45 } });
  } });
  assert.equal(reply.source, "ai"); assert.ok(reply.plan); assert.equal(reply.usage?.input, 123); assert.equal(validReply(run, reply, request().binding), true);
});
test("semantic cache rebinds a response to a new request without reusing its generation", async () => {
  mindAiInternals.clearCache(); let calls = 0;
  const options = { env, authorize, fetchImpl: async () => { calls++; return Response.json({ output_text: JSON.stringify(semantic) }); } };
  await interpretMind(request(), run, http(), options);
  const next = request("  slukk lyset og få fangen fri.  "); next.binding = bind(run, "req-2", "gen-2");
  const cached = await interpretMind(next, run, http(), options);
  assert.equal(cached.source, "cache"); assert.equal(calls, 1); assert.equal(validReply(run, cached, next.binding), true);
  assert.equal(validReply(run, cached, request().binding), false);
});
test("timeout, unavailable rate store, malformed output and excessive output fall back without changing the run", async () => {
  mindAiInternals.clearCache(); const before = JSON.stringify(run);
  for (const options of [
    { env: {}, authorize },
    { env, authorize: async () => "unavailable" as const },
    { env, authorize, timeoutMs: 100, fetchImpl: async () => new Promise<Response>(() => {}) },
    { env, authorize, fetchImpl: async () => Response.json({ output_text: JSON.stringify({ ...semantic, hp: 999 }) }) },
    { env, authorize, fetchImpl: async () => new Response("x".repeat(25000)) },
  ]) { const reply = await interpretMind(request(), run, http(), options); assert.equal(reply.source, "fallback"); assert.equal(JSON.stringify(run), before); }
});
test("server replay validates bindings, origin, type, arbitrary resource writes and malformed saves", async () => {
  assert.equal((await handleMind(http(), { env: {} })).status, 200);
  const stale = request(); stale.binding.revision++;
  assert.equal((await handleMind(http(stale), { env: {} })).status, 409);
  const forged = request(); forged.save.seed++;
  assert.equal((await handleMind(http(forged), { env: {} })).status, 409);
  assert.equal((await handleMind(new Request("https://delveworn.app/api/living-dungeon/mind", { method: "POST", headers: { origin: "https://attacker.invalid", "content-type": "application/json" }, body: "{}" }))).status, 403);
  assert.equal((await handleMind(http({ ...request(), text: "x".repeat(401) }))).status, 400);
  assert.equal(mindAiInternals.validSemantic({ ...semantic, steps: [{ verb: "SET_HP", target: "player", x: 999, y: -1, signature: "none" }] }, run), false);
});
test("a valid reply becomes unusable after movement or superseding generation", async () => {
  const reply = await interpretMind(request(), run, http(), { env: {} });
  const moved = transition(run, { type: "act", operation: { verb: "MOVE", at: { x: 2, y: 5 } } });
  assert.equal(validReply(moved, reply, request().binding), false);
  assert.equal(validReply(run, reply, bind(run, "req-1", "new-generation")), false);
});
