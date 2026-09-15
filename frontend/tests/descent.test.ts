import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { attack, attackRange, claimRelic, enterNextRoom, incomingRange, startRun, stormAttack, usePotion } from "../app/practice/engine";
import { createSeededRandom } from "../app/practice/random";
import { BUILDS, createDescent, enemyIntent, phase, transition, type Descent, type DescentAction } from "../app/descent/model";
import { DESCENT_SAVE_KEY, isDescent, loadDescent, saveDescent } from "../app/descent/storage";

test("classic Practice/Weekly transitions and RNG retain pre-descent golden vectors", () => {
  for (const [seed, digest] of [[12345, "56d74384924ac87430f5d6ec9a63e608b41770534f998ee4f33844080ef851a7"], [123456, "f2c4b638b13bd6c4483352f7420a63ad39d9e8579c42fc9ebb13e870b558d7ea"], [987654, "e4b2971e068a38e318ab83d9757192b3e56890c318b768c0e5a3b34b3ed9f889"]] as const) {
    const rng = createSeededRandom(seed); let g = startRun(rng.nextInt), i = 0;
    while (g.active && g.roomsCleared < 10 && i++ < 200) {
      if (g.relicOfferAvailable) g = claimRelic(g, false);
      else if (g.monsterHp === 0) g = enterNextRoom(g, rng.nextInt);
      else if (g.hp < 40 && g.potions > 0 && g.combatPotionsUsed < (g.monsterType === 3 ? 3 : 2)) g = usePotion(g, rng.nextInt);
      else g = i % 5 === 0 ? stormAttack(g, rng.nextInt) : attack(g, rng.nextInt);
    }
    assert.equal(createHash("sha256").update(JSON.stringify({ g, rng: rng.state() })).digest("hex"), digest);
  }
});

test("each intention exposes the rule applied to its next reply", () => {
  assert.deepEqual([0,1,2,3,4,5,6].map(t => enemyIntent(0,t).replyPercent), [100,100,0,150,100,0,150]);
  assert.deepEqual([0,1,2,3].map(t => enemyIntent(1,t).attackPercent), [100,100,75,100]);
  assert.deepEqual([0,1,2,3].map(t => enemyIntent(2,t).replyPercent), [50,150,50,150]);
  assert.deepEqual([0,1,2,3].map(t => enemyIntent(3,t).replyPercent), [100,50,175,100]);
  const game = { ...createDescent("stormcaller", 42, "test").game, monsterHp: 100, monsterMaxHp: 100, armorLevel: 2 };
  const guard = enemyIntent(1,2), windup = enemyIntent(0,2), heavy = enemyIntent(2,1);
  const roll = (max: number) => max === 100 ? 99 : 0;
  assert.equal(attack(game,roll,guard).lastPlayerDamage, 6); // ceil(8*.95)=8; floor(8*.75)=6
  assert.equal(attackRange(game,guard)[0], 6);
  assert.equal(stormAttack(game,max => max === 21 ? 10 : 0,guard).lastPlayerDamage, 13);
  assert.equal(attack(game,roll,windup).lastMonsterDamage, 0);
  assert.deepEqual(incomingRange(game,windup), [0,0]);
  assert.equal(attack(game,roll,heavy).lastMonsterDamage, 4); // floor(4*1.5)-armor2
  assert.deepEqual(incomingRange(game,heavy), [4,7]);
  assert.equal(usePotion({ ...game, hp: 50 }, roll, windup).hp, 75);
  assert.equal(usePotion({ ...game, hp: 50 }, roll, heavy).hp, 73);
});

test("movement/invalid/stale commands never spend a turn or a random draw", () => {
  const run = createDescent("warden",123,"guard");
  for (const action of ["attack","enter","claim","camp-weapon","potion"] as const) assert.equal(transition(run,action),run);
  const engaged = transition(run,"engage");
  assert.equal(engaged.rngState,run.rngState);
  assert.equal(engaged.turns,0);
  const struck = transition(engaged,"attack",engaged.revision);
  assert.equal(transition(struck,"attack",engaged.revision),struck);
  assert.equal(transition(struck,"enter"),struck);
});

