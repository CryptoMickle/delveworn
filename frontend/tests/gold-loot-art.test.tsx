import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GOLD_LOOT_THRESHOLDS, GoldLootSprite, goldLootTier } from "../app/dungeon/gold-loot-art";

test("gold rewards map to three stable stack silhouettes", () => {
  assert.equal(goldLootTier(0), null);
  assert.equal(goldLootTier(1), "small");
  assert.equal(goldLootTier(GOLD_LOOT_THRESHOLDS.medium - 1), "small");
  assert.equal(goldLootTier(GOLD_LOOT_THRESHOLDS.medium), "medium");
  assert.equal(goldLootTier(GOLD_LOOT_THRESHOLDS.large - 1), "medium");
  assert.equal(goldLootTier(GOLD_LOOT_THRESHOLDS.large), "large");
  assert.equal(goldLootTier(Number.NaN), null);
});

test("each tier renders horizontal coin bands and the Delveworn face on every stack top", () => {
  for (const [amount, tier, stacks, bands] of [
    [9, "small", 1, 3],
    [10, "medium", 2, 9],
    [25, "large", 3, 19],
  ] as const) {
    const markup = renderToStaticMarkup(createElement("svg", null, createElement(GoldLootSprite, { amount })));
    assert.match(markup, new RegExp(`data-gold-tier="${tier}"`));
    assert.match(markup, new RegExp(`data-coin-stacks="${stacks}"`));
    assert.match(markup, new RegExp(`data-visible-coins="${bands}"`));
    assert.equal((markup.match(/delveworn-gold-coin\.webp/g) ?? []).length, stacks);
    assert.ok((markup.match(/<ellipse/g) ?? []).length >= stacks * 3, "elliptical faces and rims preserve the horizontal perspective");
  }
});

test("empty rewards do not render a floor sprite", () => {
  assert.equal(renderToStaticMarkup(createElement("svg", null, createElement(GoldLootSprite, { amount: 0 }))), "<svg></svg>");
});
