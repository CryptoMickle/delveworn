import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  lethalRetaliationIsPossible,
  potionResultingHpRange,
} from "../app/combat-consequences";
import { DescentCombatPanel } from "../app/descent/combat-panel";
import { createDescent, transition } from "../app/descent/model";
import { CombatActionDock } from "../app/game-ui";

test("potion outcomes add healing before the max HP cap and use modified incoming damage", () => {
  assert.deepEqual(potionResultingHpRange({ hp: 95, maxHp: 100, incoming: [4, 6] }), [100, 100]);
  assert.deepEqual(potionResultingHpRange({ hp: 50, maxHp: 100, incoming: [5, 7] }), [71, 72]);
  assert.deepEqual(potionResultingHpRange({ hp: 1, maxHp: 60, incoming: [50, 54] }), [0, 1]);
});

test("lethal reply risk requires both lethal incoming damage and a possible surviving enemy", () => {
  const base = { hp: 6, enemyHp: 9, incoming: [4, 6] as const };
  assert.equal(lethalRetaliationIsPossible({ ...base, actionDamage: [8, 12] }), true);
  assert.equal(lethalRetaliationIsPossible({ ...base, enemyHp: 8, actionDamage: [8, 12] }), false);
  assert.equal(lethalRetaliationIsPossible({ ...base, hp: 7, actionDamage: [8, 12] }), false);
});

test("the descent panel includes relic-modified incoming damage in the potion outcome", () => {
  const engaged = transition(createDescent(41, "worldbreaker-preview"), "engage");
  const run = { ...engaged, game: { ...engaged.game, hp: 50, equippedRelic: 15 } };
  const markup = renderToStaticMarkup(<DescentCombatPanel run={run} busy={false} onAction={() => {}} />);
  assert.match(markup, /HP AFTER POTION 71–72 · half retaliation/);
});

test("the shared action dock shows resulting HP and suppresses false lethal warnings on a guaranteed kill", () => {
  const markup = renderToStaticMarkup(
    <CombatActionDock
      busy={false}
      hp={6}
      maxHp={100}
      enemyHp={8}
      enemyMaxHp={30}
      retaliation="4–6"
      stormDamage="0–20"
      attackDamage="8–12"
      criticalChance={15}
      potionLabel="POTION"
      potionDetail="old estimate"
      potionUsage="0/2 used"
      potionDisabled={false}
      onStorm={() => {}}
      onPotion={() => {}}
      onAttack={() => {}}
    />,
  );

  assert.match(markup, /HP AFTER POTION 28–29 · half retaliation/);
  assert.equal((markup.match(/LETHAL REPLY POSSIBLE/g) ?? []).length, 1);
  const attackMarkup = markup.slice(markup.indexOf("practice-attack-action"), markup.indexOf("practice-potion-action"));
  assert.doesNotMatch(attackMarkup, /LETHAL REPLY POSSIBLE/);
});
