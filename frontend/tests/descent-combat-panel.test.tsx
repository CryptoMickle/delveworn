import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DescentCombatPanel, DescentEnemyStatus } from "../app/descent/combat-panel";
import { createDescent, transition, type Descent } from "../app/descent/model";

function combatRun(
  game: Partial<Descent["game"]> = {},
  roomTurns = 0,
): Descent {
  const run = transition(createDescent(123, "combat-panel"), "engage");
  assert.notEqual(run, null);
  return { ...run, roomTurns, game: { ...run.game, ...game } };
}

function renderPanel(run: Descent, busy = false) {
  return renderToStaticMarkup(
    <DescentCombatPanel run={run} busy={busy} onAction={() => {}} />,
  );
}

test("enemy status keeps exact current and maximum HP visible through defeat", () => {
  const alive = renderToStaticMarkup(
    <DescentEnemyStatus
      name="Grave Belle"
      hp={17}
      maxHp={30}
      incoming="4–6"
      isBoss={false}
    />,
  );
  assert.match(alive, /ENEMY · Grave Belle/);
  assert.match(alive, /HP <b>17\/30<\/b>/);
  assert.match(
    alive,
    /aria-label="Enemy health" aria-valuemin="0" aria-valuemax="30" aria-valuenow="17"/,
  );
  assert.match(alive, /RETALIATION <strong>4–6 DAMAGE<\/strong> IF IT SURVIVES/);

  const defeated = renderToStaticMarkup(
    <DescentEnemyStatus
      name="The Dungeon Lord"
      hp={0}
      maxHp={122}
      incoming="12–18"
      isBoss
    />,
  );
  assert.match(defeated, /data-boss="true"/);
  assert.match(defeated, /BOSS · The Dungeon Lord/);
  assert.match(defeated, /HP <b>0\/122<\/b>/);
  assert.match(
    defeated,
    /aria-label="Enemy health" aria-valuemin="0" aria-valuemax="122" aria-valuenow="0"/,
  );
  assert.match(defeated, /style="width:0%"/);
});

test("combat panel retains shared Practice vitals, engine ranges, and action order", () => {
  const markup = renderPanel(combatRun({ hp: 61, monsterHp: 17, monsterMaxHp: 30 }));

  assert.match(markup, /class="practice-action-dock practice-combat-dock/);
  assert.match(markup, /YOUR HP <strong data-health="healthy">61\/100<\/strong>/);
  assert.match(markup, /ENEMY HP <strong>17\/30<\/strong>/);
  assert.match(
    markup,
    /aria-label="Player health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="61"/,
  );
  assert.match(markup, /aria-label="⚡ STORM · DAMAGE 0–20 · unpredictable, no critical"/);
  assert.match(markup, /aria-label="⚔️ ATTACK · DAMAGE 8–12 · reliable, 15% critical"/);
  assert.doesNotMatch(markup, /keyboard-shortcut|keyshortcuts|<kbd>[JKM]<\/kbd>/);
  assert.ok(markup.indexOf("practice-storm-action") < markup.indexOf("practice-attack-action"));
  assert.ok(markup.indexOf("practice-attack-action") < markup.indexOf("practice-potion-action"));

  const busy = renderPanel(combatRun({ hp: 61 }), true);
  assert.equal((busy.match(/disabled=""/g) ?? []).length, 3);
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /DAMAGE 0–20/);
  assert.match(busy, /DAMAGE 8–12/);
});

test("potion control exposes stock, encounter limits, and every disabled reason", () => {
  const available = renderPanel(combatRun({ hp: 50, potions: 3, combatPotionsUsed: 0 }));
  assert.match(available, /POTION · 3\/5/);
  assert.match(available, /0\/2<span>used<\/span>/);
  assert.doesNotMatch(available, /HP is full|No potions left|Combat limit reached/);

  const boss = renderPanel(combatRun({
    hp: 50,
    monsterType: 3,
    monsterHp: 122,
    monsterMaxHp: 122,
    potions: 2,
    combatPotionsUsed: 2,
  }));
  assert.match(boss, /POTION · 2\/5/);
  assert.match(boss, /2\/3<span>used<\/span>/);
  assert.equal((boss.match(/disabled=""/g) ?? []).length, 0);

  const full = renderPanel(combatRun({ hp: 100, potions: 2, combatPotionsUsed: 0 }));
  assert.match(full, /HP is full · save it for later/);
  assert.equal((full.match(/disabled=""/g) ?? []).length, 1);

  const empty = renderPanel(combatRun({ hp: 50, potions: 0, combatPotionsUsed: 0 }));
  assert.match(empty, /No potions left · restock at Kevin&#x27;s/);
  assert.equal((empty.match(/disabled=""/g) ?? []).length, 1);

  const limited = renderPanel(combatRun({ hp: 50, potions: 2, combatPotionsUsed: 2 }));
  assert.match(limited, /2\/2<span>used<\/span>/);
  assert.match(limited, /Combat limit reached/);
  assert.equal((limited.match(/disabled=""/g) ?? []).length, 1);
});

test("a resolved zero-damage exchange remains distinct from no exchange", () => {
  const untouched = renderPanel(combatRun());
  assert.match(untouched, /TOOK <b>—<\/b>/);
  assert.match(untouched, /DEALT <b>—<\/b>/);

  const resolved = renderPanel(combatRun({
    lastPlayerDamage: 0,
    lastMonsterDamage: 0,
    lastCritical: false,
  }, 1));
  assert.match(resolved, /TOOK <b>0 HP<\/b>/);
  assert.match(resolved, /DEALT <b>0 HP<\/b>/);
});
