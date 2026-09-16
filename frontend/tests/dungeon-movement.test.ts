import assert from "node:assert/strict";
import test from "node:test";
import {
  createRoomFrameClock,
  createRoomSteering,
  movementFacing,
  roomLootPoint,
  roomMovementKey,
  startRoomWalk,
  type Point,
  type RoomFrameHost,
} from "../app/dungeon/movement";
import { clampRoomPoint, nearRoomLoot, portraitRoomCamera } from "../app/dungeon/scene";

function controlledHost(initialTime=0,{rejectFrames=false}={}) {
  let time=initialTime,id=0;
  const frameCallbacks=new Map<number,(time:number)=>void>();
  const timerCallbacks=new Map<number,{callback:()=>void,delay:number}>();
  const everyFrame=new Map<number,(time:number)=>void>();
  const everyTimer=new Map<number,()=>void>();
  const calls={now:0,request:0,cancel:0,delay:0,clear:0};
  const host:RoomFrameHost={
    now() { calls.now++; return time; },
    request(callback) {
      calls.request++;
      if(rejectFrames) throw new Error("animation frames unavailable");
      const key=++id;
      frameCallbacks.set(key,callback); everyFrame.set(key,callback);
      return key;
    },
    cancel(key) { calls.cancel++; frameCallbacks.delete(key); },
    delay(callback,delay) {
      calls.delay++;
      const key=++id;
      timerCallbacks.set(key,{callback,delay}); everyTimer.set(key,callback);
      return key;
    },
    clear(key) { calls.clear++; timerCallbacks.delete(key); },
  };
  const firstKey=<T>(callbacks:Map<number,T>,kind:string) => {
    const key=callbacks.keys().next().value;
    assert.notEqual(key,undefined,`expected a pending ${kind}`);
    return key as number;
  };
  return {
    host,
    frames:createRoomFrameClock(host),
    calls,
    setTime(next:number) { time=next; },
    advance(ms:number) { time+=ms; },
    fireFrame(reportedTime=time) {
      const key=firstKey(frameCallbacks,"animation frame"),callback=frameCallbacks.get(key)!;
      frameCallbacks.delete(key); callback(reportedTime);
      return key;
    },
    fireTimer() {
      const key=firstKey(timerCallbacks,"fallback timer"),callback=timerCallbacks.get(key)!.callback;
      timerCallbacks.delete(key); callback();
      return key;
    },
    invokeFrame(key:number,reportedTime=time) {
      const callback=everyFrame.get(key);
      assert.ok(callback,"expected a recorded animation frame");
      callback(reportedTime);
    },
    invokeTimer(key:number) {
      const callback=everyTimer.get(key);
      assert.ok(callback,"expected a recorded fallback timer");
      callback();
    },
    frameKeys() { return [...frameCallbacks.keys()]; },
    timerKeys() { return [...timerCallbacks.keys()]; },
    delays() { return [...timerCallbacks.values()].map(timer=>timer.delay); },
    pending() { return {frames:frameCallbacks.size,timers:timerCallbacks.size}; },
  };
}

test("the room clock races animation frames against an 80ms fallback and ignores stale losers",()=>{
  const scheduler=controlledHost(),delivered:number[]=[];
  scheduler.frames.request(time=>{delivered.push(time);});
  const staleTimer=scheduler.timerKeys()[0];
  assert.deepEqual(scheduler.pending(),{frames:1,timers:1});
  assert.deepEqual(scheduler.delays(),[80]);
  scheduler.setTime(25); scheduler.fireFrame(-10_000);
  assert.deepEqual(delivered,[25],"delivery uses the shared monotonic clock, not the RAF timestamp");
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  scheduler.invokeTimer(staleTimer);
  assert.deepEqual(delivered,[25],"a cancelled fallback cannot deliver twice");

  scheduler.frames.request(time=>{delivered.push(time);});
  const staleFrame=scheduler.frameKeys()[0];
  scheduler.setTime(105); scheduler.fireTimer();
  assert.deepEqual(delivered,[25,105]);
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  scheduler.invokeFrame(staleFrame,999_999);
  assert.deepEqual(delivered,[25,105],"a cancelled RAF cannot deliver after its timer wins");

  const cancelled=scheduler.frames.request(time=>{delivered.push(time);});
  const cancelledFrame=scheduler.frameKeys()[0],cancelledTimer=scheduler.timerKeys()[0];
  scheduler.frames.cancel(cancelled);
  scheduler.invokeFrame(cancelledFrame); scheduler.invokeTimer(cancelledTimer);
  assert.deepEqual(delivered,[25,105]);
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
});