export function playPolicy(run: Descent): DescentAction {
  const g = run.game, p = phase(run);
  if (p === "explore") return "engage";
  if (p === "reward") return "claim";
  if (p === "recovery") {
    if (g.roomsCleared === 5 && !g.supplyBandageUsed && g.hp <= g.maxHp - 25 && g.gold >= 20) return "supply-bandage";
    if (g.roomsCleared === 9) {
      if (!g.campRestUsed && g.hp <= g.maxHp - 30 && g.gold >= 25) return "camp-rest";
      if (g.gold >= 60 && g.weaponLevel < 2) return "camp-weapon";
      if (g.gold >= 60 && g.armorLevel < 2) return "camp-armor";
      if (g.gold >= 20 && g.potions < 3 && g.campPotionsBought < 2) return "camp-potion";
    }
    if (g.hp <= g.maxHp - 25 && g.potions > 0) return "potion";
    return "enter";
  }
  const intent = enemyIntent(g.monsterType,run.roomTurns);
  if (g.potions > 0 && g.combatPotionsUsed < (g.monsterType === 3 ? 3 : 2)
    && (g.hp < 35 || (intent.replyPercent === 0 && g.hp <= g.maxHp - 25))) return "potion";
  return run.build === "stormcaller" && intent.attackPercent < 100 ? "storm" : "attack";
}

test("ten-room runs round-trip every combat, supply, camp, reward and terminal state", () => {
  for (const build of BUILDS) {
    let run = createDescent(build.id,12345,"complete-"+build.id), sawCamp = false, sawSupply = false, sawReward = false;
    for (let i=0; i<250 && !["won","lost"].includes(phase(run)); i++) {
      const action = playPolicy(run);
      run = transition(run,action);
      assert.ok(isDescent(run),`invalid ${build.id} ${action} room ${run.game.roomsCleared} phase ${phase(run)}`);
      assert.deepEqual(transition(JSON.parse(JSON.stringify(run)),playPolicy(run)),transition(run,playPolicy(run)));
      sawSupply ||= run.game.roomsCleared === 5; sawCamp ||= run.game.roomsCleared === 9; sawReward ||= phase(run) === "reward";
    }
    assert.equal(phase(run),"won", build.id);
    assert.ok(sawCamp && sawSupply && sawReward);
    assert.equal(run.game.roomsCleared,10);
    assert.equal(transition(run,"enter"),run);
  }
});

test("death restores as death and cannot accept further commands", () => {
  let run = transition(createDescent("warden",7,"death"),"engage");
  run = { ...run, game: { ...run.game,hp: 1 } };
  run = transition(run,"attack");
  assert.equal(phase(run),"lost"); assert.ok(isDescent(run));
  assert.equal(transition(run,"potion"),run);
});

test("storage preserves unknown saves and rejects stale tabs and malformed payloads", () => {
  const map = new Map<string,string>(); const source = () => ({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string,v: string) => { map.set(k,v); } });
  const run = createDescent("duelist",16,"save");
  assert.equal(saveDescent(source,run,null),"saved");
  const next = transition(run,"engage");
  assert.equal(saveDescent(source,next,run),"saved");
  assert.equal(saveDescent(source,next,run),"conflict");
  assert.deepEqual(loadDescent(source),{ status: "restored",run: next });
  for (const raw of ['{"rules":"future"}',"{", JSON.stringify({ ...run, rngState: 0 }), JSON.stringify({ ...run,game:{ ...run.game, monsterHp: 999999 } })]) {
    map.set(DESCENT_SAVE_KEY,raw);
    assert.equal(loadDescent(source).status,"invalid");
    assert.equal(saveDescent(source,run,null),"conflict");
    assert.equal(map.get(DESCENT_SAVE_KEY),raw);
  }
  assert.equal(loadDescent(() => { throw Error("blocked"); }).status,"unavailable");
});
