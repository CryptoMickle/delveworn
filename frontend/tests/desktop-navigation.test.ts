import assert from "node:assert/strict";
import test from "node:test";
import { spatialTarget, type NavigationRect } from "../app/desktop-navigation";

const rect = (left: number, top: number, width = 100, height = 60): NavigationRect => ({
  left, right: left + width, top, bottom: top + height,
});

test("horizontal arrows move by geometry rather than DOM order", () => {
  const center = rect(110, 0);
  const candidates = [{ item: "right", rect: rect(220, 0) }, { item: "left", rect: rect(0, 0) }];
  assert.equal(spatialTarget(center, candidates, "ArrowLeft", null).item, "left");
  assert.equal(spatialTarget(center, candidates, "ArrowRight", null).item, "right");
});

test("vertical arrows visit the full-width potion row and return to the previous attack column", () => {
  const storm = rect(0, 0), attack = rect(110, 0), potion = rect(0, 70, 210, 44);
  const down = spatialTarget(attack, [
    { item: "storm", rect: storm }, { item: "potion", rect: potion },
    { item: "farther-narrow-action", rect: rect(110, 140) },
  ], "ArrowDown", null);
  assert.equal(down.item, "potion");
  assert.equal(down.preferredX, 160);
  const up = spatialTarget(potion, [{ item: "storm", rect: storm }, { item: "attack", rect: attack }], "ArrowUp", down.preferredX);
  assert.equal(up.item, "attack");
});

test("an aligned shop control wins over a closer diagonal control", () => {
  const current = rect(0, 0);
  const result = spatialTarget(current, [
    { item: "diagonal", rect: rect(120, 65) },
    { item: "same-column", rect: rect(0, 150) },
  ], "ArrowDown", null);
  assert.equal(result.item, "same-column");
});

test("a nearest enabled row can be selected after callers filter a disabled control", () => {
  const result = spatialTarget(rect(0, 0), [
    { item: "later", rect: rect(0, 210) },
    { item: "next-enabled", rect: rect(0, 140) },
  ], "ArrowDown", null);
  assert.equal(result.item, "next-enabled");
});

test("directional boundaries preserve focus without wrapping to an unrelated action", () => {
  const candidates = [{ item: "behind", rect: rect(0, 0) }];
  assert.equal(spatialTarget(rect(110, 0), candidates, "ArrowRight", null).item, null);
  assert.equal(spatialTarget(rect(0, 0), [], "ArrowDown", null).item, null);
});

test("moving horizontally clears the previous vertical lane", () => {
  const result = spatialTarget(rect(0, 0), [{ item: "right", rect: rect(110, 0) }], "ArrowRight", 50);
  assert.equal(result.item, "right");
  assert.equal(result.preferredX, null);
});
