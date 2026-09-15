import assert from "node:assert/strict";
import test from "node:test";
import { clampRoomPoint, roomFloorTarget } from "../app/dungeon/scene";

test("the same north-door tap approaches its living guard and enters only after clearing", () => {
  const door = { x: 450, y: 65 };
  for (const enemy of [0, 1, 2, 3] as const) {
    const guarded = roomFloorTarget(door, false, enemy);
    assert.equal(guarded.destination, "enemy");
    assert.ok(guarded.point.y > 300, "approach stops on the player's side of the guard");
    const cleared = roomFloorTarget(door, true, enemy);
    assert.equal(cleared.destination, "door");
    assert.ok(cleared.point.y < 130);
  }
});

test("floor taps find every centered monster and leave ordinary floor walkable", () => {
  for (const enemy of [0, 1, 2, 3] as const) {
    assert.equal(roomFloorTarget({ x: 450, y: 180 }, false, enemy).destination, "enemy");
    assert.equal(roomFloorTarget({ x: 450, y: 180 }, true, enemy).destination, undefined);
    for (const floor of [{ x: 300, y: 435 }, { x: 590, y: 270 }]) {
      assert.deepEqual(roomFloorTarget(floor, false, enemy), { point: floor });
    }
  }
});

test("walking cannot reach the guarded doorway but the cleared exit is reachable", () => {
  for (const x of [400, 450, 500]) {
    const blocked = clampRoomPoint({ x, y: 92 }, false);
    assert.ok(blocked.y > 300);
    assert.deepEqual(clampRoomPoint({ x, y: 92 }, true), { x, y: 92 });
  }
  assert.deepEqual(clampRoomPoint({ x: 300, y: 435 }, false), { x: 300, y: 435 });
  assert.deepEqual(clampRoomPoint({ x: 0, y: 0 }, false), { x: 170, y: 194 });
  assert.deepEqual(clampRoomPoint({ x: 900, y: 600 }, true), { x: 733, y: 505 });
});
