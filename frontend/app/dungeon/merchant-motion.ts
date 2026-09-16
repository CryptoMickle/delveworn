import { createRoomFrameClock, isRoomPoint, movementFacing, type Facing, type Point, type RoomFrames } from "./movement";

export const MERCHANT_ENTRY = { x: 450, y: 92 } as const;
type MerchantStage = "entering" | "circling" | "facing" | "turning" | "pushing" | "ready";
export type MerchantProgress = { stage: MerchantStage; progress: number };
export type MerchantPose = MerchantProgress & {
  position: Point;
  wagon: Point;
  facing: Facing;
  /** A turn in place: 0 faces left; 1 faces into the room. */
  wagonTurn: number;
};

const WALK_SPEED = .24;
const distance = (a: Point, b: Point) => Math.hypot(b.x-a.x,b.y-a.y);
const pathLength = (points: readonly Point[]) => points.slice(1).reduce((sum,point,index) => sum+distance(points[index],point),0);

/** Negative distance lets the wagon follow through the doorway after Kevin. */
function alongPath(points: readonly Point[], travelled: number): Point {
  for (let index=1;index<points.length;index++) {
    const from=points[index-1], to=points[index], length=distance(from,to);
    if (length === 0) continue;
    if (travelled <= length) {
      const fraction=travelled/length;
      return {x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction};
    }
    travelled-=length;
  }
  return {...points[points.length-1]};
}

/** Kevin uses the familiar entrance, then pushes the turned wagon against the
 * visible left wall before he presents the finished shop. */
export function createMerchantJourney(destination: Point, actorScale: number) {
  if (!isRoomPoint(destination) || !Number.isFinite(actorScale) || actorScale <= 0) throw new RangeError("Invalid merchant destination");
  const pushDistance=120*actorScale;
  const stagingDestination={x:destination.x+pushDistance,y:destination.y};
  const outer={x:stagingDestination.x-230*actorScale,y:destination.y};
  const towPath=[MERCHANT_ENTRY,{x:MERCHANT_ENTRY.x,y:destination.y},outer];
  const circlePath=[outer,{x:outer.x,y:outer.y+52*actorScale},{x:stagingDestination.x,y:destination.y+52*actorScale},stagingDestination];
  const enterDuration=pathLength(towPath)/WALK_SPEED;
  const circleDuration=pathLength(circlePath)/WALK_SPEED;
  const faceDuration=220;
  const turnDuration=280;
  const pushDuration=pushDistance/WALK_SPEED;
  return {destination,stagingDestination,actorScale,towPath,circlePath,enterDuration,circleDuration,faceDuration,turnDuration,pushDuration,
    circleWagon:{x:stagingDestination.x-115*actorScale,y:destination.y},
    parkedWagon:{x:destination.x-115*actorScale,y:destination.y},
    duration:enterDuration+circleDuration+faceDuration+turnDuration+pushDuration};
}
export type MerchantJourney = ReturnType<typeof createMerchantJourney>;

export function merchantPoseAt(plan: MerchantJourney, elapsedMs: number): MerchantPose {
  const elapsed=Math.max(0,elapsedMs);
  if (elapsed >= plan.duration) return {stage:"ready",progress:1,position:plan.destination,wagon:plan.parkedWagon,facing:"right",wagonTurn:1};
  if (elapsed < plan.enterDuration) {
    const travelled=elapsed*WALK_SPEED, position=alongPath(plan.towPath,travelled);
    return {stage:"entering",progress:elapsed/plan.enterDuration,position,
      wagon:alongPath(plan.towPath,travelled-115*plan.actorScale),
      facing:movementFacing(alongPath(plan.towPath,travelled-1),position,"left"),wagonTurn:0};
  }
  const circleElapsed=elapsed-plan.enterDuration;
  if (circleElapsed < plan.circleDuration) {
    const travelled=circleElapsed*WALK_SPEED, position=alongPath(plan.circlePath,travelled);
    return {stage:"circling",progress:circleElapsed/plan.circleDuration,position,wagon:plan.circleWagon,
      facing:travelled < 52*plan.actorScale ? "left" : "right",wagonTurn:0};
  }
  const faceElapsed=circleElapsed-plan.circleDuration;
  if (faceElapsed < plan.faceDuration) return {stage:"facing",progress:faceElapsed/plan.faceDuration,
    position:plan.stagingDestination,wagon:plan.circleWagon,facing:"left",wagonTurn:0};
  const turnElapsed=faceElapsed-plan.faceDuration;
  if (turnElapsed < plan.turnDuration) return {stage:"turning",progress:turnElapsed/plan.turnDuration,
    position:plan.stagingDestination,wagon:plan.circleWagon,facing:"left",wagonTurn:turnElapsed/plan.turnDuration};
  const pushElapsed=turnElapsed-plan.turnDuration;
  if (pushElapsed < plan.pushDuration) {
    const progress=pushElapsed/plan.pushDuration;
    return {stage:"pushing",progress,
      position:{x:plan.stagingDestination.x+(plan.destination.x-plan.stagingDestination.x)*progress,y:plan.destination.y},
      wagon:{x:plan.circleWagon.x+(plan.parkedWagon.x-plan.circleWagon.x)*progress,y:plan.destination.y},
      facing:"left",wagonTurn:1};
  }
  return {stage:"ready",progress:1,position:plan.destination,wagon:plan.parkedWagon,facing:"right",wagonTurn:1};
}

/** A viewport change keeps the current stage instead of replaying the entrance. */
export function merchantElapsedAt(plan: MerchantJourney, progress: MerchantProgress) {
  const fraction=Math.max(0,Math.min(1,progress.progress));
  if (progress.stage === "entering") return fraction*plan.enterDuration;
  if (progress.stage === "circling") return plan.enterDuration+fraction*plan.circleDuration;
  if (progress.stage === "facing") return plan.enterDuration+plan.circleDuration+fraction*plan.faceDuration;
  if (progress.stage === "turning") return plan.enterDuration+plan.circleDuration+plan.faceDuration+fraction*plan.turnDuration;
  if (progress.stage === "pushing") return plan.enterDuration+plan.circleDuration+plan.faceDuration+plan.turnDuration+fraction*plan.pushDuration;
  return plan.duration;
}

export function startMerchantJourney(plan: MerchantJourney, step: (pose: MerchantPose) => void, arrive: () => void,
  frames: RoomFrames = createRoomFrameClock(), resume: MerchantProgress = {stage:"entering",progress:0}) {
  const start=frames.now(), offset=merchantElapsedAt(plan,resume);
  let frame=0, stopped=false;
  const tick=(time: number) => {
    if (stopped) return;
    const pose=merchantPoseAt(plan,offset+Math.max(0,time-start));
    step(pose);
    if (stopped) return;
    if (pose.stage === "ready") { stopped=true; arrive(); }
    else frame=frames.request(tick);
  };
  frame=frames.request(tick);
  return () => { stopped=true; frames.cancel(frame); };
}