test("the default animation clock keeps browser method receivers for starting and cancelling walks",()=>{
  const scheduler=controlledHost();
  const browserPerformance={
    now(this:unknown) {
      assert.equal(this,browserPerformance,"performance.now requires its Performance receiver");
      return scheduler.host.now();
    },
  };
  const browserWindow={
    requestAnimationFrame(this:unknown,callback:(time:number)=>void) {
      assert.equal(this,browserWindow,"requestAnimationFrame requires its Window receiver");
      return scheduler.host.request(callback);
    },
    cancelAnimationFrame(this:unknown,id:number) {
      assert.equal(this,browserWindow,"cancelAnimationFrame requires its Window receiver");
      scheduler.host.cancel(id);
    },
    setTimeout(this:unknown,callback:()=>void,ms:number) {
      assert.equal(this,browserWindow,"setTimeout requires its Window receiver");
      return scheduler.host.delay(callback,ms);
    },
    clearTimeout(this:unknown,id:number) {
      assert.equal(this,browserWindow,"clearTimeout requires its Window receiver");
      scheduler.host.clear(id);
    },
  };
  const keys=["window","performance"] as const;
  const originals=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperties(globalThis,{
    window:{configurable:true,value:browserWindow},
    performance:{configurable:true,value:browserPerformance},
  });
  try {
    let visible={x:420,y:496},arrivals=0;
    const stop=startRoomWalk(visible,{x:400,y:391},point=>{visible=point;},()=>{arrivals++;});
    scheduler.setTime(100); scheduler.fireFrame(-1);
    assert.ok(visible.y<496 && visible.y>391,"the default clock must actually move the avatar");
    const paused={...visible};
    stop(); scheduler.setTime(1000);
    assert.deepEqual(visible,paused); assert.equal(arrivals,0);
    startRoomWalk(visible,{x:400,y:391},point=>{visible=point;},()=>{arrivals++;});
    scheduler.setTime(2100); scheduler.fireFrame(-1);
    assert.deepEqual(visible,{x:400,y:391}); assert.equal(arrivals,1);
    assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  } finally {
    keys.forEach((key,index)=>{
      if(originals[index]) Object.defineProperty(globalThis,key,originals[index]!);
      else Reflect.deleteProperty(globalThis,key);
    });
  }
});

test("static RAF timestamps still move continuously from input time and arrive once",()=>{
  const scheduler=controlledHost(1_000),from={x:420,y:496},to={x:400,y:391},positions:Point[]=[];
  let arrivals=0;
  startRoomWalk(from,to,point=>{positions.push(point);},()=>{arrivals++;},scheduler.frames);
  let staleFinalTimer=0;
  for(let frame=0;frame<100 && arrivals===0;frame++) {
    scheduler.advance(16);
    staleFinalTimer=scheduler.timerKeys()[0];
    scheduler.fireFrame(0);
  }
  assert.notDeepEqual(positions[0],from,"the first frame advances from the request-time start");
  assert.deepEqual(positions.at(-1),to);
  assert.equal(arrivals,1);
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  assert.ok(positions.length>20);
  assert.ok(Math.hypot(positions[0].x-from.x,positions[0].y-from.y)<=.24*16+.00001,"the first frame does not teleport");
  for(let i=1;i<positions.length;i++) {
    assert.ok(Math.hypot(positions[i].x-positions[i-1].x,positions[i].y-positions[i-1].y)<=.24*16+.00001,"no frame teleports");
    assert.ok(positions[i].y<=positions[i-1].y);
  }
  scheduler.invokeTimer(staleFinalTimer);
  assert.equal(arrivals,1,"the losing timer from the arrival frame stays stale");
});

