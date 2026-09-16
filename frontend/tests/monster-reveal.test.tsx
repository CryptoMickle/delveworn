import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MONSTER_REVEAL_DURATION_MS, MonsterReveal, isMonsterRevealVisible, monsterRevealReducer, scheduleMonsterRevealDismiss, shouldAutoRevealMonster, shouldScheduleMonsterRevealDismiss, type MonsterRevealProps } from "../app/descent/monster-reveal";
import { MonsterFieldNotes, RoomParchments } from "../app/dungeon/room-parchments";

const base: MonsterRevealProps = {
  enemy: 0,
  name: "Grave Belle",
  role: "Zombie",
  description: "She wants brains, compliments, and preferably both.",
  hp: 30,
  maxHp: 30,
  phase: "combat",
  roomTurns: 0,
  cueId: 2,
  pending: false,
};

test("a fresh combat briefly shows the detailed original monster illustration", () => {
  assert.equal(MONSTER_REVEAL_DURATION_MS, 2_000);
  assert.equal(shouldAutoRevealMonster("combat", 0, 30), true);
  const markup = renderToStaticMarkup(createElement(MonsterReveal, base));
  assert.match(markup, /Grave Belle monster close-up/);
  assert.match(markup, /src="\/monsters\/zombie-1-grave-belle\.webp"/);
  assert.doesNotMatch(markup, /\/_next\/image/);
  assert.match(markup, /Close artwork/);
  assert.match(markup, /aria-valuenow="30"/);
  assert.match(markup, /aria-label="Monster field notes"/);
  assert.match(markup, /Field notes · Zombie/);
  assert.match(markup, /<h2>Grave Belle<\/h2>/);
  assert.match(markup, /She wants brains, compliments, and preferably both\./);
});

test("expanded artwork and the floor parchment share the same field-note title and description", () => {
  const monster={name:base.name,role:base.role,description:base.description};
  const floorNotes=renderToStaticMarkup(createElement(MonsterFieldNotes,{monster}));
  const artwork=renderToStaticMarkup(createElement(MonsterReveal,base));
  for(const copy of ["Field notes · Zombie","Grave Belle","She wants brains, compliments, and preferably both."]) {
    assert.ok(floorNotes.includes(copy),`floor notes include ${copy}`);
    assert.ok(artwork.includes(copy),`expanded artwork includes ${copy}`);
  }
});

test("floor notes and expanded artwork expose separate responsive surfaces", () => {
  const monster={name:base.name,role:base.role,description:base.description};
  const floor=renderToStaticMarkup(createElement(RoomParchments,{
    monster,
    speech:{name:base.name,monsterType:0,room:1,phase:"loot",cue:null,cueId:0,roomTurns:0,hp:0,maxHp:30,damage:0},
  }));
  const artwork=renderToStaticMarkup(createElement(MonsterReveal,base));
  assert.match(floor,/room-parchment-monster/);
  assert.match(artwork,/descent-monster-reveal-notes/);
  assert.doesNotMatch(artwork,/room-parchment-monster/);
  assert.match(artwork,/She wants brains, compliments, and preferably both\./);
});

test("reloads after a combat action stay collapsed but keep an optional health-linked view", () => {
  assert.equal(shouldAutoRevealMonster("combat", 1, 24), false);
  const markup = renderToStaticMarkup(createElement(MonsterReveal, { ...base, hp: 24, roomTurns: 1, cueId: 3 }));
  assert.doesNotMatch(markup, /Close artwork/);
  assert.match(markup, /View monster/);
  assert.match(markup, /Grave Belle · 24 \/ 30 HP/);
  assert.match(markup, /aria-label="View Grave Belle monster close-up, 24 of 30 health"/);
  assert.match(markup, /descent-monster-reveal-mobile-icon/);
});

test("combat actions and even a killing hit do not shorten the timed illustration", () => {
  const shown = { automatic: true, manual: false, artReady: true };
  assert.equal(isMonsterRevealVisible("combat", 30, shown), true);
  assert.equal(isMonsterRevealVisible("combat", 14, shown), true);
  assert.equal(isMonsterRevealVisible("loot", 0, shown), true, "the same timer finishes after a killing hit");
  const pending = renderToStaticMarkup(createElement(MonsterReveal, { ...base, pending: true }));
  assert.match(pending, /Close artwork/, "starting an action must leave the art visible");
  const reopened = monsterRevealReducer({ automatic: false, manual: false, artReady: true }, { type: "view" });
  assert.equal(isMonsterRevealVisible("combat", 14, reopened), true);
  assert.equal(isMonsterRevealVisible("loot", 0, reopened), false, "manual views end when the fight ends");
});

test("close and automatic timeout share the nonblocking dismiss behavior", () => {
  const dismissed = monsterRevealReducer({ automatic: true, manual: false, artReady: true }, { type: "dismiss" });
  assert.deepEqual(dismissed, { automatic: false, manual: false, artReady: true });
  assert.equal(isMonsterRevealVisible("combat", 30, dismissed), false);
  const markup = renderToStaticMarkup(createElement(MonsterReveal, base));
  assert.doesNotMatch(markup, /aria-modal|role="dialog"|disabled/);
});

test("the automatic timer dismisses after two seconds and cleans up when closed or unmounted", () => {
  let scheduled: (() => void) | undefined;
  let delay = 0;
  let cleared: number | undefined;
  let dismissals = 0;
  const cleanup = scheduleMonsterRevealDismiss(() => { dismissals++; }, {
    setTimeout(callback, ms) { scheduled = callback; delay = ms; return 17; },
    clearTimeout(timer) { cleared = timer; },
  });
  assert.equal(delay, 2_000);
  assert.equal(dismissals, 0);
  scheduled?.();
  assert.equal(dismissals, 1);
  cleanup();
  assert.equal(cleared, 17);
});

test("the automatic timer waits until the original art loads or errors", () => {
  const loading = { automatic: true, manual: false, artReady: false };
  assert.equal(shouldScheduleMonsterRevealDismiss(true, false, loading.artReady), false);
  const loaded = monsterRevealReducer(loading, { type: "art-ready" });
  assert.equal(shouldScheduleMonsterRevealDismiss(true, false, loaded.artReady), true);
  assert.equal(shouldScheduleMonsterRevealDismiss(true, true, loaded.artReady), false, "a manually reopened view stays pinned");
});

test("the reveal renders nothing outside a live fight", () => {
  for (const props of [
    { ...base, phase: "explore" as const },
    { ...base, phase: "loot" as const, hp: 0 },
  ]) {
    assert.equal(renderToStaticMarkup(createElement(MonsterReveal, props)), "");
  }
});
