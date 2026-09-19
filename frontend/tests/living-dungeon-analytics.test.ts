import assert from "node:assert/strict";
import test from "node:test";
import {
  LIVING_DUNGEON_ANALYTICS_VERSION,
  createLivingDungeonAnalytics,
  livingDungeonAnalyticsPayload,
  type LivingDungeonAnalyticsEvent,
  type LivingDungeonAnalyticsPayload,
} from "../app/living-dungeon/analytics";

test("Living Dungeon analytics emits the documented event name and closed property schema", () => {
  const calls: Array<{ event: string; properties: LivingDungeonAnalyticsPayload }> = [];
  const analytics = createLivingDungeonAnalytics((event, properties) => {
    calls.push({ event, properties });
  });

  analytics("living_run_started", { entry_point: "home", variant: "ai", returning: false });
  analytics("conversation_opened", { room: "pact-room", opened_by: "automatic" });
  analytics("suggestion_used", { room: "pact-room", suggestion_id: "protection" });
  analytics("interpretation_returned", { source: "ai", input_method: "free_text", result: "offer", attempt: 1, latency: "1_to_2_5s" });
  analytics("clarification_requested", { reason: "ambiguous", attempt: 1 });
  analytics("rule_accepted", { input_method: "suggestion", boon_id: "BOSS_OPENING_WARD", restriction_id: "NO_STORM" });
  analytics("rule_revised", { input_method: "free_text", revision_number: 1 });
  analytics("rule_rejected", { input_method: "custom_menu", reason: "player_choice" });
  analytics("fallback_used", { reason: "timed_out", destination: "ready_made" });
  analytics("promise_kept", { restriction_id: "NO_STORM" });
  analytics("promise_broken", { restriction_id: "NO_VOLUNTARY_HEALING", action: "potion" });
  analytics("boss_clue_seen", { preparation_id: "ANTI_STORM_WARD", source: "witness" });
  analytics("living_run_completed", { outcome: "victory", pact_outcome: "kept", variant: "ai", used_ai_interpretation: true });
  analytics("living_run_abandoned", { room: "camp", pact_outcome: "broken" });
  analytics("living_retry_started", { previous_outcome: "defeat" });

  assert.deepEqual(calls.map((call) => call.event), [
    "living_run_started",
    "conversation_opened",
    "suggestion_used",
    "interpretation_returned",
    "clarification_requested",
    "rule_accepted",
    "rule_revised",
    "rule_rejected",
    "fallback_used",
    "promise_kept",
    "promise_broken",
    "boss_clue_seen",
    "living_run_completed",
    "living_run_abandoned",
    "living_retry_started",
  ] satisfies LivingDungeonAnalyticsEvent[]);
  assert.deepEqual(calls[5], {
    event: "rule_accepted",
    properties: {
      analytics_version: LIVING_DUNGEON_ANALYTICS_VERSION,
      input_method: "suggestion",
      boon_id: "BOSS_OPENING_WARD",
      restriction_id: "NO_STORM",
    },
  });
  assert.deepEqual(calls[3].properties, {
    analytics_version: LIVING_DUNGEON_ANALYTICS_VERSION,
    source: "ai",
    input_method: "free_text",
    result: "offer",
    attempt: 1,
    latency: "1_to_2_5s",
  });
  assert.deepEqual(calls[12].properties, {
    analytics_version: LIVING_DUNGEON_ANALYTICS_VERSION,
    outcome: "victory",
    pact_outcome: "kept",
    variant: "ai",
    used_ai_interpretation: true,
  });
});

test("Living Dungeon analytics strips unknown, identifying and free-text properties at runtime", () => {
  const unsafe = {
    room: "pact-room",
    suggestion_id: "damage",
    prompt: "My private proposal",
    generated_dialogue: "A model response",
    wallet: "0x1234",
    ip: "127.0.0.1",
    save_data: "serialized run",
    runId: "private-run-id",
  };

  const payload = livingDungeonAnalyticsPayload("suggestion_used", unsafe as never);
  assert.deepEqual(payload, {
    analytics_version: LIVING_DUNGEON_ANALYTICS_VERSION,
    room: "pact-room",
    suggestion_id: "damage",
  });
  for (const forbidden of ["prompt", "generated_dialogue", "wallet", "ip", "save_data", "runId"]) {
    assert.equal(Object.hasOwn(payload, forbidden), false);
  }
});

test("Living Dungeon analytics failures never throw or block gameplay", async () => {
  const synchronousFailure = createLivingDungeonAnalytics(() => {
    throw new Error("analytics unavailable");
  });
  assert.doesNotThrow(() => synchronousFailure("living_retry_started", { previous_outcome: "defeat" }));

  let rejectionHandled = false;
  const asynchronousFailure = createLivingDungeonAnalytics(() => Promise.reject(new Error("network unavailable")).finally(() => {
    rejectionHandled = true;
  }));
  assert.doesNotThrow(() => asynchronousFailure("living_retry_started", { previous_outcome: "abandoned" }));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  assert.equal(rejectionHandled, true);
});
