import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MONSTER_SPEECH_LIFETIME_MS, MonsterSpeech, monsterSpeech, type MonsterSpeechContext } from "../app/dungeon/monster-speech";
import { RoomParchments } from "../app/dungeon/room-parchments";

const context: MonsterSpeechContext = {
  name: "Miss Morgue", monsterType: 0, room: 12, phase: "combat", cue: null, cueId: 4,
  roomTurns: 0, hp: 37, maxHp: 51, damage: 0,
};

test("monster speech is deterministic, direct persona dialogue selected from combat context", () => {
  assert.deepEqual(monsterSpeech(context), { line: "Compliments first. Brains second.", stage: "opening" });
  const stormMiss = { ...context, cue: "storm", roomTurns: 2, damage: 0 } as const;
  assert.deepEqual(monsterSpeech(stormMiss), monsterSpeech(stormMiss));
  assert.equal(monsterSpeech(stormMiss)?.stage, "miss");
  assert.match(monsterSpeech(stormMiss)!.line, /weather|thunder/i);
  assert.equal(monsterSpeech({ ...context, phase: "recovery" }), null);
  assert.equal(MONSTER_SPEECH_LIFETIME_MS, 4200);
});

test("a confirmed killing blow gets the monster's own last line instead of dungeon narration", () => {
  const defeated = { ...context, phase: "loot", cue: "critical", cueId: 5, roomTurns: 3, hp: 0, damage: 37 } as const;
  assert.deepEqual(monsterSpeech(defeated), { line: "Keep the compliment, then.", stage: "defeat" });
  const markup = renderToStaticMarkup(<MonsterSpeech {...defeated} />);
  assert.match(markup, /aria-label="Miss Morgue says"/);
  assert.match(markup, /data-speech-stage="defeat"/);
  assert.match(markup, /<cite>Miss Morgue<\/cite>/);
  assert.match(markup, /“Keep the compliment, then\.”/);
  assert.doesNotMatch(markup, /Dungeon remarks|damage|HP|gold|potion/i);
});

test("the shared room overlay keeps monster field notes and replaces dungeon remarks", () => {
  const markup = renderToStaticMarkup(<RoomParchments
    monster={{ name: "Miss Morgue", role: "Zombie", description: "She wants brains, compliments, and preferably both." }}
    speech={context}
  />);
  assert.match(markup, /aria-label="Monster field notes"/);
  assert.match(markup, /Field notes · Zombie/);
  assert.match(markup, /She wants brains, compliments, and preferably both\./);
  assert.match(markup, /aria-label="Miss Morgue says"/);
  assert.doesNotMatch(markup, /Dungeon remarks|room-parchment-humor/);
});
