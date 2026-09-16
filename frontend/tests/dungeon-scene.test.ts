import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clampRoomPoint, DungeonScene, ENEMY_ART, measuredRoomCamera, nearRoomLoot, portraitRoomCamera, roomFloorTarget, roomLootLabel, roomMerchantApproach, roomMerchantPoint, type RoomView } from "../app/dungeon/scene";
import { createMerchantArrivalGate } from "../app/dungeon/merchant-room";
import { MERCHANT_ROOM_ART_LAYOUT } from "../app/dungeon/merchant-art";
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
    const target=roomFloorTarget(loot,true,0,loot);
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

test("native pointer coordinates survive floor targeting and portrait bounds", () => {
  // Like DOMPoint, the coordinates are inherited getters, not enumerable fields.
  class NativePoint {
    #x:number; #y:number;
    constructor(x:number,y:number) { this.#x=x; this.#y=y; }
    get x() { return this.#x; }
    get y() { return this.#y; }
  }
  for (const cleared of [false,true]) {
    for (const target of [new NativePoint(300,435),new NativePoint(590,270)]) {
      assert.deepEqual(Object.keys(target),[]);
      const floor=roomFloorTarget(target,cleared,0);
      assert.equal(floor.destination,undefined);
      assert.deepEqual(clampRoomPoint(floor.point,cleared),{x:target.x,y:target.y});
      assert.deepEqual(clampRoomPoint(floor.point,cleared,{minX:350,maxX:550}),{
        x:Math.max(350,Math.min(550,target.x)),y:target.y,
      });
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

test("a cleared door tap bypasses visible loot while the loot graphic remains collectible", () => {
  const door = { x: 450, y: 65 }, droppedItem = { x: 550, y: 275 };
  assert.deepEqual(roomFloorTarget(door,true,0,droppedItem),{point:{x:450,y:92},destination:"door"});
  const pickup=roomFloorTarget(droppedItem,true,0,droppedItem);
  assert.equal(pickup.destination,"loot");
  assert.ok(nearRoomLoot(clampRoomPoint(pickup.point,true),droppedItem),"the loot approach point must be within pickup range");
  assert.equal(nearRoomLoot({ x: 400, y: 391 },droppedItem), false, "winning from the combat anchor does not collect remotely");
  assert.equal(nearRoomLoot({ x: 420, y: 496 },droppedItem), false, "reload at entry cannot collect remotely");
  assert.equal(roomFloorTarget(door, true, 0).destination, "door");
  assert.deepEqual(roomFloorTarget({ x: 300, y: 435 }, true, 0, droppedItem), { point: { x: 300, y: 435 } });
});

test("Kevin taps approach the painted shop before or after floor loot pickup", () => {
  const cameras=[{actorScale:1,minX:170,maxX:733},...[
    [320,440],[320,650],[375,650],[430,800],
  ].map(([width,height])=>portraitRoomCamera(width,height))];
  for(const bounds of cameras) {
    for(const room of [5,9]) {
      const merchant=roomMerchantPoint(bounds), approach=roomMerchantApproach(merchant,bounds);
      const scale=bounds.actorScale ?? 1;
      const visibleLeft=bounds.minX <= 170 ? 0 : bounds.minX-(88+12/.65)*scale;
      const wagonLeft=visibleLeft+50*scale;
      assert.deepEqual(merchant,{x:Math.min(bounds.maxX-52*scale,wagonLeft+210*scale),y:270},"Kevin stands immediately inward of the wall-parked wagon");
      assert.ok(Math.abs(merchant.x+MERCHANT_ROOM_ART_LAYOUT.stall.xByOuterSide.right*scale-wagonLeft)<.001,"the turned wagon finishes at the visible left wall margin");
      assert.ok(merchant.x+(MERCHANT_ROOM_ART_LAYOUT.person.x+MERCHANT_ROOM_ART_LAYOUT.person.width)*scale <= bounds.maxX+.001,"Kevin stays inside the right camera bound");
      assert.deepEqual(approach,{x:Math.min(bounds.maxX,merchant.x+48),y:merchant.y+36},"the avatar approaches from the inward side");
      assert.ok(approach.x >= bounds.minX && approach.x <= bounds.maxX,"the approach remains inside the mobile camera");
      assert.ok(Math.hypot(approach.x-merchant.x,approach.y-merchant.y) <= 64,"the shop opens from beside Kevin");
      const figureCenter={x:merchant.x,y:merchant.y-75};
      assert.deepEqual(roomFloorTarget(figureCenter,true,0,undefined,merchant,room,bounds),{point:approach,destination:"merchant"});
      const wagonCenter={x:merchant.x-115*scale,y:merchant.y-88*scale};
      assert.deepEqual(roomFloorTarget(wagonCenter,true,0,undefined,merchant,room,bounds),{point:approach,destination:"merchant"},"the turned wagon remains a shop target");

      const loot={x:room === 5 ? bounds.maxX : bounds.minX,y:400};
      assert.deepEqual(roomFloorTarget(figureCenter,true,0,loot,merchant,room,bounds),{point:approach,destination:"merchant"},"the painted figure remains visitable while loot waits");
      assert.deepEqual(roomFloorTarget({x:450,y:435},true,0,undefined,merchant,room,bounds),{point:{x:450,y:435}},"ordinary floor remains walkable");
    }
  }
});

test("Kevin's shop waits for both walks, cancels stale intent and opens once", () => {
  let opens=0;
  const gate=createMerchantArrivalGate();
  const playerArrived=() => { const ready=gate.playerArrived(); if(ready) opens++; return ready; };
  const merchantArrived=(arrived:boolean) => { const ready=gate.merchantArrived(arrived); if(ready) opens++; return ready; };

  assert.equal(playerArrived(),false,"an early player arrival waits for Kevin");
  assert.equal(gate.waiting,true);
  assert.equal(merchantArrived(true),true,"Kevin's arrival completes the queued trade");
  assert.equal(opens,1);
  assert.equal(merchantArrived(true),false,"repeated arrival signals cannot reopen the shop");

  assert.equal(playerArrived(),true,"reduced motion also works when Kevin arrives first");
  assert.equal(opens,2);
  merchantArrived(false);
  assert.equal(playerArrived(),false);
  gate.cancel();
  assert.equal(merchantArrived(true),false,"walking elsewhere cancels the queued trade");
  assert.equal(opens,2);
});

test("the original Kevin figure enters eligible rooms as soon as loot drops", () => {
  const base:RoomView={room:5,enemy:0,enemyName:"Grave Belle",enemyHp:0,hp:85,
    relic:0,weapon:0,armor:0,phase:"recovery",pending:false,cue:null,cueId:0,damage:0,incoming:0};
  const render=(overrides:Partial<RoomView>={})=>renderToStaticMarkup(createElement(DungeonScene,{
    view:{...base,...overrides},actions:{approach:()=>{},enter:()=>{},collect:()=>{},merchant:()=>{}},
  }));
  for(const room of [5,9]) {
    const markup=render({room});
    assert.match(markup,/data-merchant-position="450,92"/,"Kevin starts at the north doorway");
    assert.match(markup,/data-merchant-destination="260,270"/,"Kevin finishes inward of the wagon parked against the left wall");
    assert.match(markup,/data-merchant-arrived="false"/,"entry has not teleported to the final spot");
    assert.match(markup,/role="img" aria-label="Quartermaster Kevin\. Walk here to trade\."/);
    assert.match(markup,/\/characters\/merchant-quartermaster-kevin\.webp/);
  }
  for(const room of [15,19,20,25,29,40,49]) assert.match(render({room}),/data-merchant-position/);
  assert.doesNotMatch(render({room:5,phase:"combat"}),/data-merchant-position/);
  assert.match(render({room:5,phase:"loot",loot:{type:2,amount:16,gold:21,relicId:0}}),/data-merchant-position="450,92"/);
});

test("floor reward labels distinguish actual loot and boss pickup from an equipped relic", () => {
  assert.equal(roomLootLabel({ type: 1, amount: 1, gold: 5, relicId: 0 }), "5 gold · +1 potion");
  assert.equal(roomLootLabel({ type: 2, amount: 9, gold: 14, relicId: 0 }), "14 gold");
  assert.equal(roomLootLabel({ type: 3, amount: 1, gold: 12, relicId: 0 }), "12 gold · Weapon +1");
  assert.equal(roomLootLabel({ type: 4, amount: 1, gold: 30, relicId: 2 }), "30 gold · Armor +1 · Boss relic");
});

test("loot rooms expose both physical exits and no action buttons", () => {
  const base:RoomView={room:1,enemy:0,enemyName:"Grave Belle",enemyHp:0,hp:85,
    relic:0,weapon:0,armor:0,phase:"recovery",pending:false,cue:null,cueId:0,damage:0,incoming:0};
  const render=(overrides:Partial<RoomView>={})=>renderToStaticMarkup(createElement(DungeonScene,{
    view:{...base,...overrides},actions:{approach:()=>{},enter:()=>{},collect:()=>{},skipLoot:()=>{}},
  }));
  assert.match(render(), /<button\b[^>]*>Enter room 2 /);
  assert.match(render({pending:true}), /<button\b[^>]* disabled=""[^>]*>Enter room 2 /);
  for (const phase of ["explore","combat","reward","won","lost"] as const) {
    assert.doesNotMatch(render({phase,loot:{type:2,amount:16,gold:21,relicId:0}}), /Enter room/);
  }
  const loot=render({phase:"loot",loot:{type:2,amount:16,gold:21,relicId:0}});
  assert.match(loot,/class="dungeon-door-open"/);
  assert.match(loot,/data-loot-position=/);
  assert.doesNotMatch(loot,/<button[^>]*>(?:Pick up loot|Leave loot|Enter room|Continue)/);
  assert.match(loot,/E to use the door/);
});


test("transient hidden or invalid room measurements cannot replace the active camera", () => {
  for (const portrait of [false,true]) {
    for (const invalid of [0,-1,NaN,Infinity,-Infinity]) {
      assert.equal(measuredRoomCamera(invalid,390,portrait),null);
      assert.equal(measuredRoomCamera(375,invalid,portrait),null);
    }
  }
  assert.equal(measuredRoomCamera(1,390,true),null,"inverted visible bounds cannot displace an active walker");
  assert.deepEqual(measuredRoomCamera(375,390,true),portraitRoomCamera(375,390));
  assert.deepEqual(measuredRoomCamera(1365,500,false),{actorScale:1,minX:170,maxX:733});
});
