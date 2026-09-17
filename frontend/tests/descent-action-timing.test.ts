import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_CUE_DURATION_MS, NON_COMBAT_COOLDOWN_MS, TOUCH_COMBAT_COOLDOWN_MS, descentActionCooldown } from "../app/descent/action-timing";

test("First Descent releases confirmed desktop combat immediately", () => {
  assert.equal(descentActionCooldown(true,false),0);
  assert.equal(COMBAT_CUE_DURATION_MS,280,"the visual confirmation remains independent of the input lock");
});

test("touch combat keeps its tap guard and non-combat timing stays unchanged", () => {
  assert.equal(descentActionCooldown(true,true),TOUCH_COMBAT_COOLDOWN_MS);
  assert.equal(descentActionCooldown(false,false),NON_COMBAT_COOLDOWN_MS);
  assert.equal(descentActionCooldown(false,true),NON_COMBAT_COOLDOWN_MS);
});
