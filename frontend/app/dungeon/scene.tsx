"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { getRelicDefinition } from "../relics";
import type { LootType, MonsterType } from "../practice/engine";
import { isRoomPoint, movementFacing, roomLootPoint, startRoomWalk, type Facing, type Point } from "./movement";
import { HIGHER_TIER_ART, type DungeonEnemyArt } from "./tier-art";

export type { Point } from "./movement";
export type SceneCue = "attack" | "storm" | "potion" | "critical" | "revive" | null;
export type RoomLoot = { type: LootType; amount: number; gold: number; relicId: number };
/** Presentation boundary: confirmed values only, no wallet/RPC/engine imports. */
export type RoomView = {
  room: number; seed?: number; enemy: MonsterType; enemyName: string; enemyHp: number;
  hp: number; relic: number; weapon: number; armor: number;
  phase: "explore" | "combat" | "loot" | "recovery" | "reward" | "won" | "lost";
  loot?: RoomLoot;
  pending: boolean; cue: SceneCue; cueId: number; damage: number; incoming: number;
};
type WalkGoal = { target: Point; destination?: "enemy" | "door" | "merchant" | "loot" };
export type RoomActions = { approach: () => void; enter: () => void; collect?: () => void; skipLoot?: () => void; merchant?: () => void; interact?: () => void };
export const ENEMY_ART = [
  { name: "Grave Belle", role: "Zombie", src: "/monsters/zombie-1-grave-belle.webp", width: 1672, height: 941, roomHeight: 120,
    crop: "565 30 490 770", outline: "M590 777 L615 691 640 608 674 552 712 498 742 451 751 409 776 378 754 331 713 364 694 405 683 449 662 477 640 477 619 466 618 444 637 387 661 346 700 311 716 272 744 241 694 230 671 201 679 146 716 84 748 55 822 47 863 63 889 103 914 156 919 185 877 204 893 218 919 221 941 273 956 324 974 368 981 416 998 451 1033 474 1039 503 1013 535 1004 512 998 493 983 486 981 517 967 523 956 502 955 478 941 447 932 421 927 464 912 478 916 541 937 599 961 638 978 681 1007 710 1001 755 985 779 936 784 931 772 948 746 956 715 936 680 907 654 874 613 852 583 843 538 817 527 782 571 745 611 707 653 672 694 655 740 659 776 643 788 613 788 Z" },
  { name: "Gary", role: "Goblin", src: "/monsters/goblin-1-gary.webp", width: 766, height: 431, roomHeight: 110,
    crop: "202 35 363 390", outline: "M210 158 L221 155 238 211 249 235 266 244 263 253 280 267 281 278 274 294 256 309 236 304 223 286 231 270 215 265 213 253 226 242 214 214 Z M229 110 L265 115 292 130 300 104 304 76 321 85 316 56 337 76 355 42 355 71 380 54 368 79 398 75 410 99 444 91 506 61 510 65 487 91 468 124 468 151 450 168 476 177 498 205 521 218 531 242 535 258 550 275 559 299 549 314 533 320 531 303 539 291 526 285 514 297 504 312 491 306 490 285 501 269 496 248 477 238 457 233 453 266 470 287 474 311 495 334 499 355 520 374 536 396 533 413 507 418 478 417 466 405 464 378 456 366 442 354 427 345 416 330 402 340 391 352 380 332 364 356 351 348 337 355 327 367 314 376 298 397 277 403 258 399 252 388 264 375 288 366 306 349 300 329 308 300 327 280 333 263 315 244 298 229 287 207 287 175 260 160 Z" },
  { name: "Thud", role: "Orc", src: "/monsters/orc-1-thud.webp", width: 1672, height: 941, roomHeight: 146,
    crop: "482 142 608 630", outline: "M495 426 L511 402 531 382 552 387 574 409 595 452 616 500 626 524 652 520 668 506 679 469 702 431 707 380 736 330 737 303 725 271 748 284 763 248 782 218 799 181 824 151 854 165 878 175 882 185 853 190 850 208 874 230 907 234 918 230 907 257 922 278 965 281 1007 310 1037 350 1051 396 1065 439 1069 475 1061 504 1073 538 1069 578 1053 607 1031 619 1015 609 1032 585 1029 570 1014 591 997 593 1000 569 986 558 980 579 969 566 973 536 990 515 1002 508 994 466 965 429 951 466 955 523 972 568 972 611 984 648 977 693 1002 733 1006 754 991 763 918 761 902 749 913 728 923 694 910 664 896 652 881 610 868 610 855 643 835 629 821 643 809 619 785 611 775 637 760 645 764 678 756 704 732 736 678 742 650 733 655 719 688 699 712 682 710 650 708 616 708 587 721 555 711 539 688 558 675 578 674 599 659 617 647 606 629 597 611 595 603 578 585 566 588 544 602 533 581 509 552 490 521 469 Z" },
  { name: "Dungeon Lord", role: "Management", src: "/monsters/boss-1-dungeon-lord.webp", width: 1672, height: 941, roomHeight: 178,
    crop: "437 25 790 905", outline: "M648 856 L672 823 690 792 693 745 700 679 698 616 671 555 654 488 623 442 573 428 539 390 510 345 487 306 459 272 457 237 501 212 528 217 563 201 588 212 626 240 655 230 677 216 707 233 735 216 758 208 761 188 752 156 757 101 776 66 814 40 853 35 880 60 886 90 910 104 901 119 927 137 907 158 914 176 897 196 873 206 883 219 919 216 939 178 956 213 980 226 999 206 998 240 1043 245 1019 261 1026 287 1047 311 1065 335 1093 347 1107 332 1117 301 1137 286 1149 294 1143 322 1172 322 1197 337 1203 350 1191 372 1156 380 1124 376 1093 387 1057 382 1022 366 1006 420 1019 478 1029 537 1042 586 1056 661 1058 705 1034 690 1013 645 996 619 986 700 978 756 979 804 1008 833 1005 881 993 912 961 923 929 905 912 869 916 833 902 793 874 732 850 673 827 645 810 687 793 739 781 792 789 827 778 858 735 869 685 877 656 870 Z" },
] as const;

