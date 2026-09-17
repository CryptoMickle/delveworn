import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_GAME } from "../app/practice/engine";
import {
  loadPracticePersonalBest,
  PRACTICE_PERSONAL_BEST_KEY,
  recordPracticePersonalBest,
} from "../app/practice/personal-best";

class MemoryStorage {
  raw: string | null = null;
  writes = 0;
  getItem(key: string) { assert.equal(key, PRACTICE_PERSONAL_BEST_KEY); return this.raw; }
  setItem(key: string, value: string) { assert.equal(key, PRACTICE_PERSONAL_BEST_KEY); this.raw = value; this.writes += 1; }
}

function ended(roomsCleared: number) {
  return {
    ...EMPTY_GAME,
    hasStarted: true,
    active: false,
    hp: 0,
    monsterHp: 30,
    monsterMaxHp: 30,
    roomsCleared,
    log: ["A self-reported local result."],
  };
}

test("Practice personal best records only completed runs and never lowers the record", () => {
  const storage = new MemoryStorage();
  assert.deepEqual(recordPracticePersonalBest(storage, ended(12)), { status: "recorded", roomsCleared: 12 });
  assert.deepEqual(loadPracticePersonalBest(storage), { status: "restored", roomsCleared: 12 });
  assert.deepEqual(recordPracticePersonalBest(storage, ended(8)), { status: "kept", roomsCleared: 12 });
  assert.equal(storage.writes, 1);
  assert.deepEqual(recordPracticePersonalBest(storage, { ...ended(20), active: true }), { status: "invalid" });
});

test("Practice personal best rejects corrupt data without replacing it", () => {
  const storage = new MemoryStorage();
  storage.raw = JSON.stringify({ version: 1, roomsCleared: -4 });
  assert.deepEqual(loadPracticePersonalBest(storage), { status: "invalid" });
  assert.deepEqual(recordPracticePersonalBest(storage, ended(4)), { status: "invalid" });
  assert.equal(storage.writes, 0);
});
