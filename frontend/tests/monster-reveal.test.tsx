import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MONSTER_REVEAL_DURATION_MS, MonsterReveal, isMonsterRevealVisible, monsterRevealReducer, scheduleMonsterRevealDismiss, shouldAutoRevealMonster, shouldScheduleMonsterRevealDismiss, type MonsterRevealProps } from "../app/descent/monster-reveal";

const base: MonsterRevealProps = {
  enemy: 0,
  name: "Grave Belle",
  role: "Zombie",
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
  assert.match(markup, /Continue fight/);
  assert.match(markup, /aria-valuenow="30"/);
});

test("reloads after a combat action stay collapsed but keep an optional health-linked view", () => {
  assert.equal(shouldAutoRevealMonster("combat", 1, 24), false);
  const markup = renderToStaticMarkup(createElement(MonsterReveal, { ...base, hp: 24, roomTurns: 1, cueId: 3 }));
  assert.doesNotMatch(markup, /Continue fight/);
  assert.match(markup, /View monster/);
  assert.match(markup, /Grave Belle · 24 \/ 30 HP/);
  assert.match(markup, /aria-label="View Grave Belle monster close-up, 24 of 30 health"/);
});

test("the first combat action dismisses an automatic or manually reopened close-up", () => {
  assert.equal(isMonsterRevealVisible({ phase: "combat", roomTurns: 0, hp: 30, cueId: 2, dismissedAt: null, manualAt: null }), true);
  const reopened = monsterRevealReducer({ dismissedAt: 2, manualAt: null, artReady: true }, { type: "view", cueId: 2 });
  assert.equal(isMonsterRevealVisible({ phase: "combat", roomTurns: 1, hp: 24, cueId: 2, ...reopened }), true, "manual view stays open before the action revision arrives");
  assert.equal(isMonsterRevealVisible({ phase: "combat", roomTurns: 1, hp: 24, cueId: 3, ...reopened }), false, "the action revision dismisses it without waiting for its timer");
  assert.equal(renderToStaticMarkup(createElement(MonsterReveal, { ...base, pending: true })), "", "the initiating action hides it before save or animation timers finish");
});

test("close and automatic timeout share the nonblocking dismiss behavior", () => {
  const dismissed = monsterRevealReducer({ dismissedAt: null, manualAt: 4, artReady: true }, { type: "dismiss", cueId: 4 });
  assert.deepEqual(dismissed, { dismissedAt: 4, manualAt: null, artReady: true });
  assert.equal(isMonsterRevealVisible({ phase: "combat", roomTurns: 0, hp: 30, cueId: 4, ...dismissed }), false);
  const markup = renderToStaticMarkup(createElement(MonsterReveal, base));
  assert.doesNotMatch(markup, /aria-modal|role="dialog"|disabled/);
});

test("the automatic timer dismisses after two seconds and cleans up on an early action", () => {
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
  const loading = { dismissedAt: null, manualAt: null, artReady: false };
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
