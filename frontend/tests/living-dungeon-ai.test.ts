import assert from "node:assert/strict";
import test from "node:test";
import {
  LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS,
  PactIntentRequestError,
  parseInterpretPactIntentRequest,
  type InterpretPactIntentRequest,
} from "../app/living-dungeon/ai-contract";
import {
  interpretPactIntent,
  livingDungeonAiInternals,
} from "../app/living-dungeon/ai-interpreter.server";
import {
  createLivingDungeonAiAuthorizer,
  livingDungeonAiRateLimitInternals,
} from "../app/living-dungeon/ai-rate-limit.server";
import { handleLivingDungeonInterpret } from "../app/api/living-dungeon/interpret/handler.server";
import { MemoryLeaderboardStore } from "../app/leaderboard/store";

const ENABLED_ENV = {
  LIVING_DUNGEON_AI_ENABLED: "true",
  LIVING_DUNGEON_AI_MODEL: "gpt-5.6-terra",
  OPENAI_API_KEY: "test-key",
} as const;

const REQUEST: InterpretPactIntentRequest = {
  proposal: "I will give up Storm if the dungeon shields me from the boss.",
  eligibility: {
    desiredBoons: ["DEFENSE", "DAMAGE"],
    sacrifices: ["NO_STORM", "NO_CAMP_PURCHASE"],
  },
  runRevision: 7,
  stateDigest: "state_12345678",
  offerSeed: 4_294_967_295,
};

function providerResponse(output: unknown): Response {
  return Response.json({
    status: "completed",
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(output) }],
    }],
  });
}

function routeRequest(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("https://delveworn.app/api/living-dungeon/interpret", {
    method: "POST",
    headers: {
      origin: "https://delveworn.app",
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(headers).entries()),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function streamedRouteRequest(chunks: readonly string[], close: boolean): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (close) controller.close();
    },
  });
  return new Request("https://delveworn.app/api/living-dungeon/interpret", {
    method: "POST",
    headers: {
      origin: "https://delveworn.app",
      "content-type": "application/json",
    },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("the request contract normalizes prose and rejects unsupported or excessive input", () => {
  const parsed = parseInterpretPactIntentRequest({
    ...REQUEST,
    proposal: "  protect\n\tme from   the boss  ",
  });
  assert.equal(parsed.proposal, "protect me from the boss");
  assert.throws(
    () => parseInterpretPactIntentRequest({ ...REQUEST, proposal: "x".repeat(LIVING_DUNGEON_PROPOSAL_MAX_CHARACTERS + 1) }),
    PactIntentRequestError,
  );
  assert.throws(
    () => parseInterpretPactIntentRequest({
      ...REQUEST,
      eligibility: { ...REQUEST.eligibility, sacrifices: ["NO_STORM", "NO_STORM"] },
    }),
    /unsupported or duplicate/,
  );
  assert.throws(
    () => parseInterpretPactIntentRequest({ ...REQUEST, overrideRules: true }),
    /invalid shape/,
  );
  assert.throws(
    () => parseInterpretPactIntentRequest({ ...REQUEST, offerSeed: 0x1_0000_0000 }),
    /unsigned 32-bit/,
  );
});

test("the OpenAI request is stateless, tool-free, and constrained to eligible enum values", async () => {
  const providerBody: Record<string, unknown> = {};
  const reply = await interpretPactIntent(REQUEST, {
    env: ENABLED_ENV,
    fetchImpl: async (_input, init) => {
      Object.assign(providerBody, JSON.parse(String(init?.body)) as Record<string, unknown>);
      return providerResponse({
        desiredBoon: "DEFENSE",
        offeredSacrifice: "NO_STORM",
        durationPreference: "UNTIL_BOSS",
        breachTolerance: "MEDIUM",
        needsClarification: false,
      });
    },
  });

  assert.deepEqual(reply, {
    status: "interpreted",
    source: "ai",
    intent: {
      desiredBoon: "DEFENSE",
      offeredSacrifice: "NO_STORM",
      durationPreference: "UNTIL_BOSS",
      breachTolerance: "MEDIUM",
      needsClarification: false,
    },
    binding: { runRevision: 7, stateDigest: "state_12345678", offerSeed: 4_294_967_295 },
  });
  assert.equal(providerBody.store, false);
  assert.equal("tools" in providerBody, false);
  assert.equal(providerBody.model, "gpt-5.6-terra");
  const text = providerBody.text as { format: { strict: boolean; schema: { properties: Record<string, { enum?: string[] }> } } };
  assert.equal(text.format.strict, true);
  assert.deepEqual(text.format.schema.properties.desiredBoon.enum, ["DEFENSE", "DAMAGE"]);
  assert.deepEqual(text.format.schema.properties.offeredSacrifice.enum, ["NO_STORM", "NO_CAMP_PURCHASE"]);
  assert.match(livingDungeonAiInternals.instructions, /untrusted game data/);
  assert.match(livingDungeonAiInternals.instructions, /Norwegian and English equally/);
});

test("disabled or unconfigured AI returns the deterministic menu fallback without calling a provider", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return providerResponse({});
  };
  assert.deepEqual(await interpretPactIntent(REQUEST, {
    env: { LIVING_DUNGEON_AI_ENABLED: "false" },
    fetchImpl,
  }), {
    status: "fallback",
    source: "menu_fallback",
    reason: "disabled",
    binding: { runRevision: 7, stateDigest: "state_12345678", offerSeed: 4_294_967_295 },
  });
  assert.equal((await interpretPactIntent(REQUEST, {
    env: { LIVING_DUNGEON_AI_ENABLED: "true" },
    fetchImpl,
  })).status, "fallback");
  assert.equal(calls, 0);
});

