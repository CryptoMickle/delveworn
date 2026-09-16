import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MONSTER_SPEECH_LIFETIME_MS, MonsterSpeech, createMonsterSpeechRotation, createMonsterSpeechSession, monsterSpeech, type MonsterSpeechContext } from "../app/dungeon/monster-speech";
import { FAMILY_REACTIONS, MONSTER_OPENINGS, type SpeechStage } from "../app/dungeon/monster-dialogue";
import { getEnemyArt } from "../app/dungeon/scene";
import { RoomParchments } from "../app/dungeon/room-parchments";

const context: MonsterSpeechContext = {
  name: "Miss Morgue", monsterType: 0, room: 12, phase: "combat", cue: null, cueId: 4,
  roomTurns: 0, hp: 37, maxHp: 51, damage: 0,
};

test("monster speech is deterministic, direct persona dialogue selected from combat context", () => {
  assert.deepEqual(monsterSpeech(context), monsterSpeech(context));
  assert.equal(monsterSpeech(context)?.stage,"opening");
  assert.ok(MONSTER_OPENINGS["miss morgue"].includes(monsterSpeech(context)!.line));
  const stormMiss = { ...context, cue: "storm", roomTurns: 2, damage: 0 } as const;
  assert.deepEqual(monsterSpeech(stormMiss), monsterSpeech(stormMiss));
  assert.equal(monsterSpeech(stormMiss)?.stage, "miss");
  assert.ok(FAMILY_REACTIONS[0].miss.includes(monsterSpeech(stormMiss)!.line));
  assert.equal(monsterSpeech({ ...context, phase: "recovery" }), null);
  assert.equal(MONSTER_SPEECH_LIFETIME_MS, 4200);
});

test("every named monster has multiple concise original lines without duplicate punchlines", () => {
  const lines=[...Object.values(MONSTER_OPENINGS).flat(),...FAMILY_REACTIONS.flatMap(family => Object.values(family).flat())];
  assert.ok(lines.length >= 250,"a substantial expanded spoken catalogue");
  assert.equal(new Set(lines).size,lines.length,"different pools cannot repeat the same line");
  assert.ok(lines.every(line => line.length <= 80 && line.trim() === line && line.length > 0),"phone bubbles keep short complete lines");
  for (const type of [0,1,2,3] as const) for (const room of [1,11,21,31]) {
    const name=getEnemyArt(type,room).name.toLowerCase().replace(/^the\s+/,"");
    assert.ok(MONSTER_OPENINGS[name]?.length >= 4,name+" has a personal opening deck");
  }
});

function forStage(stage: SpeechStage, monsterType: MonsterSpeechContext["monsterType"]): MonsterSpeechContext {
  return {...context,name:"Unknown opponent",monsterType,cue:stage === "opening" ? null
    : stage === "hit" || stage === "wounded" ? "attack" : stage === "miss" ? "storm" : stage,
    roomTurns:stage === "opening" ? 0 : 1,hp:stage === "wounded" ? 3 : 40,maxHp:50,damage:stage === "miss" ? 0 : 10};
}

test("all reaction decks exhaust before repeating, even when turn and cue counters advance together", () => {
  for(const monsterType of [0,1,2,3] as const) for(const stage of Object.keys(FAMILY_REACTIONS[monsterType]) as SpeechStage[]) {
    const rotation=createMonsterSpeechRotation(), pool=FAMILY_REACTIONS[monsterType][stage];
    const seen:string[]=[];
    for(let n=0;n<pool.length*3;n++) {
      const base=forStage(stage,monsterType);
      const speech=rotation.pick({...base,room:stage === "opening" ? n+1 : 12,cueId:n+1,roomTurns:stage === "opening" ? 0 : n+1})!;
      assert.equal(speech.stage,stage);
      assert.ok(pool.includes(speech.line));
      assert.notEqual(speech.line,seen.at(-1),"no immediate repetition at a deck boundary");
      seen.push(speech.line);
    }
    for(let cycle=0;cycle<3;cycle++) assert.equal(new Set(seen.slice(cycle*pool.length,(cycle+1)*pool.length)).size,pool.length);
  }
});

test("persona greetings rotate across rooms and new component sessions in the same visit", () => {
  const rotation=createMonsterSpeechRotation(), lines:string[]=[];
  for(let n=0;n<8;n++) {
    const session=createMonsterSpeechSession(rotation);
    session.observe({...context,room:n+1});
    const line=session.getSnapshot()!.line;
    assert.notEqual(line,lines.at(-1));
    lines.push(line);
  }
  assert.equal(new Set(lines.slice(0,4)).size,4);
  assert.equal(new Set(lines.slice(4)).size,4);
});

test("cue cleanup and repeated confirmed-state renders keep the same utterance and timer identity", () => {
  const session=createMonsterSpeechSession();
  let updates=0;
  const unsubscribe=session.subscribe(() => updates++);
  session.observe(context);
  const opening=session.getSnapshot();
  session.observe({...context});
  assert.strictEqual(session.getSnapshot(),opening);
  const hit={...context,cue:"attack",cueId:5,roomTurns:1,hp:30,damage:7} as const;
  session.observe(hit);
  assert.strictEqual(session.getSnapshot(),opening,"a quick reaction waits for the full opening line");
  session.advance(opening!.id);
  const reaction=session.getSnapshot();
  assert.equal(reaction?.stage,"hit");
  assert.notEqual(reaction?.id,opening?.id);
  session.observe({...hit,cue:null});
  session.observe({...hit,hp:29});
  assert.strictEqual(session.getSnapshot(),reaction,"a cleared visual cue never returns to the greeting");
  assert.equal(updates,2,"only the opening and confirmed action publish");
  session.observe({...hit,hp:0,phase:"loot"});
  assert.equal(session.getSnapshot(),null);
  assert.equal(updates,3);
  unsubscribe();
  assert.equal(monsterSpeech({...hit,cue:null}),null,"restoring a mid-fight save must not restart its greeting");
});