export function getEnemyArt(type: MonsterType, room = 1): DungeonEnemyArt {
  const tier = Math.max(0, Math.min(3, Math.floor((room - 1) / 10)));
  return tier === 0 ? ENEMY_ART[type] : HIGHER_TIER_ART[type][tier - 1];
}

export function EnemySprite({ type, room = 1, className }: { type: MonsterType; room?: number; className?: string }) {
  const id = useId(), art = getEnemyArt(type,room);
  return <svg className={className} viewBox={art.crop} aria-hidden="true">
    <defs><clipPath id={id}><path d={art.outline} />{type === 1 && room <= 10 && <path d="M259 264 L280 252 301 230 332 235 330 260 303 278 278 287 262 282Z" />}</clipPath></defs>
    <image href={art.src} width={art.width} height={art.height} clipPath={`url(#${id})`} />
  </svg>;
}

/** Keep the original merchant painting; clip its background just like enemies. */
export function MerchantSprite() {
  const id=useId();
  return <svg viewBox="399 94 575 836" aria-hidden="true">
    <defs><clipPath id={id}><path d="M645 150 Q653 111 704 109 Q754 97 778 148 L779 190 Q804 199 796 235 L823 234 Q910 259 950 322 Q982 376 954 410 L919 451 L910 486 Q939 523 949 583 Q947 619 928 630 L861 656 L859 748 L824 804 L824 844 Q845 880 819 913 Q786 929 743 915 L733 898 L733 866 L721 826 L698 785 L674 764 L642 785 L628 839 L624 867 Q592 885 546 882 L513 869 Q504 853 530 845 L568 827 L581 794 L564 758 L540 699 L510 674 L489 675 L478 650 Q425 648 412 617 L420 579 L430 535 L447 502 L470 503 L477 471 L487 408 L497 376 L470 368 Q435 360 426 332 L423 291 L420 266 L424 249 L433 232 L447 222 L443 195 L462 191 L486 194 L479 227 L491 239 L494 269 L511 280 L548 279 L572 259 L600 244 L626 241 L650 218 L646 188Z" /></clipPath></defs>
    <image href="/characters/merchant-quartermaster-kevin.webp" width="1672" height="941" clipPath={`url(#${id})`} />
  </svg>;
}

export function AvatarSprite() {
  const id = useId();
  return <svg viewBox="0 0 1230 1278" aria-hidden="true" className="dungeon-avatar-art">
    <defs><filter id={id} colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  20 20 20 0 -0.1" result="alpha" />
      <feComposite in="SourceGraphic" in2="alpha" operator="in" />
    </filter></defs>
    <image href="/dungeon/adventurer.webp" width="1230" height="1278" filter={`url(#${id})`} />
  </svg>;
}

