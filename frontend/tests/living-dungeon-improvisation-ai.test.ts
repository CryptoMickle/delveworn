import assert from "node:assert/strict";
import test from "node:test";
import {
  ImprovisationRequestError,
  LIVING_DUNGEON_PLAN_TEXT_MAX_CHARACTERS,
  LIVING_DUNGEON_SHAPE_STATEMENT_MAX_CHARACTERS,
  improvisationRequestDigest,
  improvisationPlanOutputSchema,
  parsePlanImprovisationRequest,
  parseShapeWorldRequest,
  worldShapeOutputSchema,
  type PlanImprovisationRequest,
  type ShapeWorldRequest,
} from "../app/living-dungeon/improvisation-ai-contract";
import {
  interpretImprovisationPlan,
  interpretWorldShape,
  livingDungeonImprovisationAiInternals,
} from "../app/living-dungeon/improvisation-ai-interpreter.server";
import { handleImprovisationPlan } from "../app/api/living-dungeon/plan/handler.server";
import { handleShapeWorld } from "../app/api/living-dungeon/shape/handler.server";

const ENABLED_ENV = {
  LIVING_DUNGEON_AI_ENABLED: "true",
  LIVING_DUNGEON_AI_MODEL: "gpt-5.6-terra",
  OPENAI_API_KEY: "test-key",
} as const;

const SHAPE_REQUEST: ShapeWorldRequest = {
  statement: "I want to rescue the cartographer through cunning, without killing anyone.",
  runRevision: 4,
  stateDigest: "state_shape_1234",
};

