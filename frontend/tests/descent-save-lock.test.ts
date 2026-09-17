import assert from "node:assert/strict";
import test from "node:test";
import { exclusiveSave, type ExclusiveSaveResult, type SaveLocks } from "../app/descent/save-lock";
import { DESCENT_SAVE_KEY } from "../app/descent/storage";

function locksWith(value: unknown | null): SaveLocks {
  return {
    async request(name, options, callback): Promise<ExclusiveSaveResult> {
      assert.equal(name, DESCENT_SAVE_KEY);
      assert.deepEqual(options, { ifAvailable: true });
      return callback(value);
    },
  };
}

test("an available save lock runs the guarded write", async () => {
  let writes=0;
  assert.equal(await exclusiveSave(() => { writes++; return "saved"; },locksWith({name:DESCENT_SAVE_KEY})),"saved");
  assert.equal(writes,1);
});

test("a held save lock returns immediately without writing", async () => {
  let writes=0;
  assert.equal(await exclusiveSave(() => { writes++; return "saved"; },locksWith(null)),"busy");
  assert.equal(writes,0);
});

test("a busy save can be retried after the lock becomes available", async () => {
  let held=true, writes=0;
  const locks:SaveLocks={
    async request(_name,_options,callback) { return callback(held ? null : {name:DESCENT_SAVE_KEY}); },
  };
  const write=() => { writes++; return "saved" as const; };
  assert.equal(await exclusiveSave(write,locks),"busy");
  held=false;
  assert.equal(await exclusiveSave(write,locks),"saved");
  assert.equal(writes,1);
});

test("an available lock preserves a compare-before-write conflict", async () => {
  let stored="newer";
  const result=await exclusiveSave(()=>{
    if (stored !== "expected") return "conflict";
    stored="replacement";
    return "saved";
  },locksWith({name:DESCENT_SAVE_KEY}));
  assert.equal(result,"conflict");
  assert.equal(stored,"newer");
});

test("browsers without Web Locks still use compare-before-write storage", async () => {
  let writes=0;
  assert.equal(await exclusiveSave(() => { writes++; return "conflict"; },null),"conflict");
  assert.equal(writes,1);
});

test("lock API failures make saving unavailable without rejecting", async () => {
  const locks:SaveLocks={request:async()=>{throw new Error("Lock manager failed");}};
  await assert.doesNotReject(async()=>assert.equal(await exclusiveSave(()=>"saved",locks),"unavailable"));
});

test("weekly saves acquire their own week-specific lock", async () => {
  const key="delveworn_weekly_descent_v2:2026-W38";
  const locks:SaveLocks={request:async(name,_options,callback) => {
    assert.equal(name,key);
    return callback({name});
  }};
  assert.equal(await exclusiveSave(() => "saved",locks,key),"saved");
});
