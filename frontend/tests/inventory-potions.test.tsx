import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InventoryPotions } from "../app/dungeon/inventory-potions";

test("the inventory exposes safe healing and delegates one use to its existing authority", () => {
  let uses = 0;
  const control = InventoryPotions({ potions: 3, onUse: () => { uses++; } });
  const markup = renderToStaticMarkup(control);
  assert.match(markup, /<button type="button"/);
  assert.match(markup, /Use potion · 3 left · Restore up to 25 HP. No enemy retaliation./);
  assert.match(markup, /Potion \+25 HP/);
  assert.match(markup, /3 \/ 5/);
  control.props.onClick();
  assert.equal(uses, 1);

  const combatInventory = renderToStaticMarkup(<InventoryPotions potions={3} />);
  assert.doesNotMatch(combatInventory, /<button/);
  assert.match(combatInventory, /Potions/);
});

test("empty, full-health and pending inventory controls cannot invoke a potion action", () => {
  let uses = 0;
  for (const state of [
    { potions: 0, disabledReason: null, reason: "No potions available." },
    { potions: 3, disabledReason: "HP is already full.", reason: "HP is already full." },
    { potions: 3, disabledReason: "Finish the current action first.", reason: "Finish the current action first." },
  ]) {
    const control = InventoryPotions({ ...state, onUse: () => { uses++; } });
    const markup = renderToStaticMarkup(control);
    assert.match(markup, /disabled=""/);
    assert.ok(markup.includes(state.reason));
    control.props.onClick();
  }
  assert.equal(uses, 0);
});