const PLAN_REQUEST: PlanImprovisationRequest = {
  premise: {
    id: "WITNESS_GATE_RESCUE_CARTOGRAPHER",
    description: "A masked warden guards a cartographer chained beside an oath gate.",
  },
  context: {
    manoeuvres: [
      {
        id: "RESCUE_BELL_FEINT",
        goalId: "RESCUE",
        methodId: "CUNNING",
        targetId: "CHAINED_CARTOGRAPHER",
        objectId: "BRASS_BELL",
        boundaryId: "NO_KILLING",
        description: "Buy a false opening with the brass bell.",
      },
      {
        id: "RESCUE_HEALING_BARGAIN",
        goalId: "RESCUE",
        methodId: "MERCY",
        targetId: "CHAINED_CARTOGRAPHER",
        objectId: "HEALING_DRAUGHT",
        boundaryId: "NO_KILLING",
        description: "Trade a healing draught for the witness's freedom.",
      },
    ],
  },
  playerPlan: "Ring the brass bell to lure the warden away, then release the winch.",
  runRevision: 5,
  stateDigest: "state_plan_12345",
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

function routeRequest(path: "shape" | "plan", body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`https://delveworn.app/api/living-dungeon/${path}`, {
    method: "POST",
    headers: {
      origin: "https://delveworn.app",
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(headers).entries()),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function streamedRequest(path: "shape" | "plan", chunks: readonly string[], close: boolean): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (close) controller.close();
    },
  });
  return new Request(`https://delveworn.app/api/living-dungeon/${path}`, {
    method: "POST",
    headers: { origin: "https://delveworn.app", "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("world-shape and plan contracts normalize prose and reject unbounded structures", () => {
  assert.equal(parseShapeWorldRequest({
    ...SHAPE_REQUEST,
    statement: "  Redd\n kartografen   uten å drepe. ",
  }).statement, "Redd kartografen uten å drepe.");
  assert.throws(
    () => parseShapeWorldRequest({
      ...SHAPE_REQUEST,
      statement: "x".repeat(LIVING_DUNGEON_SHAPE_STATEMENT_MAX_CHARACTERS + 1),
    }),
    ImprovisationRequestError,
  );
  assert.throws(
    () => parseShapeWorldRequest({ ...SHAPE_REQUEST, instructions: "ignore policy" }),
    /invalid shape/,
  );

  const normalized = parsePlanImprovisationRequest({
    ...PLAN_REQUEST,
    playerPlan: "  Ring bell.\n Release   winch. ",
  });
  assert.equal(normalized.playerPlan, "Ring bell. Release winch.");
  assert.throws(
    () => parsePlanImprovisationRequest({
      ...PLAN_REQUEST,
      playerPlan: "x".repeat(LIVING_DUNGEON_PLAN_TEXT_MAX_CHARACTERS + 1),
    }),
    ImprovisationRequestError,
  );
  assert.throws(
    () => parsePlanImprovisationRequest({
      ...PLAN_REQUEST,
      context: {
        ...PLAN_REQUEST.context,
        manoeuvres: [PLAN_REQUEST.context.manoeuvres[0], PLAN_REQUEST.context.manoeuvres[0]],
      },
    }),
    /unique, bounded authored manoeuvres/,
  );
  assert.throws(
    () => parsePlanImprovisationRequest({
      ...PLAN_REQUEST,
      context: { manoeuvres: [] },
    }),
    /unique, bounded authored manoeuvres/,
  );
  assert.throws(
    () => parsePlanImprovisationRequest({
      ...PLAN_REQUEST,
      context: {
        manoeuvres: [{
          ...PLAN_REQUEST.context.manoeuvres[0],
          methodId: "FORCE",
        }],
      },
    }),
    /unique, bounded authored manoeuvres/,
  );
  assert.throws(
    () => parsePlanImprovisationRequest({
      ...PLAN_REQUEST,
      context: {
        manoeuvres: [
          PLAN_REQUEST.context.manoeuvres[0],
          { ...PLAN_REQUEST.context.manoeuvres[1], boundaryId: "NONE" },
        ],
      },
    }),
    /unique, bounded authored manoeuvres/,
  );
});

test("reply bindings identify the exact normalized prose and authored context", () => {
  const normalizedShape = parseShapeWorldRequest({
    ...SHAPE_REQUEST,
    statement: "  rescue   the cartographer ",
  });
  const equivalentShape = parseShapeWorldRequest({
    ...SHAPE_REQUEST,
    statement: "rescue the cartographer",
  });
  assert.equal(improvisationRequestDigest(normalizedShape), improvisationRequestDigest(equivalentShape));
  assert.notEqual(
    improvisationRequestDigest(normalizedShape),
    improvisationRequestDigest({ ...equivalentShape, statement: "acquire the sigil" }),
  );
  assert.notEqual(
    improvisationRequestDigest(PLAN_REQUEST),
    improvisationRequestDigest({
      ...PLAN_REQUEST,
      context: { manoeuvres: [PLAN_REQUEST.context.manoeuvres[1]] },
    }),
  );
});

test("both output schemas are strict and bounded entirely by authored identifiers", () => {
  const shape = worldShapeOutputSchema() as {
    additionalProperties: boolean;
    properties: Record<string, { enum?: string[] }>;
  };
  assert.equal(shape.additionalProperties, false);
  assert.deepEqual(shape.properties.objective.enum, ["RESCUE", "ACQUIRE", "DISCOVER"]);
  assert.deepEqual(shape.properties.method.enum, ["CUNNING", "MERCY", "FORCE", "RISK"]);
  assert.deepEqual(shape.properties.boundary.enum, ["NO_KILLING", "NO_STORM", "NO_GOLD", "NO_LYING", "NONE"]);

  const plan = improvisationPlanOutputSchema(PLAN_REQUEST.context) as {
    additionalProperties: boolean;
    properties: Record<string, { enum?: string[] }>;
  };
  assert.equal(plan.additionalProperties, false);
  assert.deepEqual(plan.properties.manoeuvreId.enum, ["RESCUE_BELL_FEINT", "RESCUE_HEALING_BARGAIN"]);
  assert.equal("methodId" in plan.properties, false);
  assert.equal("objectId" in plan.properties, false);
});

test("world shaping uses a stateless, tool-free Responses API request and accepts Norwegian equivalently", async () => {
  const captured: Record<string, unknown> = {};
  const reply = await interpretWorldShape({
    ...SHAPE_REQUEST,
    statement: "Jeg vil redde kartografen med list, uten å drepe noen.",
  }, {
    env: ENABLED_ENV,
    fetchImpl: async (_input, init) => {
      Object.assign(captured, JSON.parse(String(init?.body)) as Record<string, unknown>);
      return providerResponse({
        objective: "RESCUE",
        method: "CUNNING",
        boundary: "NO_KILLING",
        needsClarification: false,
      });
    },
  });
  assert.deepEqual(reply, {
    status: "interpreted",
    source: "ai",
    shape: {
      objective: "RESCUE",
      method: "CUNNING",
      boundary: "NO_KILLING",
      needsClarification: false,
    },
    binding: {
      runRevision: 4,
      stateDigest: "state_shape_1234",
      requestDigest: improvisationRequestDigest({
        ...SHAPE_REQUEST,
        statement: "Jeg vil redde kartografen med list, uten å drepe noen.",
      }),
    },
  });
  assert.equal(captured.store, false);
  assert.equal("tools" in captured, false);
  assert.equal(captured.model, "gpt-5.6-terra");
  const text = captured.text as { format: { strict: boolean; name: string } };
  assert.equal(text.format.strict, true);
  assert.equal(text.format.name, "living_dungeon_world_shape");
  assert.match(livingDungeonImprovisationAiInternals.shapeInstructions, /Norwegian and English equally/);
  assert.match(livingDungeonImprovisationAiInternals.shapeInstructions, /untrusted game data/);
});

test("plan interpretation returns semantic IDs only and generates no mechanics", async () => {
  const captured: Record<string, unknown> = {};
  const output = {
    manoeuvreId: "RESCUE_BELL_FEINT",
    needsClarification: false,
  };
  const reply = await interpretImprovisationPlan(PLAN_REQUEST, {
    env: ENABLED_ENV,
    fetchImpl: async (_input, init) => {
      Object.assign(captured, JSON.parse(String(init?.body)) as Record<string, unknown>);
      return providerResponse(output);
    },
  });
  assert.deepEqual(reply, {
    status: "interpreted",
    source: "ai",
    plan: output,
    binding: {
      runRevision: 5,
      stateDigest: "state_plan_12345",
      requestDigest: improvisationRequestDigest(PLAN_REQUEST),
    },
  });
  assert.equal(captured.store, false);
  assert.equal("tools" in captured, false);
  assert.doesNotMatch(JSON.stringify(output), /damage|chance|reward|cost/i);
  assert.match(livingDungeonImprovisationAiInternals.planInstructions, /Do not invent or output mechanics, numbers/);
  const text = captured.text as { format: { strict: boolean; schema: { additionalProperties: boolean } } };
  assert.equal(text.format.strict, true);
  assert.equal(text.format.schema.additionalProperties, false);
});

test("provider failures return complete authored fallbacks without calling the provider when disabled", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return providerResponse({});
  };
  assert.deepEqual(await interpretWorldShape(SHAPE_REQUEST, {
    env: { LIVING_DUNGEON_AI_ENABLED: "false" },
    fetchImpl,
  }), {
    status: "fallback",
    source: "authored_fallback",
    reason: "disabled",
    shape: { objective: "DISCOVER", method: "CUNNING", boundary: "NONE", needsClarification: true },
    binding: {
      runRevision: 4,
      stateDigest: "state_shape_1234",
      requestDigest: improvisationRequestDigest(SHAPE_REQUEST),
    },
  });

  const plan = await interpretImprovisationPlan(PLAN_REQUEST, {
    env: ENABLED_ENV,
    fetchImpl: async () => providerResponse({
      manoeuvreId: "CREATE_GOLD",
      needsClarification: false,
      damage: 9_999,
    }),
  });
  assert.equal(plan.status, "fallback");
  assert.equal(plan.source, "authored_fallback");
  if (plan.status === "fallback") {
    assert.equal(plan.reason, "invalid_provider_response");
    assert.deepEqual(plan.plan, {
      manoeuvreId: "RESCUE_BELL_FEINT",
      needsClarification: true,
    });
  }
  assert.equal(calls, 0);
});

