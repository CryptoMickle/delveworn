import assert from "node:assert/strict";
import test from "node:test";
import { movementFacing, roomLootPoint, startRoomWalk, type Point } from "../app/dungeon/movement";
import { clampRoomPoint, nearRoomLoot, portraitRoomCamera } from "../app/dungeon/scene";

function clock() {
  let id=0;
  const callbacks=new Map<number,(time:number)=>void>();
  return {
    frames: { request(callback:(time:number)=>void) { callbacks.set(++id,callback); return id; }, cancel(key:number) { callbacks.delete(key); } },
    tick(time:number) { const pending=[...callbacks.values()]; callbacks.clear(); pending.forEach(callback=>callback(time)); },
    pending() { return callbacks.size; },
  };
}

test("approach moves continuously on one clock and arrives at its displayed destination once",()=>{
  const scheduler=clock(), from={x:420,y:496}, to={x:400,y:391}, positions:Point[]=[];
  let arrivals=0;
  startRoomWalk(from,to,point=>{positions.push(point);},()=>{arrivals++;},scheduler.frames);
  for(let ms=0;ms<=600;ms+=16) scheduler.tick(ms);
  assert.deepEqual(positions[0],from);
  assert.deepEqual(positions.at(-1),to);
  assert.equal(arrivals,1);
  assert.equal(scheduler.pending(),0);
  assert.ok(positions.length>20);
  for(let i=1;i<positions.length;i++) {
    assert.ok(Math.hypot(positions[i].x-positions[i-1].x,positions[i].y-positions[i-1].y)<=.24*16+.00001,"no frame teleports");
    assert.ok(positions[i].y<=positions[i-1].y);
  }
});

test("interrupting and retargeting uses the visible point; cancelled arrival cannot engage or collect",()=>{
  const scheduler=clock(); let visible={x:420,y:496}, oldArrivals=0,newArrivals=0;
  const stop=startRoomWalk(visible,{x:400,y:391},point=>{visible=point;},()=>{oldArrivals++;},scheduler.frames);
  scheduler.tick(0); scheduler.tick(100); stop();
  const interrupted={...visible};
  scheduler.tick(1000);
  assert.deepEqual(visible,interrupted);
  assert.equal(oldArrivals,0);
  startRoomWalk(visible,{x:510,y:440},point=>{visible=point;},()=>{newArrivals++;},scheduler.frames);
  scheduler.tick(1100);
  assert.deepEqual(visible,interrupted,"retarget does not jump to the previous requested destination");
  scheduler.tick(2100);
  assert.deepEqual(visible,{x:510,y:440});
  assert.equal(newArrivals,1); assert.equal(oldArrivals,0);
});

test("entering loot pickup distance automatically stops a walk and collects once",()=>{
  const scheduler=clock(), loot={x:500,y:300}; let collections=0,arrivals=0,visible={x:500,y:430};
  startRoomWalk(visible,{x:500,y:265},point=>{
    visible=point;
    if(nearRoomLoot(point,loot)) { collections++; return false; }
  },()=>{arrivals++;},scheduler.frames);
  for(let ms=0;ms<=1200;ms+=16) scheduler.tick(ms);
  assert.equal(collections,1); assert.equal(arrivals,0);
  assert.ok(nearRoomLoot(visible,loot));
  assert.equal(scheduler.pending(),0);
});

test("avatar turns with horizontal travel and preserves facing on vertical travel",()=>{
  assert.equal(movementFacing({x:400,y:391},{x:350,y:300},"right"),"left");
  assert.equal(movementFacing({x:350,y:300},{x:450,y:300},"left"),"right");
  assert.equal(movementFacing({x:400,y:391},{x:400,y:300},"left"),"left");
});

test("cosmetic loot positions vary by seed and room, stay reproducible and reachable across phone sizes",()=>{
  const locations=new Set<string>();
  for(const width of [320,375,390,430,1365]) for(const height of [220,390,500,650,800]) {
    const camera=width>760 ? {minX:170,maxX:733} : portraitRoomCamera(width,height);
    for(let seed=0;seed<100;seed++) for(let room=1;room<=10;room++) {
      const loot=roomLootPoint(seed,room,camera);
      assert.deepEqual(roomLootPoint(seed,room,camera),loot);
      assert.deepEqual(clampRoomPoint(loot,true),loot);
      assert.ok(loot.x>=camera.minX && loot.x<=camera.maxX);
      assert.equal(nearRoomLoot({x:400,y:391},loot),false);
      locations.add(`${loot.x},${loot.y}`);
    }
  }
  assert.ok(locations.size>500,"drops do not always appear at the guard or one fixed spot");
  assert.notDeepEqual(roomLootPoint(42,1),roomLootPoint(42,2));
  assert.notDeepEqual(roomLootPoint(42,1),roomLootPoint(777,1));
});