test("fallback timers move gradually and finish when RAF stalls or is unavailable",()=>{
  for(const rejectFrames of [false,true]) {
    const scheduler=controlledHost(0,{rejectFrames}),from={x:420,y:496},to={x:500,y:300},positions:Point[]=[];
    let arrivals=0;
    startRoomWalk(from,to,point=>{positions.push(point);},()=>{arrivals++;},scheduler.frames);
    for(let fallback=0;fallback<30 && arrivals===0;fallback++) {
      scheduler.advance(80); scheduler.fireTimer();
    }
    assert.deepEqual(positions.at(-1),to,rejectFrames ? "missing RAF completes" : "stalled RAF completes");
    assert.equal(arrivals,1);
    assert.ok(positions.length>4,"fallback movement remains visibly gradual");
    assert.ok(Math.hypot(positions[0].x-from.x,positions[0].y-from.y)<=.24*80+.00001);
    for(let i=1;i<positions.length;i++)
      assert.ok(Math.hypot(positions[i].x-positions[i-1].x,positions[i].y-positions[i-1].y)<=.24*80+.00001);
    assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  }
});

test("interrupting and retargeting cancels both schedulers and stale callbacks cannot engage or collect",()=>{
  const scheduler=controlledHost(); let visible={x:420,y:496},oldArrivals=0,newArrivals=0;
  const stop=startRoomWalk(visible,{x:400,y:391},point=>{visible=point;},()=>{oldArrivals++;},scheduler.frames);
  scheduler.advance(100); scheduler.fireFrame(0);
  const interrupted={...visible};
  const staleFrame=scheduler.frameKeys()[0],staleTimer=scheduler.timerKeys()[0];
  stop();
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  scheduler.setTime(1000); scheduler.invokeFrame(staleFrame); scheduler.invokeTimer(staleTimer);
  assert.deepEqual(visible,interrupted);
  assert.equal(oldArrivals,0);
  startRoomWalk(visible,{x:510,y:440},point=>{visible=point;},()=>{newArrivals++;},scheduler.frames);
  scheduler.advance(16); scheduler.fireFrame(0);
  assert.notDeepEqual(visible,interrupted,"retargeting makes progress on its first frame");
  assert.ok(Math.hypot(visible.x-interrupted.x,visible.y-interrupted.y)<=.24*16+.00001,"retarget does not teleport");
  scheduler.advance(1000); scheduler.fireFrame(0);
  assert.deepEqual(visible,{x:510,y:440});
  assert.equal(newArrivals,1); assert.equal(oldArrivals,0);
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
});

test("entering loot pickup distance automatically stops a walk and collects once",()=>{
  const scheduler=controlledHost(),loot={x:500,y:300}; let collections=0,arrivals=0,visible={x:500,y:430},staleTimer=0;
  startRoomWalk(visible,{x:500,y:265},point=>{
    visible=point;
    if(nearRoomLoot(point,loot)) { collections++; return false; }
  },()=>{arrivals++;},scheduler.frames);
  for(let frame=0;frame<100 && collections===0;frame++) {
    scheduler.advance(16); staleTimer=scheduler.timerKeys()[0]; scheduler.fireFrame(0);
  }
  assert.equal(collections,1); assert.equal(arrivals,0);
  assert.ok(nearRoomLoot(visible,loot));
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  scheduler.invokeTimer(staleTimer);
  assert.equal(collections,1,"a stale fallback cannot collect the same loot twice");
});

test("invalid movement points fail before consulting the scheduler",()=>{
  let schedulerCalls=0,steps=0,arrivals=0;
  const frames={
    now() { schedulerCalls++; return 0; },
    request() { schedulerCalls++; return 1; },
    cancel() { schedulerCalls++; },
  };
  const invalidWalks:[Point,Point][]=[
    [{x:Number.NaN,y:0},{x:1,y:1}],
    [{x:0,y:Number.POSITIVE_INFINITY},{x:1,y:1}],
    [{x:0,y:0},{x:Number.NEGATIVE_INFINITY,y:1}],
    [{x:0,y:0},{x:1,y:Number.NaN}],
  ];
  for(const [from,to] of invalidWalks)
    assert.throws(()=>startRoomWalk(from,to,()=>{steps++;},()=>{arrivals++;},frames),RangeError);
  assert.equal(schedulerCalls,0);
  assert.equal(steps,0); assert.equal(arrivals,0);
});

test("avatar turns with horizontal travel and preserves facing on vertical travel",()=>{
  assert.equal(movementFacing({x:400,y:391},{x:350,y:300},"right"),"left");
  assert.equal(movementFacing({x:350,y:300},{x:450,y:300},"left"),"right");
  assert.equal(movementFacing({x:400,y:391},{x:400,y:300},"left"),"left");
});