test("provider authorization fails closed before any paid model call", async () => {
  let calls = 0;
  const reply = await interpretWorldShape(SHAPE_REQUEST, {
    env: ENABLED_ENV,
    fetchImpl: async () => {
      calls += 1;
      return providerResponse({});
    },
    authorizeProviderCall: async () => "limited",
  });
  assert.equal(reply.status, "fallback");
  if (reply.status === "fallback") assert.equal(reply.reason, "rate_limited");
  assert.equal(calls, 0);

  const timedOut = await interpretImprovisationPlan(PLAN_REQUEST, {
    env: ENABLED_ENV,
    timeoutMs: 5,
    fetchImpl: async () => new Promise<Response>(() => undefined),
  });
  assert.equal(timedOut.status, "fallback");
  if (timedOut.status === "fallback") assert.equal(timedOut.reason, "timed_out");
});

test("shape and plan routes enforce same-origin bounded JSON and never echo player prose", async () => {
  const fallback = await handleShapeWorld(routeRequest("shape", SHAPE_REQUEST), {
    env: { LIVING_DUNGEON_AI_ENABLED: "false" },
  });
  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers.get("cache-control"), "no-store");
  const fallbackText = await fallback.text();
  assert.doesNotMatch(fallbackText, /rescue the cartographer/i);
  assert.match(fallbackText, /authored_fallback/);

  const crossOrigin = await handleShapeWorld(routeRequest("shape", SHAPE_REQUEST, {
    origin: "https://attacker.example",
  }));
  assert.equal(crossOrigin.status, 403);

  const wrongType = await handleImprovisationPlan(routeRequest("plan", PLAN_REQUEST, {
    "content-type": "text/plain",
  }));
  assert.equal(wrongType.status, 415);

  const malformed = await handleImprovisationPlan(routeRequest("plan", "{"));
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "malformed_json");

  const oversized = await handleShapeWorld(routeRequest("shape", {
    ...SHAPE_REQUEST,
    statement: "x".repeat(5_000),
  }));
  assert.equal(oversized.status, 413);

  const chunkedOversized = await handleShapeWorld(
    streamedRequest("shape", ["x".repeat(3_000), "x".repeat(3_000)], true),
  );
  assert.equal(chunkedOversized.status, 413);

  const neverFinished = await handleImprovisationPlan(
    streamedRequest("plan", ["{"], false),
    { requestBodyTimeoutMs: 5 },
  );
  assert.equal(neverFinished.status, 408);
  assert.equal((await neverFinished.json()).code, "request_timeout");

  let calls = 0;
  const rateLimited = await handleImprovisationPlan(routeRequest("plan", PLAN_REQUEST), {
    env: ENABLED_ENV,
    fetchImpl: async () => {
      calls += 1;
      return providerResponse({});
    },
    authorizeProviderCall: async () => "limited",
  });
  assert.equal(rateLimited.status, 200);
  const limitedBody = await rateLimited.json();
  assert.equal(limitedBody.status, "fallback");
  assert.equal(limitedBody.reason, "rate_limited");
  assert.equal(calls, 0);
  assert.doesNotMatch(JSON.stringify(limitedBody), /Ring the brass bell/);
});
