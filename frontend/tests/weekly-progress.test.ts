import assert from "node:assert/strict";
import test from "node:test";
import { createWeeklyDescent, createWeeklyDescentProof, getWeeklyDescentDefinition, isWeeklyDescentComplete, transitionWeeklyDescent } from "../app/descent/weekly";
import { loadWeeklyReferral, loadWeeklyProgress, saveWeeklyBest, saveWeeklyTarget, weeklyBestKey, weeklyComparison, weeklyTargetKey } from "../app/descent/weekly-progress";
import { informedPolicy } from "./helpers/descent-policy";

function memory() {
  const values=new Map<string,string>();
  return {values,getItem:(key:string) => values.get(key) ?? null,setItem:(key:string,value:string) => { values.set(key,value); }};
}
async function completed(id="2026-W38",storm=false) {
  let run=createWeeklyDescent(getWeeklyDescentDefinition(id)!,`progress-${storm}`);
  for(let i=0;i<320 && !isWeeklyDescentComplete(run);i++) {
    const chosen=informedPolicy(run);
    run=transitionWeeklyDescent(run,storm && chosen === "attack" ? "storm" : chosen);
  }
  assert.ok(isWeeklyDescentComplete(run));
  return createWeeklyDescentProof(run);
}

test("friend target survives reload as a reverified proof, scoped by week and version",async () => {
  const store=memory(), result=await completed();
  assert.equal(saveWeeklyTarget(() => store,result),true);
  assert.equal(store.getItem(weeklyTargetKey(result.result.challengeId)),result.proof);
  const restored=await loadWeeklyProgress(() => store,result.result.challengeId,"target");
  assert.deepEqual(restored?.result,result.result);
  assert.equal(await loadWeeklyProgress(() => store,"2026-W39","target"),null);
  store.setItem(weeklyTargetKey("2026-W39"),result.proof);
  assert.equal(await loadWeeklyProgress(() => store,"2026-W39","target"),null,"a different week's proof cannot become a target");
  store.setItem(weeklyTargetKey("2026-W38"),JSON.stringify({score:99999999}));
  assert.equal(await loadWeeklyProgress(() => store,"2026-W38","target"),null,"edited local score is never trusted");
});

test("personal best keeps better results and retains the first equal score",async () => {
  const store=memory(), results=await Promise.all([completed(),completed("2026-W38",true)]);
  const [low,high]=results.sort((a,b) => a.result.score-b.result.score);
  await saveWeeklyBest(() => store,low);
  const best=await saveWeeklyBest(() => store,high);
  assert.equal(best.result.score,high.result.score);
  assert.equal((await saveWeeklyBest(() => store,low)).result.score,high.result.score);
  assert.equal(store.getItem(weeklyBestKey("2026-W38")),high.proof);
  assert.equal((await loadWeeklyProgress(() => store,"2026-W38","best"))?.proof,high.proof);
});

test("blocked progress storage never prevents verified result, target, or sharing",async () => {
  const denied=() => { throw new Error("Blocked storage"); }, result=await completed();
  assert.equal(saveWeeklyTarget(denied,result),false);
  assert.equal(await loadWeeklyProgress(denied,"2026-W38","target"),null);
  assert.equal(await saveWeeklyBest(denied,result),result);
  assert.match(weeklyComparison(100,80),/20 points ahead/);
  assert.match(weeklyComparison(80,100),/20 points to match/);
  assert.match(weeklyComparison(100,100),/matched/);
});

test("referral attribution survives only for the verified shared run",async () => {
  const store=memory(), verified=await completed();
  saveWeeklyTarget(() => store,verified,"not-the-shared-run");
  assert.equal(loadWeeklyReferral(() => store,verified),null);
  saveWeeklyTarget(() => store,verified,verified.runId);
  assert.equal(loadWeeklyReferral(() => store,await loadWeeklyProgress(() => store,"2026-W38","target")),verified.runId);
  saveWeeklyTarget(() => store,verified);
  assert.equal(loadWeeklyReferral(() => store,verified),null);
});
