import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeAnalyticsEvent,
  stripAnalyticsUrlDetails,
} from "../app/analytics-url";

test("analytics URLs omit proof, referral, preview, and fragment details", () => {
  assert.equal(
    stripAnalyticsUrlDetails(
      "https://delveworn.app/challenge/2026-W38?v=2&r=proof-token&ref=referral-token&_vercel_share=preview-token#result",
    ),
    "https://delveworn.app/challenge/2026-W38",
  );
});

test("analytics URLs omit practice continuation IDs", () => {
  assert.equal(
    stripAnalyticsUrlDetails(
      "/practice?continue=3f53b084-4b69-4a24-a442-684e011eb9e5",
    ),
    "/practice",
  );
});

test("analytics event sanitizing preserves the event kind", () => {
  assert.deepEqual(
    sanitizeAnalyticsEvent({
      type: "event" as const,
      url: "/challenge/2026-W38?v=2&r=private#result",
    }),
    {
      type: "event",
      url: "/challenge/2026-W38",
    },
  );
});
