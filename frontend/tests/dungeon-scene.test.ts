import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clampRoomPoint, DungeonScene, ENEMY_ART, nearRoomLoot, portraitRoomCamera, roomFloorTarget, roomLootLabel, type RoomView } from "../app/dungeon/scene";
import { roomLootPoint } from "../app/dungeon/movement";

test("portrait camera keeps tier-one actors modest and walking inside the visible room", () => {
  for (const width of [320,375,390,430]) for (const height of [220,390,500,650,800]) {
    const camera=portraitRoomCamera(width,height), scale=Math.max(width/900,height/600);
    const left=(900-width/scale)/2;
    assert.ok(camera.minX <= 400 && camera.maxX >= 450, "combat, loot and door stay reachable");
    for (const art of ENEMY_ART) assert.ok(art.roomHeight*camera.actorScale*scale <= art.roomHeight*.65+.001, "a taller room must not enlarge monsters");
    for (const x of [camera.minX,camera.maxX]) {
      const center=(x-left)*scale, halfWidth=88*camera.actorScale*scale;
      assert.ok(center-halfWidth >= 11.99 && center+halfWidth <= width-11.99, "walking keeps the full avatar on screen");
    }
    const loot=roomLootPoint(42,1,camera);
    const target=roomFloorTarget({x:450,y:65},true,0,loot);
    assert.ok(target.point.x >= camera.minX && target.point.x <= camera.maxX);
    assert.ok(nearRoomLoot(target.point,loot), "resizing never prevents floor pickup");
  }
});

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

test("door and loot taps lead to reachable loot before allowing the next room", () => {
  const door = { x: 450, y: 65 }, droppedItem = { x: 550, y: 275 };
  for (const point of [door, droppedItem]) {
    const target = roomFloorTarget(point, true, 0, droppedItem);
    assert.equal(target.destination, "loot");
    assert.ok(nearRoomLoot(clampRoomPoint(target.point, true),droppedItem), "the approach point must be within pickup range");
  }
  assert.equal(nearRoomLoot({ x: 400, y: 391 },droppedItem), false, "winning from the combat anchor does not collect remotely");
  assert.equal(nearRoomLoot({ x: 420, y: 496 },droppedItem), false, "reload at entry cannot collect remotely");
  assert.equal(roomFloorTarget(door, true, 0).destination, "door");
  assert.deepEqual(roomFloorTarget({ x: 300, y: 435 }, true, 0, droppedItem), { point: { x: 300, y: 435 } });
});

test("floor reward labels distinguish actual loot and boss pickup from an equipped relic", () => {
  assert.equal(roomLootLabel({ type: 1, amount: 1, gold: 5, relicId: 0 }), "5 gold · +1 potion");
  assert.equal(roomLootLabel({ type: 2, amount: 9, gold: 14, relicId: 0 }), "14 gold");
  assert.equal(roomLootLabel({ type: 3, amount: 1, gold: 12, relicId: 0 }), "12 gold · Weapon +1");
  assert.equal(roomLootLabel({ type: 4, amount: 1, gold: 30, relicId: 2 }), "30 gold · Armor +1 · Boss relic");
});

test("the explicit exit requires collected loot and respects a pending game action", () => {
  const base:RoomView={room:1,enemy:0,enemyName:"Grave Belle",enemyHp:0,hp:85,
    relic:0,weapon:0,armor:0,phase:"recovery",pending:false,cue:null,cueId:0,damage:0,incoming:0};
  const render=(overrides:Partial<RoomView>={})=>renderToStaticMarkup(createElement(DungeonScene,{
    view:{...base,...overrides},actions:{approach:()=>{},enter:()=>{},collect:()=>{}},
  }));
  assert.match(render(), /<button>Enter room 2 /);
  assert.match(render({pending:true}), /<button disabled="">Enter room 2 /);
  for (const phase of ["explore","combat","loot","reward","won","lost"] as const) {
    assert.doesNotMatch(render({phase,loot:{type:2,amount:16,gold:21,relicId:0}}), /Enter room/);
  }
  assert.match(render({phase:"loot",loot:{type:2,amount:16,gold:21,relicId:0}}), /Pick up loot/);
});
