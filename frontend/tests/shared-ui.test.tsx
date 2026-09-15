import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CombatActionDock, DungeonBattle, DungeonEntry, GameHud, RoomProgressLine } from "../app/game-ui";

test("the boss room remains cleared through its reward instead of selecting the next tier", () => {
  const battle = renderToStaticMarkup(<RoomProgressLine room={10} roomsCleared={9} isBoss phase="Combat" />);
  const reward = renderToStaticMarkup(<RoomProgressLine room={10} roomsCleared={10} phase="Boss defeated · relic reward" />);
  assert.equal((battle.match(/aria-current="step"/g) ?? []).length, 1);
  assert.match(battle, /aria-current="step" aria-label="Boss room 10, current"/);
  assert.doesNotMatch(reward, /aria-current="step"/);
  assert.match(reward, /aria-label="Boss room 10, cleared"/);
  assert.equal((reward.match(/<li /g) ?? []).length, 10);
  assert.equal((reward.match(/aria-label="(?:Boss room|Room) \d+, cleared"/g) ?? []).length, 10);
  assert.match(reward, /Boss defeated · relic reward/);

  const next = renderToStaticMarkup(<RoomProgressLine room={11} roomsCleared={10} />);
  assert.match(next, /aria-label="Room 11, current"/);
  assert.match(next, /aria-label="Boss room 20"/);
  assert.doesNotMatch(next, /aria-label="(?:Boss room|Room) \d+, cleared"/);
});

