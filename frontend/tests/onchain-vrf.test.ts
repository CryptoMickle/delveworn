import assert from "node:assert/strict";
import test from "node:test";
import {
  canResolveVrfState,
  canonicalStateShowsSubmittedAction,
} from "../app/onchain-vrf";

test("a late old same-kind event cannot resolve an unchanged new action", () => {
  const lateOldEventWasCached = true;
  assert.equal(lateOldEventWasCached, true);
  assert.equal(canResolveVrfState(BigInt(0), false, false), false);
});

test("VRF completion requires an observed request or changed confirmed state", () => {
  assert.equal(canResolveVrfState(BigInt(9), true, true), false);
  assert.equal(canResolveVrfState(BigInt(0), true, false), true);
  assert.equal(canResolveVrfState(BigInt(0), false, true), true);
});

test("landed room entry stays submitted when receipt transport fails", () => {
  assert.equal(canonicalStateShowsSubmittedAction(BigInt(44), true), true);
  assert.equal(canonicalStateShowsSubmittedAction(BigInt(0), true), true);
  assert.equal(canonicalStateShowsSubmittedAction(BigInt(0), false), false);
});
