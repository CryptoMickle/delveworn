import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EquippedRelicStatus } from "../app/dungeon/equipped-relic-status";
import { RelicCollection } from "../app/game-ui";
import { getRelicDefinition } from "../app/relics";

test("an active relic exposes its name and equipped state without changing the loadout", () => {
  let opened = 0;
  const control = EquippedRelicStatus({ equippedRelic: 15, ownedRelicCount: 1, onOpen: () => { opened++; } });
  assert.ok(control);
  const markup = renderToStaticMarkup(control);
  assert.ok(markup.includes(`Equipped relic: ${getRelicDefinition(15).name}. Open relic collection`));
  assert.match(markup, /Legendary · Equipped/);
  assert.equal(opened, 0);
  control.props.onClick();
  assert.equal(opened, 1);
});

test("a collected but unequipped relic is never presented as active", () => {
  const markup = renderToStaticMarkup(<EquippedRelicStatus equippedRelic={0} ownedRelicCount={1} onOpen={() => {}} />);
  assert.match(markup, /No relic equipped. 1 collected. Open relic collection/);
  assert.match(markup, /None equipped/);
  assert.doesNotMatch(markup, /Legendary · Equipped/);
  assert.equal(EquippedRelicStatus({ equippedRelic: 0, ownedRelicCount: 0, onOpen() {} }), null);
});

test("inspecting an equipped relic during combat keeps all equipment changes locked", () => {
  const counts = Array(16).fill(0);
  counts[15] = 1;
  const markup = renderToStaticMarkup(<RelicCollection idPrefix="combat-test" ownedRelics={[15]}
    relicCounts={counts} equippedRelic={15} canChangeRelic={false} onSelectRelic={() => {}} />);
  assert.ok(markup.includes(getRelicDefinition(15).name));
  const buttons = markup.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every(button => button.includes('disabled=""')));
  assert.equal(buttons.filter(button => button.includes('aria-pressed="true"')).length, 1);
});