const ENTRY = { x: 420, y: 496 }, STAGING = { x: 400, y: 391 }, DOOR = { x: 450, y: 92 };
const GUARD = { x: DOOR.x, y: 236 }, DOOR_HALF_WIDTH = 65;
const LOOT_ART = {
  0: "/assets/delveworn-gold-coin.webp",
  1: "/dungeon/loot/potion.webp",
  2: "/assets/delveworn-gold-coin.webp",
  3: "/dungeon/loot/weapon.webp",
  4: "/dungeon/loot/armor.webp",
} as const;
export function roomLootLabel(loot: RoomLoot): string {
  const extra = loot.type === 1 ? "+1 potion" : loot.type === 3 ? "Weapon +1" : loot.type === 4 ? "Armor +1" : "";
  return [loot.gold > 0 ? `${loot.gold} gold` : "", extra, loot.relicId > 0 ? "Boss relic" : ""].filter(Boolean).join(" · ");
}
export function nearRoomLoot(point: Point, lootPoint: Point) { return Math.hypot(point.x-lootPoint.x,point.y-lootPoint.y) <= 32; }
function inDoorLane(point: Point) { return Math.abs(point.x - DOOR.x) < DOOR_HALF_WIDTH; }
export function clampRoomPoint(point: Point, cleared: boolean): Point {
  const door = cleared && inDoorLane(point) && point.y < 190;
  // Stop in front of the living guard when walking toward the north door.
  const northEdge = !cleared && inDoorLane(point) ? GUARD.y + 90 : door ? DOOR.y : 194;
  return { x: Math.max(170, Math.min(733, point.x)), y: Math.max(northEdge, Math.min(505, point.y)) };
}

export function roomMerchantPoint(bounds = {minX:170,maxX:733}, room = 5): Point {
  return {x:room % 10 === 9 ? bounds.maxX : bounds.minX,y:320};
}

export function roomMerchantApproach(merchant: Point): Point {
  return {x:merchant.x+(merchant.x < 450 ? 48 : -48),y:merchant.y+36};
}

export function roomFloorTarget(point: Point, cleared: boolean, enemy: MonsterType, lootPoint?: Point, merchantPoint?: Point, room = 1): { point: Point; destination?: "enemy" | "door" | "loot" | "merchant" } {
  const door = inDoorLane(point) && point.y <= 130;
  const guard = Math.abs(point.x - GUARD.x) < 90 && point.y >= GUARD.y - getEnemyArt(enemy,room).roomHeight - 15 && point.y <= GUARD.y + 25;
  if (!cleared && (door || guard)) return { point: STAGING, destination: "enemy" };
  const lootImage = lootPoint && Math.abs(point.x-lootPoint.x) <= 45 && point.y >= lootPoint.y-80 && point.y <= lootPoint.y+25;
  const merchantHit = merchantPoint && Math.abs(point.x-merchantPoint.x) <= 48 && point.y >= merchantPoint.y-150 && point.y <= merchantPoint.y+22;
  if (cleared && lootPoint && (door || lootImage || merchantHit || nearRoomLoot(point,lootPoint))) return { point: lootPoint, destination: "loot" };
  if (cleared && door) return { point: DOOR, destination: "door" };
  if (cleared && !lootPoint && merchantHit) return {point:roomMerchantApproach(merchantPoint),destination:"merchant"};
  return { point };
}

/** The portrait camera may crop the room, but never enlarge tier-one actors. */
export function portraitRoomCamera(width: number, height: number) {
  const scale = Math.max(Math.max(1,width)/900,Math.max(1,height)/600);
  const actorScale = Math.min(1,.65/scale);
  const left = (900-width/scale)/2;
  const margin=88*actorScale+12/scale;
  return { actorScale, minX:Math.max(170,left+margin), maxX:Math.min(733,900-left-margin) };
}

/** Ignore hidden/transient layout samples instead of displacing the player. */
export function measuredRoomCamera(width: number, height: number, portrait: boolean) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const next=portrait ? portraitRoomCamera(width,height) : {actorScale:1,minX:170,maxX:733};
  return next.minX <= next.maxX ? next : null;
}