test("health, supplies and equipment stay present after combat potion tracking ends", () => {
  const props = { hp: 17, maxHp: 100, potions: 2, maxPotions: 5, gold: 83, weaponLevel: 3, weaponBonus: 6, armorLevel: 2, armorAbsorption: 2, armorReductionPercent: 50, room: 9 };
  const combat = renderToStaticMarkup(<GameHud {...props} combatPotions={{ used: 1, limit: 2 }} />);
  const camp = renderToStaticMarkup(<GameHud {...props} />);
  for (const markup of [combat, camp]) {
    assert.match(markup, /aria-label="Player status and equipment"/);
    assert.match(markup, /aria-label="Player health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="17"/);
    assert.match(markup, /17\/100/);
    assert.match(markup, /POTIONS/);
    assert.match(markup, /2\/5/);
    assert.match(markup, /GOLD/);
    assert.match(markup, />83</);
    assert.match(markup, /WEAPON/);
    assert.match(markup, /Lv 3 · \+6 damage/);
    assert.match(markup, /ARMOR/);
    assert.match(markup, /Lv 2 · blocks up to 2/);
    assert.equal((markup.match(/class="practice-combat-potion-status /g) ?? []).length, 1);
  }
  assert.match(combat, /Combat potions: 1\/2 used/);
  assert.match(camp, /Supplies &amp; equipment/);
});

const actionProps = {
  busy: false,
  stormDamage: "0–40",
  attackDamage: "8–14",
  criticalChance: 15,
  potionLabel: "POTION · 2/5",
  potionDetail: "Heal 25 HP · half retaliation",
  potionUsage: "0/2 used",
  potionDisabled: false,
  onStorm() {},
  onPotion() {},
  onAttack() {},
};

test("the dock shows current health beside potion consequences and disables every action while pending", () => {
  const markup = renderToStaticMarkup(<CombatActionDock {...actionProps} hp={17} maxHp={100} retaliation="5–9" />);
  assert.match(markup, /YOUR HP/);
  assert.match(markup, /data-health="danger">17\/100/);
  assert.match(markup, /Enemy reply/);
  assert.match(markup, /heal, then take half retaliation/);
  assert.ok(markup.indexOf("practice-storm-action") < markup.indexOf("practice-attack-action"));
  assert.ok(markup.indexOf("practice-attack-action") < markup.indexOf("practice-potion-action"));
  assert.match(markup, /aria-label="⚡ STORM S · DAMAGE 0–40 · unpredictable, no critical"/);
  assert.match(markup, /aria-label="⚔️ ATTACK A · DAMAGE 8–14 · reliable, 15% critical"/);
  const pending = renderToStaticMarkup(<CombatActionDock {...actionProps} busy hp={17} maxHp={100} />);
  assert.equal((pending.match(/disabled=""/g) ?? []).length, 3);
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /Resolving action/);
  const withoutOptionalHealth = renderToStaticMarkup(<CombatActionDock {...actionProps} keyboardEnabled={false} />);
  assert.match(withoutOptionalHealth, /YOUR TURN/);
  assert.doesNotMatch(withoutOptionalHealth, /undefined|NaN|aria-keyshortcuts|<kbd>/);
});

test("battle keeps confirmed enemy status, artwork, log and supplied actions in one shared encounter", () => {
  const markup = renderToStaticMarkup(<DungeonBattle
    enemy={{ name: "Grave Belle", image: "/assets/zombie.webp", hp: 17, maxHp: 30, incoming: "3–6", flavor: "A terrible day for brains.", isBoss: false }}
    log={["Attack dealt 8 damage."]}
    actions={<CombatActionDock {...actionProps} hp={60} maxHp={100} enemyHp={17} enemyMaxHp={30} lastExchange={{ dealt: 8, taken: 3, critical: false }} />}
  />);
  assert.match(markup, /aria-label="Dungeon battle" data-keyboard-action-scope="true"/);
  assert.match(markup, /aria-label="Enemy health" aria-valuemin="0" aria-valuemax="30" aria-valuenow="17"/);
  assert.ok(markup.indexOf("practice-monster-heading") < markup.indexOf("delveworn-battle-art"));
  assert.ok(markup.indexOf("delveworn-battle-art") < markup.indexOf("delveworn-battle-log"));
  assert.match(markup, /aria-label="Open dungeon log"/);
  assert.match(markup, /<dialog[^>]*aria-label="Dungeon log"/);
  assert.match(markup, /ENEMY HP <strong>17\/30<\/strong>/);
  assert.match(markup, /TOOK <b>3 HP<\/b>/);
  assert.match(markup, /DEALT <b>8 HP<\/b>/);
});

test("disabled potion controls explain full health, missing stock and encounter limits", () => {
  const full = renderToStaticMarkup(<CombatActionDock {...actionProps} potionDisabled hp={100} maxHp={100} />);
  assert.match(full, /HP is full/);
  const empty = renderToStaticMarkup(<CombatActionDock {...actionProps} potionDisabled potionDisabledReason="No potions left" />);
  assert.match(empty, /No potions left/);
  const limit = renderToStaticMarkup(<CombatActionDock {...actionProps} potionDisabled potionLimitReached />);
  assert.match(limit, /Combat limit reached/);
});

test("entry keeps the trust boundary visible while technical proof details are optional", () => {
  const practice = renderToStaticMarkup(<DungeonEntry mode="practice" eyebrow="PRACTICE" description="Learn the dungeon"><button>Start</button></DungeonEntry>);
  const onchain = renderToStaticMarkup(<DungeonEntry mode="onchain" eyebrow="ONCHAIN" description="Verifiable run" proofFooter={<a href="https://example.com/contract">View contract</a>}><button>Connect wallet</button></DungeonEntry>);
  for (const markup of [practice, onchain]) {
    assert.match(markup, /<details class="practice-mode-proof/);
    assert.doesNotMatch(markup, /<details[^>]*\sopen(?:=|>)/);
  }
  assert.match(practice, /<summary[^>]*>[\s\S]*Local simulation · saved in this browser[\s\S]*No wallet · no onchain value[\s\S]*<\/summary>/);
  assert.match(onchain, /<summary[^>]*>[\s\S]*Contract state · verifiable randomness[\s\S]*Wallet authorization · live testnet[\s\S]*<\/summary>/);
  assert.ok(onchain.indexOf("View contract") > onchain.indexOf("</details>"));
});
