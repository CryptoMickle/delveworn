import assert from "node:assert/strict";
import test from "node:test";
import {
  MERCHANT_ENTRY,
  createMerchantJourney,
  merchantElapsedAt,
  merchantPoseAt,
  startMerchantJourney,
  type MerchantPose,
  type MerchantProgress,
} from "../app/dungeon/merchant-motion";
import type { Point, RoomFrames } from "../app/dungeon/movement";

const WALK_SPEED = .24;

function assertPoint(actual: Point, expected: Point, message?: string) {
  assert.ok(Math.abs(actual.x-expected.x) < .001 && Math.abs(actual.y-expected.y) < .001,
    message ?? `expected (${actual.x},${actual.y}) to equal (${expected.x},${expected.y})`);
}

function assertProgress(actual: number, expected: number) {
  assert.ok(Math.abs(actual-expected) < 1e-9, `expected progress ${actual} to equal ${expected}`);
}

function manualFrames() {
  let time=0, sequence=0;
  const pending=new Map<number,(time: number) => void>();
  const frames:RoomFrames={
    now:()=>time,
    request(callback) { const id=++sequence; pending.set(id,callback); return id; },
    cancel(id) { pending.delete(id); },
  };
  const advanceTo=(next: number) => {
    assert.ok(next >= time);
    time=next;
    const callbacks=[...pending.values()];
    pending.clear();
    callbacks.forEach(callback=>callback(time));
  };
  return {frames,pending,advanceTo,get time(){ return time; }};
}

test("Kevin leads the wagon to the existing parking point, circles south, then turns it in place", () => {
  const plan=createMerchantJourney({x:380,y:270},1);
  assert.deepEqual(plan.towPath,[MERCHANT_ENTRY,{x:450,y:270},{x:150,y:270}]);
  assert.deepEqual(plan.circlePath,[{x:150,y:270},{x:150,y:322},{x:380,y:322},{x:380,y:270}]);
  assert.deepEqual(plan.parkedWagon,{x:265,y:270});

  const start=merchantPoseAt(plan,0);
  assert.equal(start.stage,"entering");
  assertPoint(start.position,MERCHANT_ENTRY);
  assertPoint(start.wagon,{x:450,y:-23},"the wagon begins behind Kevin through the north doorway");
  assert.equal(start.facing,"left");
  assert.equal(start.wagonTurn,0);

  const cornerTravel=270-MERCHANT_ENTRY.y;
  const afterBothTurnLeft=merchantPoseAt(plan,(cornerTravel+160)/WALK_SPEED);
  assertPoint(afterBothTurnLeft.position,{x:290,y:270});
  assertPoint(afterBothTurnLeft.wagon,{x:405,y:270});
  assert.equal(afterBothTurnLeft.wagon.x-afterBothTurnLeft.position.x,115,
    "the wagon follows to Kevin's right on the leftward leg");

  const beforePark=merchantPoseAt(plan,plan.enterDuration-.001);
  const parked=merchantPoseAt(plan,plan.enterDuration);
  assert.equal(beforePark.stage,"entering");
  assert.equal(parked.stage,"circling");
  assertPoint(beforePark.position,parked.position,"Kevin's enter/circle boundary is continuous");
  assertPoint(beforePark.wagon,parked.wagon,"the wagon does not jump when it parks");
  assertPoint(parked.position,{x:150,y:270});
  assertPoint(parked.wagon,plan.parkedWagon);

  for(const fraction of [0,.2,.5,.8]) {
    const pose=merchantPoseAt(plan,plan.enterDuration+plan.circleDuration*fraction);
    assert.equal(pose.stage,"circling");
    assertPoint(pose.wagon,plan.parkedWagon,"the parked wagon remains still while Kevin circles it");
  }
  const southCorner=merchantPoseAt(plan,plan.enterDuration+52/WALK_SPEED);
  assertPoint(southCorner.position,{x:150,y:322});
  assert.equal(southCorner.facing,"right");

  const turning=merchantPoseAt(plan,plan.enterDuration+plan.circleDuration);
  assert.equal(turning.stage,"turning");
  assertPoint(turning.position,plan.destination);
  assertPoint(turning.wagon,plan.parkedWagon);
  assert.equal(turning.wagonTurn,0);
  const ready=merchantPoseAt(plan,plan.duration);
  assert.deepEqual(ready,{stage:"ready",progress:1,position:plan.destination,wagon:plan.parkedWagon,facing:"right",wagonTurn:1});
});

