import assert from "node:assert/strict";
import test from "node:test";
import { descentFailureReport } from "../app/descent/failure";
import { createDescent, phase, transition } from "../app/descent/model";
import { DESCENT_SAVE_KEY } from "../app/descent/storage";
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
