"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { getRelicDefinition } from "../relics";
import type { MonsterType } from "../practice/engine";

export type Point = { x: number; y: number };
export type SceneCue = "attack" | "storm" | "potion" | "critical" | "revive" | null;
/** Presentation boundary: confirmed values only, no wallet/RPC/engine imports. */
export type RoomView = {
  room: number; enemy: MonsterType; enemyName: string; enemyHp: number;
  hp: number; relic: number; weapon: number; armor: number;
  phase: "explore" | "combat" | "recovery" | "reward" | "won" | "lost";
  pending: boolean; cue: SceneCue; cueId: number; damage: number; incoming: number;
};
export type RoomActions = { approach: () => void; enter: () => void; merchant?: () => void; interact?: () => void };
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

export function EnemySprite({ type, className }: { type: MonsterType; className?: string }) {
  const id = useId(), art = ENEMY_ART[type];
  return <svg className={className} viewBox={art.crop} aria-hidden="true">
    <defs><clipPath id={id}><path d={art.outline} />{type === 1 && <path d="M259 264 L280 252 301 230 332 235 330 260 303 278 278 287 262 282Z" />}</clipPath></defs>
    <image href={art.src} width={art.width} height={art.height} clipPath={`url(#${id})`} />
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
function inDoorLane(point: Point) { return Math.abs(point.x - DOOR.x) < DOOR_HALF_WIDTH; }
export function clampRoomPoint(point: Point, cleared: boolean): Point {
  const door = cleared && inDoorLane(point) && point.y < 190;
  // Stop in front of the living guard when walking toward the north door.
  const northEdge = !cleared && inDoorLane(point) ? GUARD.y + 90 : door ? DOOR.y : 194;
  return { x: Math.max(170, Math.min(733, point.x)), y: Math.max(northEdge, Math.min(505, point.y)) };
}

export function roomFloorTarget(point: Point, cleared: boolean, enemy: MonsterType): { point: Point; destination?: "enemy" | "door" } {
  const door = inDoorLane(point) && point.y <= 130;
  const guard = Math.abs(point.x - GUARD.x) < 90 && point.y >= GUARD.y - ENEMY_ART[enemy].roomHeight - 15 && point.y <= GUARD.y + 25;
  if (!cleared && (door || guard)) return { point: STAGING, destination: "enemy" };
  if (cleared && door) return { point: DOOR, destination: "door" };
  return { point };
}

/** Mount with a confirmed run/room key. Recovery never trusts saved coordinates. */
export function DungeonScene({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const [position, setPosition] = useState<Point>(view.phase === "explore" ? ENTRY : STAGING);
  const [walking, setWalking] = useState(false);
  const point = useRef(position), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ view, actions });
  useEffect(() => { latest.current = { view, actions }; }, [view, actions]);
  const svg = useRef<SVGSVGElement>(null), pointer = useRef<Point | null>(null);
  const relic = getRelicDefinition(view.relic);
  const cleared = view.enemyHp === 0;
  const relicClip = useId();
  // First Descent uses tier 1 art throughout. Keep a modest base scale so later
  // tiers can grow without making early zombies tower over the adventurer.
  const art = ENEMY_ART[view.enemy], spriteHeight = art.roomHeight;
  const [, , cropWidth, cropHeight] = art.crop.split(" ").map(Number);
  const spriteWidth = spriteHeight * cropWidth / cropHeight;
  const impact = { x: GUARD.x, y: GUARD.y - spriteHeight * .55 };

  useEffect(() => {
    const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setWalking(false); };
    window.addEventListener("blur",stop);
    document.addEventListener("visibilitychange",stop);
    return () => { if (timer.current) clearTimeout(timer.current); window.removeEventListener("blur",stop); document.removeEventListener("visibilitychange",stop); };
  }, []);

  function moveTo(target: Point, destination?: "enemy" | "door" | "merchant") {
    if (view.pending || !["explore","recovery"].includes(view.phase)) return;
    actions.interact?.();
    if (timer.current) clearTimeout(timer.current);
    const next = clampRoomPoint(target,cleared);
    const duration = Math.max(220,Math.min(750,Math.hypot(next.x-point.current.x,next.y-point.current.y)*2));
    point.current = next; setPosition(next); setWalking(true);
    if (svg.current) svg.current.style.setProperty("--walk-time",`${duration}ms`);
    timer.current = setTimeout(() => {
      timer.current = null; setWalking(false);
      const current = latest.current;
      if (current.view.pending) return;
      if (current.view.phase === "explore" && (destination === "enemy" || Math.hypot(next.x-GUARD.x,next.y-GUARD.y) < 125)) {
        point.current = STAGING; setPosition(STAGING); current.actions.approach();
      } else if (current.view.phase === "recovery" && (destination === "door" || (next.y <= 130 && inDoorLane(next)))) current.actions.enter();
      else if (destination === "merchant") current.actions.merchant?.();
    },duration);
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    const moves: Record<string,Point> = { ArrowLeft:{x:-42,y:0},a:{x:-42,y:0},ArrowRight:{x:42,y:0},d:{x:42,y:0},ArrowUp:{x:0,y:-42},w:{x:0,y:-42},ArrowDown:{x:0,y:42},s:{x:0,y:42} };
    const delta = moves[event.key];
    if (delta) { event.preventDefault(); moveTo({x:point.current.x+delta.x,y:point.current.y+delta.y}); }
    if ((event.key === "Enter" || event.key.toLowerCase() === "e") && !event.repeat) {
      event.preventDefault(); moveTo(cleared ? DOOR : STAGING,cleared ? "door" : "enemy");
    }
  }
  function floor(event: PointerEvent<SVGSVGElement>) {
    const start = pointer.current; pointer.current = null;
    if (!start || Math.hypot(event.clientX-start.x,event.clientY-start.y) > 12) return;
    const matrix = svg.current?.getScreenCTM(); if (!matrix) return;
    const p = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    svg.current?.focus({preventScroll:true});
    const target = roomFloorTarget(p,cleared,view.enemy);
    moveTo(target.point,target.destination);
  }

  return <div className={`dungeon-scene-wrap ${view.phase} ${view.room === 10 ? "boss-room" : ""}`} data-room-scene data-room={view.room}>
    <svg ref={svg} viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" className="dungeon-scene" tabIndex={0} role="group" aria-label={`Room ${view.room} floor. Arrow keys or WASD to walk; E to ${cleared ? "use the door" : "approach the enemy"}.`}
      onKeyDown={keyboard} onPointerDown={e => { pointer.current={x:e.clientX,y:e.clientY}; }} onPointerUp={floor} onPointerCancel={() => {pointer.current=null;}}>
      <image href="/dungeon/stone-room.webp" width="900" height="600" />
      <ellipse className="dungeon-room-tint" cx="450" cy="320" rx="340" ry="225" />
      {cleared && <g className="dungeon-door-open"><path d="M407 10 Q450 -10 493 10 L493 77 407 77Z" fill="#030205" /><path d="M420 76 L480 76 523 230 377 230Z" fill="#eac170" opacity=".12" /><text x="450" y="115" textAnchor="middle">{view.room === 10 ? "VICTORY" : "NEXT ROOM ↑"}</text></g>}
      {!cleared && <g className={`dungeon-enemy ${view.cue && view.cue !== "potion" ? "is-hit" : ""}`} style={{transformOrigin:`${GUARD.x}px ${GUARD.y}px`}} key={`enemy-${view.cueId}`}>
        <ellipse cx={GUARD.x} cy={GUARD.y-3} rx={spriteWidth*.4} ry={spriteHeight*.07} fill="#000" opacity=".62" />
        <svg x={GUARD.x-spriteWidth/2} y={GUARD.y-spriteHeight} width={spriteWidth} height={spriteHeight} overflow="visible"><EnemySprite type={view.enemy} /></svg>
      </g>}
      {cleared && <g aria-hidden="true"><ellipse cx={GUARD.x} cy={GUARD.y-3} rx="36" ry="10" fill="#c59742" opacity=".2" /><text x={GUARD.x} y={GUARD.y-5} textAnchor="middle" fill="#eac170" fontSize="30">✦</text></g>}
      {(view.room === 5 || view.room === 9) && cleared && <g aria-hidden="true" className="dungeon-camp-prop"><circle cx="252" cy="309" r="34" fill="#f5ab42" opacity=".17" />{view.room === 9 ? <g><ellipse cx="252" cy="321" rx="23" ry="8" fill="#30251e" stroke="#89725b" strokeWidth="5" /><path d="M237 317 Q230 302 246 287 Q243 300 253 275 Q274 300 265 316Z" fill="#b65822" /><path d="M244 318 Q239 303 253 288 Q252 301 262 305 L259 319Z" fill="#edab44" /><path d="M249 319 Q245 309 254 302 L258 318Z" fill="#f8dd8c" /></g> : <image href="/assets/loot/potion-v1.webp" x="230" y="282" width="44" height="44" />}<text x="252" y="351" textAnchor="middle" fill="#e9c78a" fontSize="13">{view.room === 9 ? "CAMP" : "SUPPLIES"}</text></g>}
      <g className="dungeon-actor-position" style={{transform:`translate(${position.x}px,${position.y}px)`}} data-avatar-position={`${position.x},${position.y}`}>
        <ellipse cx="0" cy="0" rx="43" ry="13" fill="#000" opacity=".64" />
        <g key={`avatar-${view.cueId}`} className={`dungeon-avatar ${walking ? "is-walking" : ""} ${view.hp === 0 ? "is-dead" : ""} ${view.cue === "attack" || view.cue === "critical" ? "is-attacking" : ""} ${view.incoming && view.cue ? "takes-hit" : ""}`}>
          <svg x="-70" y="-151" width="158" height="164" overflow="visible"><AvatarSprite /></svg>
          {view.armor > 0 && <circle cx="5" cy="-66" r="29" fill="none" stroke="#ddb36f" strokeWidth="2" opacity=".42" />}
          {view.weapon > 0 && <path d="M34 -57 L66 -92" stroke="#f9dea3" strokeWidth="2" opacity=".8" />}
        </g>
        {view.relic > 0 && <g className={`dungeon-relic ${view.cue ? "is-active" : ""}`} data-avatar-relic={view.relic}>
          <defs><clipPath id={relicClip}><circle cx="-45" cy="-100" r="17" /></clipPath></defs>
          <circle cx="-45" cy="-100" r="23" fill={view.relic === 6 ? "#c99cff" : "#eac17b"} opacity=".2" />
          <image href={relic.imageSrc ?? undefined} x="-63" y="-118" width="36" height="36" clipPath={`url(#${relicClip})`} />
        </g>}
        {(view.cue === "potion" || view.cue === "revive") && <g key={`heal-${view.cueId}`} className="dungeon-heal"><ellipse cx="0" cy="-3" rx="53" ry="21" /><text x="0" y="-164" textAnchor="middle">{view.cue === "revive" ? "REVIVED" : "+ HEAL"}</text></g>}
        {view.cue && view.incoming > 0 && <text key={`reply-${view.cueId}`} x="-36" y="-150" className="dungeon-damage incoming">−{view.incoming}</text>}
      </g>
      {(view.cue === "storm" || view.cue === "critical" || view.cue === "attack") && <g key={`fx-${view.cueId}`} className={`dungeon-impact ${view.cue}`}>
        {view.cue === "storm" ? <path d={`M${position.x-45} ${position.y-100} L${impact.x-58} ${impact.y+55} ${impact.x-66} ${impact.y+38} ${impact.x-19} ${impact.y+22} ${impact.x-31} ${impact.y+8} ${impact.x} ${impact.y}`} fill="none" stroke="#dbb3ff" strokeWidth="5" /> : <path d={`M${impact.x-32} ${impact.y+32} Q${impact.x+8} ${impact.y+8} ${impact.x+37} ${impact.y-34}`} stroke="#ffe5ac" strokeWidth="6" fill="none" />}
        <text x={GUARD.x} y={GUARD.y-spriteHeight-12} textAnchor="middle" className="dungeon-damage">{view.cue === "critical" ? "CRIT " : ""}{view.damage}</text>
      </g>}
    </svg>
    <div className="dungeon-floor-controls">
      {view.phase === "explore" && <button onClick={() => moveTo(STAGING,"enemy")} disabled={view.pending || walking}>Approach {view.enemyName} <span>↗</span></button>}
      {view.phase === "recovery" && <><button onClick={() => moveTo(DOOR,"door")} disabled={view.pending || walking}>Walk to room {view.room+1} <span>↑</span></button>{actions.merchant && <button onClick={() => moveTo({x:298,y:343},"merchant")} disabled={walking || view.pending}>Visit Kevin</button>}</>}
      {view.phase === "combat" && <span>Your turn · Choose an action below</span>}
      {view.phase === "lost" && <span>The dungeon keeps its appointment.</span>}
    </div>
    <p className="dungeon-controls-help">Tap the floor to walk · Arrow keys / WASD · E to interact</p>
  </div>;
}