test("scaled journeys preserve the same parking geometry and stage progress after a resize", () => {
  const desktop=createMerchantJourney({x:380,y:270},1);
  const mobile=createMerchantJourney({x:466.8,y:270},.6);
  assertPoint(mobile.towPath[2],{x:328.8,y:270});
  assertPoint(mobile.parkedWagon,{x:397.8,y:270});
  assertPoint(mobile.circlePath[1],{x:328.8,y:301.2});

  const samples:MerchantProgress[]=[
    {stage:"entering",progress:.37},
    {stage:"circling",progress:.43},
    {stage:"turning",progress:.61},
    {stage:"ready",progress:1},
  ];
  for(const sample of samples) {
    const oldPose=merchantPoseAt(desktop,merchantElapsedAt(desktop,sample));
    const resizedPose=merchantPoseAt(mobile,merchantElapsedAt(mobile,oldPose));
    assert.equal(resizedPose.stage,sample.stage);
    assertProgress(resizedPose.progress,sample.progress);
  }

  assert.throws(()=>createMerchantJourney({x:380,y:270},0),RangeError);
  assert.throws(()=>createMerchantJourney({x:Number.NaN,y:270},1),RangeError);
});

test("the journey announces arrival only after the wagon turn and cancellation stops all work", () => {
  const plan=createMerchantJourney({x:380,y:270},1);
  const clock=manualFrames();
  const poses:MerchantPose[]=[];
  let arrivals=0;
  const stop=startMerchantJourney(plan,pose=>poses.push(pose),()=>{ arrivals++; },clock.frames);
  assert.equal(clock.pending.size,1);

  clock.advanceTo(plan.enterDuration);
  assert.equal(poses.at(-1)?.stage,"circling");
  assert.equal(arrivals,0);
  clock.advanceTo(plan.enterDuration+plan.circleDuration);
  assert.equal(poses.at(-1)?.stage,"turning");
  assert.equal(arrivals,0);
  clock.advanceTo(plan.duration-1);
  assert.equal(poses.at(-1)?.stage,"turning");
  assert.equal(arrivals,0);
  clock.advanceTo(plan.duration);
  assert.equal(poses.at(-1)?.stage,"ready");
  assert.equal(arrivals,1);
  assert.equal(clock.pending.size,0);
  clock.advanceTo(plan.duration+1000);
  assert.equal(arrivals,1);
  stop();

  const cancelledClock=manualFrames();
  const cancelledPoses:MerchantPose[]=[];
  let cancelledArrivals=0;
  const cancel=startMerchantJourney(plan,pose=>cancelledPoses.push(pose),()=>{ cancelledArrivals++; },cancelledClock.frames);
  cancelledClock.advanceTo(250);
  assert.equal(cancelledPoses.length,1);
  cancel();
  assert.equal(cancelledClock.pending.size,0);
  cancelledClock.advanceTo(plan.duration+1000);
  assert.equal(cancelledPoses.length,1);
  assert.equal(cancelledArrivals,0);
});

test("a resumed journey starts at the matching resized stage instead of replaying entry", () => {
  const resized=createMerchantJourney({x:466.8,y:270},.6);
  const clock=manualFrames();
  const poses:MerchantPose[]=[];
  let arrivals=0;
  const resume:MerchantProgress={stage:"circling",progress:.4};
  const stop=startMerchantJourney(resized,pose=>poses.push(pose),()=>{ arrivals++; },clock.frames,resume);
  clock.advanceTo(0);
  assert.equal(poses.length,1);
  assert.equal(poses[0].stage,"circling");
  assertProgress(poses[0].progress,.4);
  assertPoint(poses[0].wagon,resized.parkedWagon);
  assert.equal(arrivals,0);
  stop();
  assert.equal(clock.pending.size,0);
});
