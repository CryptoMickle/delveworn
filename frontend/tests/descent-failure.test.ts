import assert from "node:assert/strict";
import test from "node:test";
import { descentFailureReport, weeklyDescentFailureReport } from "../app/descent/failure";
import { createDescent, phase, transition } from "../app/descent/model";
import { DESCENT_SAVE_KEY } from "../app/descent/storage";
import { createWeeklyDescent, getWeeklyDescentDefinition, transitionWeeklyDescent } from "../app/descent/weekly";
import { saveWeeklyDescent, weeklyDescentSaveKey } from "../app/descent/weekly-storage";
import { MemoryStorage } from "./helpers/client-module";

test("a post-kill error report identifies the saved phase without changing or exposing the run",()=>{
  const storage=new MemoryStorage();
  let run=transition(createDescent(777,"private-run-identity"),"engage");
  while(phase(run)==="combat") run=transition(run,"attack");
  assert.equal(phase(run),"loot");
  const saved=JSON.stringify(run);
  storage.setItem(DESCENT_SAVE_KEY,saved);
  const report=descentFailureReport(new TypeError("example renderer failure"),()=>storage);
  assert.match(report,/room 1, loot, revision/);
  assert.match(report,/TypeError: example renderer failure/);
  assert.doesNotMatch(report,/private-run-identity|777|rngState|pendingLoot|gold|potions/);
  assert.equal(storage.getItem(DESCENT_SAVE_KEY),saved,"reading a diagnostic must not collect, restart or overwrite");
});

test("error reports handle blocked storage and remove preview-access tokens",()=>{
  const error=new Error("Failed at https://preview.example/play?_vercel_share=private-token");
  const report=descentFailureReport(error,()=>{throw new Error("Storage blocked");});
  assert.match(report,/Saved state: unavailable/);
  assert.doesNotMatch(report,/private-token/);
  assert.match(report,/_vercel_share=\[removed\]/);
});

test("weekly error reports summarize the V2 save without proofs, logs or private query values",()=>{
  const storage=new MemoryStorage();
  const definition=getWeeklyDescentDefinition("2026-W38");
  assert.ok(definition);
  const started=createWeeklyDescent(definition,"private-weekly-run");
  const run=transitionWeeklyDescent(started,"engage");
  assert.equal(saveWeeklyDescent(()=>storage,run,null),"saved");
  const saved=storage.getItem(weeklyDescentSaveKey(definition.id));
  const error=new Error("Failed at https://example.test/challenge/2026-W38?v=2&r=private-proof&ref=private-ref&_vercel_share=private-preview");
  const report=weeklyDescentFailureReport(error,()=>storage,definition.id);

  assert.match(report,new RegExp(`Saved state: ${phase(run)}, revision ${run.revision}`));
  assert.doesNotMatch(report,/private-weekly-run|private-proof|private-ref|private-preview|rngState|log|actions|\br=|\bref=|_vercel_share/);
  assert.match(report,/\?\[query removed\]/);
  assert.equal(storage.getItem(weeklyDescentSaveKey(definition.id)),saved,"reading a diagnostic must not rewrite the weekly save");
});