test("SSR and unused initial sessions never consume browser dialogue history", () => {
  const rotation=createMonsterSpeechRotation(), untouched=createMonsterSpeechRotation();
  for(let n=0;n<10;n++) {
    const session=createMonsterSpeechSession(rotation);
    assert.equal(session.getServerSnapshot(),null);
    assert.equal(session.getSnapshot(),null);
    assert.equal(renderToStaticMarkup(<MonsterSpeech {...context} />),"");
  }
  assert.deepEqual(rotation.pick(context),untouched.pick(context));
});

test("each fight has at most one opening and one reaction without spending suppressed deck lines", () => {
  const rotation=createMonsterSpeechRotation(), untouched=createMonsterSpeechRotation();
  const session=createMonsterSpeechSession(rotation);
  let updates=0;
  session.subscribe(() => updates++);
  session.observe(context);
  const opening=session.getSnapshot();
  untouched.pick(context);
  const hit={...context,cue:"attack",cueId:5,roomTurns:1,hp:30,damage:7} as const;
  session.observe(hit);
  untouched.pick(hit);
  assert.strictEqual(session.getSnapshot(),opening,"the opening remains while the reaction queues");
  session.advance(session.getSnapshot()!.id);
  const reaction=session.getSnapshot();
  for (const [index,stage] of (["hit","storm","miss","critical","potion","revive","wounded"] as SpeechStage[]).entries()) {
    const action={...forStage(stage,0),name:context.name,cueId:6+index,roomTurns:2+index};
    session.observe(action);
    session.observe({...action,cue:null});
    assert.strictEqual(session.getSnapshot(),reaction,"later turns cannot replace the second line");
  }
  assert.equal(updates,2);
  // A later fight can speak again, and unused reactions are still available.
  const nextFight=createMonsterSpeechSession(rotation);
  const nextOpening={...context,room:13,cueId:20};
  nextFight.observe(nextOpening);
  assert.equal(nextFight.getSnapshot()?.line,untouched.pick(nextOpening)?.line);
  const nextHit={...hit,room:13,cueId:21};
  nextFight.observe(nextHit);
  nextFight.advance(nextFight.getSnapshot()!.id);
  assert.equal(nextFight.getSnapshot()?.line,untouched.pick(nextHit)?.line);
  for(const stage of ["storm","miss","critical","potion","revive","wounded"] as SpeechStage[]) {
    assert.deepEqual(rotation.pick(forStage(stage,0)),untouched.pick(forStage(stage,0)));
  }
  session.observe({...hit,phase:"loot",hp:0});
  assert.equal(session.getSnapshot(),null,"the cap never prevents death cleanup");
});

test("a queued reaction expires after its own full reading time and death cancels it", () => {
  const session=createMonsterSpeechSession();
  session.observe(context);
  const opening=session.getSnapshot()!;
  session.observe({...context,cue:"attack",cueId:5,roomTurns:1,hp:30,damage:7});
  session.advance(opening.id);
  const reaction=session.getSnapshot()!;
  assert.equal(reaction.stage,"hit");
  session.advance(reaction.id);
  assert.equal(session.getSnapshot(),null);

  const defeated=createMonsterSpeechSession();
  defeated.observe(context);
  const defeatedOpening=defeated.getSnapshot()!;
  defeated.observe({...context,cue:"attack",cueId:5,roomTurns:1,hp:30,damage:7});
  defeated.observe({...context,phase:"loot",hp:0});
  defeated.advance(defeatedOpening.id);
  assert.equal(defeated.getSnapshot(),null,"postcombat cannot publish a queued line");
});

test("killing blows and postcombat stay silent", () => {
  const defeatedPhases = ["combat", "loot", "recovery", "reward", "won", "lost"] as const;
  const killingCues = ["attack", "storm", "critical"] as const;
  for (const phase of defeatedPhases) {
    for (const cue of killingCues) {
      const defeated = { ...context, phase, cue, cueId: 5, roomTurns: 3, hp: 0, damage: 37 } as const;
      assert.equal(monsterSpeech(defeated), null, `${cue} killing blow must stay silent in ${phase}`);
      assert.equal(renderToStaticMarkup(<MonsterSpeech {...defeated} />), "");
    }
  }
});

test("the shared room overlay keeps monster field notes and replaces dungeon remarks", () => {
  const markup = renderToStaticMarkup(<RoomParchments
    monster={{ name: "Miss Morgue", role: "Zombie", description: "She wants brains, compliments, and preferably both." }}
    speech={context}
  />);
  assert.match(markup, /aria-label="Monster field notes"/);
  assert.match(markup, /Field notes · Zombie/);
  assert.match(markup, /She wants brains, compliments, and preferably both\./);
  assert.doesNotMatch(markup, /monster-speech/,"speech waits for the committed browser deck draw");
  assert.doesNotMatch(markup, /Dungeon remarks|room-parchment-humor/);
});