test("provider authorization fails closed before any paid model call", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return providerResponse({});
  };

  for (const [authorization, reason] of [
    ["limited", "rate_limited"],
    ["unavailable", "provider_unavailable"],
  ] as const) {
    const reply = await interpretPactIntent(REQUEST, {
      env: ENABLED_ENV,
      fetchImpl,
      authorizeProviderCall: async () => authorization,
    });
    assert.equal(reply.status, "fallback");
    if (reply.status === "fallback") assert.equal(reply.reason, reason);
  }
  assert.equal(calls, 0);

  const stalledAuthorization = await interpretPactIntent(REQUEST, {
    env: ENABLED_ENV,
    fetchImpl,
    timeoutMs: 5,
    authorizeProviderCall: async () => new Promise<"allowed">(() => undefined),
  });
  assert.equal(stalledAuthorization.status, "fallback");
  if (stalledAuthorization.status === "fallback") assert.equal(stalledAuthorization.reason, "timed_out");
  assert.equal(calls, 0);

  const routeReply = await handleLivingDungeonInterpret(routeRequest(REQUEST), {
    env: ENABLED_ENV,
    fetchImpl,
    authorizeProviderCall: async () => "limited",
  });
  assert.equal(routeReply.status, 200);
  assert.deepEqual(await routeReply.json(), {
    status: "fallback",
    source: "menu_fallback",
    reason: "rate_limited",
    binding: { runRevision: 7, stateDigest: "state_12345678", offerSeed: 4_294_967_295 },
  });
  assert.equal(calls, 0);
});