test("held WASD moves from the first frame without waiting for key repeat and stops on release",()=>{
  const scheduler=controlledHost(), motion:boolean[]=[];
  let point={x:420,y:496};
  const steering=createRoomSteering(()=>point,next=>{point=next;},moving=>motion.push(moving),scheduler.frames);
  steering.press("w");
  for(let frame=0;frame<20;frame++) { scheduler.advance(16); scheduler.fireFrame(); }
  assert.ok(Math.abs(point.y-(496-320*.24))<1e-8);
  assert.deepEqual(motion,[true],"a held key never restarts the walking animation");
  const staleFrame=scheduler.frameKeys()[0],staleTimer=scheduler.timerKeys()[0];
  steering.release("w");
  const stopped={...point};
  scheduler.advance(500); scheduler.invokeFrame(staleFrame); scheduler.invokeTimer(staleTimer);
  assert.deepEqual(point,stopped);
  assert.deepEqual(motion,[true,false]);
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  assert.equal(steering.moving,false);
  assert.equal(roomMovementKey("W"),"w");
  for(const reserved of ["ArrowUp","ArrowLeft","k","j","m","Enter"]) assert.equal(roomMovementKey(reserved),null);
});

test("held direction changes have no restart delay and diagonal movement keeps the same speed",()=>{
  const scheduler=controlledHost();
  let point={x:400,y:400};
  const steering=createRoomSteering(()=>point,next=>{point=next;},()=>{},scheduler.frames);
  steering.press("w");
  scheduler.advance(16); scheduler.fireFrame();
  const before={...point};
  steering.press("d"); steering.press("w"); // OS repeat cannot add another loop.
  scheduler.advance(16); scheduler.fireFrame();
  assert.ok(point.x>before.x && point.y<before.y);
  assert.ok(Math.abs(Math.hypot(point.x-before.x,point.y-before.y)-16*.24)<1e-8);
  steering.release("w");
  const diagonalEnd={...point};
  scheduler.advance(16); scheduler.fireFrame();
  assert.equal(point.y,diagonalEnd.y);
  assert.ok(Math.abs(point.x-diagonalEnd.x-16*.24)<1e-8);
  assert.deepEqual(scheduler.pending(),{frames:1,timers:1});
  steering.stop();
});

test("opposite keys pause and resume the remaining direction immediately",()=>{
  const scheduler=controlledHost();
  let point={x:400,y:400};
  const steering=createRoomSteering(()=>point,next=>{point=next;},()=>{},scheduler.frames);
  steering.press("a"); steering.press("d");
  assert.equal(steering.moving,false);
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  steering.release("a");
  scheduler.advance(16); scheduler.fireFrame();
  assert.ok(point.x>400);
  steering.stop();
  steering.release("d");
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
});

test("held walking clamps delayed frames, survives missing RAF and stops once at an interaction",()=>{
  const scheduler=controlledHost(0,{rejectFrames:true});
  let point={x:420,y:496}, interactions=0;
  const steering=createRoomSteering(()=>point,next=>{
    assert.ok(Math.hypot(next.x-point.x,next.y-point.y)<=80*.24+.00001);
    point=clampRoomPoint(next,false);
    if(Math.hypot(point.x-450,point.y-236)<125) { interactions++; return false; }
  },()=>{},scheduler.frames);
  steering.press("w");
  for(let tick=0;tick<30 && steering.moving;tick++) { scheduler.advance(500); scheduler.fireTimer(); }
  assert.equal(interactions,1,"walking into the guard starts the encounter without E or a click");
  assert.equal(steering.moving,false);
  assert.deepEqual(scheduler.pending(),{frames:0,timers:0});
  steering.release("w");
  assert.equal(steering.moving,false,"a completed interaction clears held keys");
});

test("focus loss cancellation clears held keys and a fresh room can walk immediately",()=>{
  const scheduler=controlledHost();
  let point={x:420,y:496};
  const steering=createRoomSteering(()=>point,next=>{point=next;},()=>{},scheduler.frames);
  steering.press("d");
  scheduler.advance(16); scheduler.fireFrame();
  steering.stop();
  point={x:420,y:496};
  steering.press("w");
  scheduler.advance(16); scheduler.fireFrame();
  assert.deepEqual(point,{x:420,y:496-16*.24});
  steering.stop();
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