/** Mount with a confirmed run/room key. Recovery never trusts saved coordinates. */
export function DungeonScene({ view, actions, children, topOverlay, footer, presentationOverlay }: { view: RoomView; actions: RoomActions; children?: ReactNode; topOverlay?: ReactNode; footer?: ReactNode; presentationOverlay?: ReactNode }) {
  const [position, setPosition] = useState<Point>(view.phase === "explore" ? ENTRY : STAGING);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<Facing>("right");
  const point = useRef(position), stopWalk = useRef<(() => void) | null>(null);
  const walkGoal = useRef<WalkGoal | null>(null);
  const continueWalk = useRef<((goal: WalkGoal, bounds: ReturnType<typeof portraitRoomCamera>) => void) | null>(null);
  const latest = useRef({ view, actions });
  useEffect(() => { latest.current = { view, actions }; }, [view, actions]);
  const svg = useRef<SVGSVGElement>(null), pointer = useRef<Point | null>(null);
  const [camera,setCamera] = useState({actorScale:1,minX:170,maxX:733});
  const lootPoint = roomLootPoint(view.seed ?? 0,view.room,camera);
  const currentLootPoint = useRef(lootPoint);
  useEffect(() => { currentLootPoint.current=lootPoint; },[lootPoint]);
  const relic = getRelicDefinition(view.relic);
  const cleared = view.enemyHp === 0;
  const relicClip = useId();
  const loot = view.phase === "loot" ? view.loot : undefined;
  const hasRoomHud=Boolean(topOverlay);
  const hasMerchant=view.phase === "recovery" && Boolean(actions.merchant);
  const merchantPoint=hasMerchant ? roomMerchantPoint(camera,view.room) : undefined;
  // Reuse the engine's ten-room tier cadence; tier-four art continues in deep runs.
  const art = getEnemyArt(view.enemy,view.room), spriteHeight = art.roomHeight;
  const [, , cropWidth, cropHeight] = art.crop.split(" ").map(Number);
  const spriteWidth = spriteHeight * cropWidth / cropHeight;
  const impact = { x: GUARD.x, y: GUARD.y - spriteHeight * camera.actorScale * .55 };

  useEffect(() => {
    const element=svg.current;
    if (!element || !hasRoomHud) return;
    const portrait=window.matchMedia("(max-width:760px)");
    let previousCamera: typeof camera | undefined;
    const update=() => {
      const rect=element.getBoundingClientRect();
      const next=measuredRoomCamera(rect.width,rect.height,portrait.matches);
      if (!next) return;
      const changed = previousCamera && (previousCamera.actorScale !== next.actorScale || previousCamera.minX !== next.minX || previousCamera.maxX !== next.maxX);
      previousCamera=next;
      setCamera(previous => previous.actorScale === next.actorScale && previous.minX === next.minX && previous.maxX === next.maxX ? previous : next);
      const x=Math.max(next.minX,Math.min(next.maxX,point.current.x));
      if (changed || x !== point.current.x) {
        const goal=walkGoal.current;
        stopWalk.current?.(); stopWalk.current=null; walkGoal.current=null; setWalking(false);
        if (x !== point.current.x) { point.current={...point.current,x}; setPosition(point.current); }
        // Browser chrome can resize the floor while walking. Continue toward
        // the same intent using the new camera, including the moved loot drop.
        currentLootPoint.current=roomLootPoint(latest.current.view.seed ?? 0,latest.current.view.room,next);
        if (goal) continueWalk.current?.(goal,next);
      }
    };
    const observer=new ResizeObserver(update);
    observer.observe(element); portrait.addEventListener("change",update);
    return () => { observer.disconnect(); portrait.removeEventListener("change",update); };
  },[hasRoomHud]);

  useEffect(() => {
    const stop = () => { stopWalk.current?.(); stopWalk.current=null; walkGoal.current=null; setWalking(false); };
    window.addEventListener("blur",stop);
    window.addEventListener("pagehide",stop);
    document.addEventListener("visibilitychange",stop);
    return () => { stopWalk.current?.(); window.removeEventListener("blur",stop); window.removeEventListener("pagehide",stop); document.removeEventListener("visibilitychange",stop); };
  }, []);

  function moveTo(target: Point, destination?: WalkGoal["destination"], interact = true, bounds = camera) {
    const {view: currentView,actions: currentActions}=latest.current;
    if (currentView.pending || !["explore","loot","recovery"].includes(currentView.phase) || !isRoomPoint(target)) return;
    if (interact) currentActions.interact?.();
    stopWalk.current?.();
    const next = clampRoomPoint({...target,x:Math.max(bounds.minX,Math.min(bounds.maxX,target.x))},currentView.enemyHp === 0);
    walkGoal.current={target,destination};
    setFacing(previous => movementFacing(point.current,next,previous)); setWalking(true);
    stopWalk.current=startRoomWalk(point.current,next,step => {
      const current=latest.current;
      if (current.view.pending || !["explore","loot","recovery"].includes(current.view.phase)) { stopWalk.current=null; walkGoal.current=null; setWalking(false); return false; }
      point.current=step; setPosition(step);
      if (current.view.phase === "loot" && current.view.loot && nearRoomLoot(step,currentLootPoint.current)) {
        stopWalk.current=null; walkGoal.current=null; setWalking(false); current.actions.collect?.(); return false;
      }
    },() => {
      stopWalk.current = null; walkGoal.current=null; setWalking(false);
      const current = latest.current;
      if (current.view.pending) return;
      if (current.view.phase === "explore" && (destination === "enemy" || Math.hypot(next.x-GUARD.x,next.y-GUARD.y) < 125)) {
        setFacing(previous => movementFacing(next,GUARD,previous)); current.actions.approach();
      }
      else if (current.view.phase === "recovery" && (destination === "door" || (next.y <= 130 && inDoorLane(next)))) current.actions.enter();
      else if (current.view.phase === "recovery" && current.actions.merchant
        && (destination === "merchant" || Math.hypot(next.x-roomMerchantPoint(bounds,current.view.room).x,next.y-roomMerchantPoint(bounds,current.view.room).y) <= 64)) {
        setFacing(previous => movementFacing(next,roomMerchantPoint(bounds,current.view.room),previous)); current.actions.merchant();
      }
    });
  }

  function skipLoot() {
    const current=latest.current;
    if (current.view.pending || current.view.phase !== "loot" || !current.actions.skipLoot) return;
    stopWalk.current?.(); stopWalk.current=null; walkGoal.current=null; setWalking(false);
    current.actions.skipLoot();
  }

  useEffect(() => {
    continueWalk.current=(goal,bounds) => {
      const current=latest.current.view;
      const merchant=roomMerchantPoint(bounds,current.room);
      const target=goal.destination === "loot" ? roomLootPoint(current.seed ?? 0,current.room,bounds)
        : goal.destination === "merchant" ? roomMerchantApproach(merchant) : goal.target;
      moveTo(target,goal.destination,false,bounds);
    };
  });


  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!["explore","loot","recovery"].includes(view.phase)) return;
    const moves: Record<string,Point> = { ArrowLeft:{x:-42,y:0},a:{x:-42,y:0},ArrowRight:{x:42,y:0},d:{x:42,y:0},ArrowUp:{x:0,y:-42},w:{x:0,y:-42},ArrowDown:{x:0,y:42},s:{x:0,y:42} };
    const delta = moves[event.key];
    if (delta) { event.preventDefault(); moveTo({x:point.current.x+delta.x,y:point.current.y+delta.y}); }
    if ((event.key === "Enter" || event.key.toLowerCase() === "e") && !event.repeat) {
      event.preventDefault(); moveTo(loot ? lootPoint : cleared ? DOOR : STAGING,loot ? "loot" : cleared ? "door" : "enemy");
    }
  }
  function floor(event: PointerEvent<SVGSVGElement>) {
    const start = pointer.current; pointer.current = null;
    if (!start || Math.hypot(event.clientX-start.x,event.clientY-start.y) > 12) return;
    const matrix = svg.current?.getScreenCTM(); if (!matrix) return;
    // A browser viewport change can temporarily yield a singular SVG matrix.
    // Reject it before it can poison the avatar position and all later walks.
    let p: DOMPoint;
    try { p = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()); }
    catch { return; }
    if (!isRoomPoint(p)) return;
    svg.current?.focus({preventScroll:true});
    const target = roomFloorTarget(p,cleared,view.enemy,loot ? lootPoint : undefined,merchantPoint,view.room);
    moveTo(target.point,target.destination);
  }

  return <div className={`dungeon-scene-wrap ${view.phase} ${view.enemy === 3 ? "boss-room" : ""} ${children ? "has-overlay" : ""} ${topOverlay ? "has-room-hud" : ""}`} data-room-scene data-room={view.room}>
    {topOverlay && <div className="dungeon-scene-top-overlay">{topOverlay}</div>}
    <svg ref={svg} viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" className="dungeon-scene" tabIndex={0} role="group" aria-label={`Room ${view.room} floor. Arrow keys or WASD to walk; E to ${loot ? "pick up loot" : cleared ? "use the door" : "approach the enemy"}.`}
      onKeyDown={keyboard} onPointerDown={e => { pointer.current={x:e.clientX,y:e.clientY}; }} onPointerUp={floor} onPointerCancel={() => {pointer.current=null;}}>
      <image href="/dungeon/stone-room.webp" width="900" height="600" />
      <ellipse className="dungeon-room-tint" cx="450" cy="320" rx="340" ry="225" />
      {cleared && !loot && <g className="dungeon-door-open"><path d="M407 10 Q450 -10 493 10 L493 77 407 77Z" fill="#030205" /><path d="M420 76 L480 76 523 230 377 230Z" fill="#eac170" opacity=".12" /><text x="450" y="115" textAnchor="middle">{view.phase === "won" ? "VICTORY" : "NEXT ROOM ↑"}</text></g>}
      {!cleared && <g transform={`translate(${GUARD.x} ${GUARD.y}) scale(${camera.actorScale}) translate(${-GUARD.x} ${-GUARD.y})`}><g className={`dungeon-enemy ${view.cue && view.cue !== "potion" ? "is-hit" : ""}`} style={{transformOrigin:`${GUARD.x}px ${GUARD.y}px`}} key={`enemy-${view.cueId}`}>
        <ellipse cx={GUARD.x} cy={GUARD.y-3} rx={spriteWidth*.4} ry={spriteHeight*.07} fill="#000" opacity=".62" />
        <svg x={GUARD.x-spriteWidth/2} y={GUARD.y-spriteHeight} width={spriteWidth} height={spriteHeight} overflow="visible"><EnemySprite type={view.enemy} room={view.room} /></svg>
      </g></g>}
      {loot && <g transform={`translate(${lootPoint.x} ${lootPoint.y}) scale(${camera.actorScale}) translate(${-GUARD.x} ${-GUARD.y})`} className="dungeon-loot" data-room-loot={loot.type} data-loot-position={`${lootPoint.x},${lootPoint.y}`} role="img" aria-label={`Loot on the floor: ${roomLootLabel(loot)}. Walk here to collect.`}>
        <ellipse cx={GUARD.x} cy={GUARD.y+4} rx="48" ry="14" fill="#c59742" opacity=".2" />
        <image href={LOOT_ART[loot.type]} x={GUARD.x-34} y={GUARD.y-66} width="68" height="68" />
        {loot.type !== 0 && loot.type !== 2 && loot.gold > 0 && <image href={LOOT_ART[2]} x={GUARD.x+17} y={GUARD.y-20} width="28" height="28" />}
        {loot.relicId > 0 && <image href="/dungeon/loot/pouch.webp" x={GUARD.x+28} y={GUARD.y-45} width="46" height="46" />}
        <text x={GUARD.x} y={GUARD.y-84} textAnchor="middle">{roomLootLabel(loot)}</text>
      </g>}
      {merchantPoint && <g className="dungeon-merchant" data-merchant-facing={merchantPoint.x < 450 ? "right" : "left"} data-merchant-position={`${merchantPoint.x},${merchantPoint.y}`} role="img" aria-label="Quartermaster Kevin. Walk here to trade." transform={`translate(${merchantPoint.x} ${merchantPoint.y}) scale(${camera.actorScale})`}>
        <ellipse cx="0" cy="1" rx="42" ry="12" fill="#000" opacity=".55" />
        <g transform={`scale(${merchantPoint.x < 450 ? -1 : 1} 1)`}>
          <svg x="-52" y="-150" width="104" height="150" overflow="visible"><MerchantSprite /></svg>
        </g>
        <text x="0" y="24" textAnchor="middle">KEVIN</text>
      </g>}
      <g className="dungeon-actor-position" style={{transform:`translate(${position.x}px,${position.y}px)`}} data-avatar-position={`${position.x},${position.y}`} data-avatar-facing={facing}><g transform={`scale(${camera.actorScale})`}>
        <ellipse cx="0" cy="0" rx="43" ry="13" fill="#000" opacity=".64" />
        <g transform={`scale(${facing === "left" ? -1 : 1} 1)`}>
        <g key={view.cue ? `avatar-${view.cueId}` : "avatar-idle"} className={`dungeon-avatar ${walking ? "is-walking" : ""} ${view.hp === 0 ? "is-dead" : ""} ${view.cue === "attack" || view.cue === "critical" ? "is-attacking" : ""} ${view.incoming && view.cue ? "takes-hit" : ""}`}>
          <svg x="-70" y="-151" width="158" height="164" overflow="visible"><AvatarSprite /></svg>
          {view.armor > 0 && <circle cx="5" cy="-66" r="29" fill="none" stroke="#ddb36f" strokeWidth="2" opacity=".42" />}
          {view.weapon > 0 && <path d="M34 -57 L66 -92" stroke="#f9dea3" strokeWidth="2" opacity=".8" />}
        </g>
        </g>
        {view.relic > 0 && <g className={`dungeon-relic ${view.cue ? "is-active" : ""}`} data-avatar-relic={view.relic}>
          <defs><clipPath id={relicClip}><circle cx="-45" cy="-100" r="17" /></clipPath></defs>
          <circle cx="-45" cy="-100" r="23" fill={view.relic === 6 ? "#c99cff" : "#eac17b"} opacity=".2" />
          <image href={relic.imageSrc ?? undefined} x="-63" y="-118" width="36" height="36" clipPath={`url(#${relicClip})`} />
        </g>}
        {(view.cue === "potion" || view.cue === "revive") && <g key={`heal-${view.cueId}`} className="dungeon-heal"><ellipse cx="0" cy="-3" rx="53" ry="21" /><text x="0" y="-164" textAnchor="middle">{view.cue === "revive" ? "REVIVED" : "+ HEAL"}</text></g>}
        {view.cue && view.incoming > 0 && <text key={`reply-${view.cueId}`} x="-36" y="-150" className="dungeon-damage incoming">−{view.incoming}</text>}
      </g></g>
      {(view.cue === "storm" || view.cue === "critical" || view.cue === "attack") && <g key={`fx-${view.cueId}`} className={`dungeon-impact ${view.cue}`}>
        {view.cue === "storm" ? <path d={`M${position.x-45} ${position.y-100} L${impact.x-58} ${impact.y+55} ${impact.x-66} ${impact.y+38} ${impact.x-19} ${impact.y+22} ${impact.x-31} ${impact.y+8} ${impact.x} ${impact.y}`} fill="none" stroke="#dbb3ff" strokeWidth="5" /> : <path d={`M${impact.x-32} ${impact.y+32} Q${impact.x+8} ${impact.y+8} ${impact.x+37} ${impact.y-34}`} stroke="#ffe5ac" strokeWidth="6" fill="none" />}
        <text x={GUARD.x} y={GUARD.y-spriteHeight*camera.actorScale-12} textAnchor="middle" className="dungeon-damage">{view.cue === "critical" ? "CRIT " : ""}{view.damage}</text>
      </g>}
    </svg>
    {presentationOverlay && <div className="dungeon-scene-presentation">{presentationOverlay}</div>}
    <div className="dungeon-scene-bottom">
    {footer && <div className="dungeon-scene-footer">{footer}</div>}
    {children && <div className="dungeon-scene-overlay">{children}</div>}
    <div className="dungeon-floor-controls">
      {view.phase === "explore" && <button onClick={() => moveTo(STAGING,"enemy")} disabled={view.pending}>Approach {view.enemyName} <span>↗</span></button>}
      {loot && <><button onClick={() => moveTo(lootPoint,"loot")} disabled={view.pending}>Pick up loot <span>↑</span></button>{actions.skipLoot && <button onClick={skipLoot} disabled={view.pending}>Leave loot</button>}</>}
      {view.phase === "recovery" && <><button onClick={() => moveTo(DOOR,"door")} disabled={view.pending}>Enter room {view.room+1} <span>↑</span></button>{merchantPoint && <button onClick={() => moveTo(roomMerchantApproach(merchantPoint),"merchant")} disabled={view.pending}>Visit Kevin</button>}</>}
      {view.phase === "combat" && !children && <span>Your turn · Choose an action below</span>}
      {view.phase === "lost" && <span>The dungeon keeps its appointment.</span>}
    </div>
    {!children && <p className="dungeon-controls-help">Tap the floor to walk · Arrow keys / WASD · E to interact</p>}
    </div>
  </div>;
}