test("AI rate limits are isolated per address, globally capped, and unavailable without production storage", async () => {
  assert.equal(
    livingDungeonAiRateLimitInternals.namespaceForEnvironment({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    "living_ai_v1_production",
  );
  assert.equal(
    livingDungeonAiRateLimitInternals.namespaceForEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    "living_ai_v1_preview",
  );
  assert.equal(
    livingDungeonAiRateLimitInternals.namespaceForEnvironment({
      NODE_ENV: "production",
      LIVING_DUNGEON_AI_RATE_NAMESPACE: "living_ai_custom",
    }),
    "living_ai_custom",
  );
  assert.equal(
    livingDungeonAiRateLimitInternals.namespaceForEnvironment({
      NODE_ENV: "production",
      LIVING_DUNGEON_AI_RATE_NAMESPACE: "invalid namespace",
    }),
    null,
  );
  const perAddress = createLivingDungeonAiAuthorizer(
    { NODE_ENV: "test" },
    {
      store: new MemoryLeaderboardStore(),
      secret: "a".repeat(32),
      addressLimit: 2,
      globalLimit: 20,
    },
  );
  const firstAddress = routeRequest(REQUEST, { "x-vercel-forwarded-for": "203.0.113.1" });
  const secondAddress = routeRequest(REQUEST, { "x-vercel-forwarded-for": "203.0.113.2" });
  assert.equal(await perAddress(firstAddress), "allowed");
  assert.equal(await perAddress(firstAddress), "allowed");
  assert.equal(await perAddress(firstAddress), "limited");
  assert.equal(await perAddress(secondAddress), "allowed");

  const global = createLivingDungeonAiAuthorizer(
    { NODE_ENV: "test" },
    {
      store: new MemoryLeaderboardStore(),
      secret: "b".repeat(32),
      addressLimit: 20,
      globalLimit: 2,
    },
  );
  assert.equal(await global(firstAddress), "allowed");
  assert.equal(await global(secondAddress), "allowed");
  assert.equal(await global(routeRequest(REQUEST, { "x-vercel-forwarded-for": "203.0.113.3" })), "limited");

  const missingProductionConfig = createLivingDungeonAiAuthorizer({ NODE_ENV: "production" });
  assert.equal(await missingProductionConfig(firstAddress), "unavailable");

  const failedStore = new MemoryLeaderboardStore();
  failedStore.consumeRateLimit = async () => { throw new Error("storage down"); };
  const unavailable = createLivingDungeonAiAuthorizer(
    { NODE_ENV: "production" },
    { store: failedStore, secret: "c".repeat(32) },
  );
  assert.equal(await unavailable(firstAddress), "unavailable");
});

test("timeouts, provider limits, and malformed model output each produce a stable fallback", async () => {
  const timedOut = await interpretPactIntent(REQUEST, {
    env: ENABLED_ENV,
    timeoutMs: 5,
    fetchImpl: async () => new Promise<Response>(() => undefined),
  });
  assert.equal(timedOut.status, "fallback");
  if (timedOut.status === "fallback") assert.equal(timedOut.reason, "timed_out");

  const stalledBody = await interpretPactIntent(REQUEST, {
    env: ENABLED_ENV,
    timeoutMs: 5,
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"status":"completed"'));
      },
    }), { status: 200 }),
  });
  assert.equal(stalledBody.status, "fallback");
  if (stalledBody.status === "fallback") assert.equal(stalledBody.reason, "timed_out");

  const limited = await interpretPactIntent(REQUEST, {
    env: ENABLED_ENV,
    fetchImpl: async () => new Response("limited", { status: 429 }),
  });
  assert.equal(limited.status, "fallback");
  if (limited.status === "fallback") assert.equal(limited.reason, "rate_limited");

  const unauthorized = await interpretPactIntent(REQUEST, {
    env: ENABLED_ENV,
    fetchImpl: async () => providerResponse({
      desiredBoon: "FREE_GOLD",
      offeredSacrifice: "NO_STORM",
      durationPreference: "UNTIL_BOSS",
      breachTolerance: "HIGH",
      needsClarification: false,
    }),
  });
  assert.equal(unauthorized.status, "fallback");
  if (unauthorized.status === "fallback") assert.equal(unauthorized.reason, "invalid_provider_response");

  const extraField = await interpretPactIntent(REQUEST, {
    env: ENABLED_ENV,
    fetchImpl: async () => providerResponse({
      desiredBoon: "DEFENSE",
      offeredSacrifice: "NO_STORM",
      durationPreference: "UNTIL_BOSS",
      breachTolerance: "LOW",
      needsClarification: false,
      reward: 9_999,
    }),
  });
  assert.equal(extraField.status, "fallback");
  if (extraField.status === "fallback") assert.equal(extraField.reason, "invalid_provider_response");
});

test("the route enforces same-origin JSON and never echoes raw player prose", async () => {
  const fallback = await handleLivingDungeonInterpret(routeRequest(REQUEST), {
    env: { LIVING_DUNGEON_AI_ENABLED: "false" },
  });
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get("cache-control"), "no-store");
  const fallbackText = await fallback.text();
  assert.doesNotMatch(fallbackText, /give up Storm/);
  assert.match(fallbackText, /menu_fallback/);

  const crossOrigin = await handleLivingDungeonInterpret(routeRequest(REQUEST, {
    origin: "https://attacker.example",
  }));
  assert.equal(crossOrigin.status, 403);

  const wrongType = await handleLivingDungeonInterpret(routeRequest(REQUEST, {
    "content-type": "text/plain",
  }));
  assert.equal(wrongType.status, 415);

  const malformed = await handleLivingDungeonInterpret(routeRequest("{"));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "malformed_json");

  const oversized = await handleLivingDungeonInterpret(routeRequest({
    ...REQUEST,
    proposal: "x".repeat(5_000),
  }));
  assert.equal(oversized.status, 413);

  const chunkedOversized = await handleLivingDungeonInterpret(
    streamedRouteRequest(["x".repeat(3_000), "x".repeat(3_000)], true),
  );
  assert.equal(chunkedOversized.status, 413);

  const neverFinished = await handleLivingDungeonInterpret(
    streamedRouteRequest(["{"], false),
    { requestBodyTimeoutMs: 5 },
  );
  assert.equal(neverFinished.status, 408);
  assert.equal((await neverFinished.json()).code, "request_timeout");
});
