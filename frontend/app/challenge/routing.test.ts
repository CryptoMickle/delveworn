import assert from "node:assert/strict";
import test from "node:test";
import { currentWeeklyChallengeHref, parseChallengeRoute, parsePlayRoute } from "./routing";

test("challenge routes keep unversioned links on V1 and select V2 explicitly", () => {
  assert.deepEqual(parseChallengeRoute({ r: "proof", ref: "run" }), {
    version: 1,
    resultProof: "proof",
    referral: "run",
  });
  assert.deepEqual(parseChallengeRoute({ v: "2", r: "proof", ref: "run" }), {
    version: 2,
    resultProof: "proof",
    referral: "run",
  });
  assert.equal(currentWeeklyChallengeHref(new Date("2026-09-17T12:00:00.000Z")), "/challenge/2026-W38?v=2");
});

test("unsupported or repeated routing and proof values fail closed", () => {
  assert.equal(parseChallengeRoute({ v: "1" }), null);
  assert.equal(parseChallengeRoute({ v: "3" }), null);
  assert.equal(parseChallengeRoute({ v: ["2", "2"] }), null);
  assert.equal(parseChallengeRoute({ v: "2", r: "" }), null);
  assert.equal(parseChallengeRoute({ v: "2", r: ["first", "second"] }), null);
  assert.equal(parseChallengeRoute({ v: "2", ref: ["first", "second"] }), null);
});

test("the old First Descent only opens through its exact compatibility query", () => {
  assert.equal(parsePlayRoute(undefined), "weekly");
  assert.equal(parsePlayRoute("1"), "legacy");
  assert.equal(parsePlayRoute("0"), null);
  assert.equal(parsePlayRoute(["1", "1"]), null);
});
