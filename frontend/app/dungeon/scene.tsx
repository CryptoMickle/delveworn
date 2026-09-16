"use client";

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { getRelicDefinition } from "../relics";
import type { LootType, MonsterType } from "../practice/engine";
import { createRoomSteering, isRoomPoint, movementFacing, roomLootPoint, roomMovementKey, startRoomWalk, type Facing, type Point } from "./movement";
import { HIGHER_TIER_ART, type DungeonEnemyArt } from "./tier-art";
import { MERCHANT_ROOM_ART_LAYOUT } from "./merchant-art";
import { createMerchantArrivalGate, RoomMerchant } from "./merchant-room";
import { GoldLootSprite } from "./gold-loot-art";
export { MerchantSprite } from "./merchant-art";

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
/** Walking is presentation only; it never spends a combat turn or rolls RNG. */
function canWalk(view: RoomView) {
  return !view.pending && view.hp > 0 && ["explore","combat","loot","recovery"].includes(view.phase);
}
type WalkGoal = { target: Point; destination?: "enemy" | "door" | "merchant" | "loot" };
export type RoomActions = { approach: () => void; enter: (leaveLoot?: boolean) => void; collect?: () => void; skipLoot?: () => void; merchant?: () => void; interact?: () => void };
export const ENEMY_ART = [
  { name: "Grave Belle", role: "Zombie", src: "/monsters/zombie-1-grave-belle.webp", width: 1672, height: 941, roomHeight: 120,
    crop: "580 35 465 760", outline: "M744 61 C759 36 782 45 799 47 L820 49 839 58 852 70 879 82 871 82 861 78 868 96 883 106 897 103 888 113 877 116 898 124 916 143 922 166 914 158 911 148 913 172 925 168 918 177 906 171 895 151 884 144 894 161 900 180 894 198 886 187 875 198 860 192 852 200 867 211 888 205 904 208 914 220 922 239 927 258 935 273 944 284 937 286 941 301 946 306 951 328 960 345 965 365 976 368 976 390 981 411 985 440 995 457 1009 468 1025 475 1033 479 1037 493 1036 509 1034 519 1027 525 1027 507 1021 491 1010 488 1015 500 1017 513 1012 527 1013 534 1006 538 1003 533 1004 520 1000 508 987 497 976 490 969 496 969 505 974 514 971 524 965 522 959 511 956 500 958 487 959 476 953 462 953 444 949 419 942 409 938 389 930 379 927 357 915 330 905 316 897 297 890 285 894 312 890 335 887 347 893 362 899 366 905 383 910 393 919 405 920 419 931 440 934 458 940 473 938 493 942 521 951 543 948 559 943 547 936 542 938 568 930 558 926 547 919 548 919 530 907 554 905 582 921 591 936 609 949 630 951 644 963 656 966 672 978 687 989 695 999 688 1006 697 1007 712 1001 730 1000 749 1005 761 1004 774 997 781 980 784 947 783 933 781 929 773 934 761 947 750 956 733 958 717 949 704 948 693 934 680 920 665 909 659 895 640 878 627 860 613 851 599 847 582 846 557 847 533 837 552 829 544 821 566 816 561 811 590 806 581 811 558 806 540 799 544 791 540 781 554 770 577 752 598 731 615 712 632 700 651 686 681 673 696 665 721 657 741 652 752 658 767 658 781 649 786 627 787 608 784 592 780 589 772 595 755 602 740 611 723 615 702 621 687 627 658 637 628 644 610 651 589 661 574 674 572 688 558 698 538 709 514 711 503 721 484 727 466 715 469 729 452 743 435 757 418 771 409 777 391 782 377 792 358 789 347 782 336 778 326 765 315 758 304 748 315 738 330 729 341 721 353 712 360 703 365 695 374 684 380 673 379 669 386 674 397 686 411 686 421 692 433 695 443 688 447 683 440 681 430 674 424 667 426 656 446 650 455 650 464 657 467 653 472 646 469 646 477 650 479 650 486 641 481 635 474 629 471 626 460 619 457 616 449 620 437 627 427 631 409 636 395 639 377 649 368 650 352 664 332 683 327 699 314 713 302 713 294 722 284 721 276 735 268 740 249 749 232 761 223 777 217 760 211 743 214 731 225 720 241 716 238 722 232 717 222 708 219 705 231 700 226 700 214 693 201 687 214 689 222 682 219 681 207 687 191 694 176 682 189 680 197 675 182 678 162 691 140 687 136 675 133 669 126 681 130 690 121 695 99 711 84 728 68 Z" },
  { name: "Gary", role: "Goblin", src: "/monsters/goblin-1-gary.webp", width: 766, height: 431, roomHeight: 110,
    crop: "202 35 363 390", outline: "M338 46 L339 70 L359 55 L352 80 L379 64 L370 88 Q389 80 405 85 Q414 98 422 111 Q452 104 480 85 L509 62 L516 65 Q498 85 486 104 Q474 125 468 144 L468 155 Q463 164 452 170 Q473 174 489 190 Q502 205 518 216 Q528 230 532 248 Q534 259 546 270 Q556 281 559 298 Q557 309 548 315 Q540 321 533 317 Q529 312 532 302 L539 291 Q534 286 527 285 Q520 287 515 297 Q511 306 504 311 Q496 311 492 305 Q488 296 491 285 Q499 276 502 269 Q501 256 495 248 Q486 242 477 239 Q467 237 458 233 Q452 249 455 263 Q459 277 468 287 Q473 298 474 310 Q477 323 493 335 Q500 345 499 356 Q509 365 520 374 Q532 386 536 397 Q537 407 531 413 Q520 418 506 418 L481 417 Q469 414 466 405 Q464 390 465 379 Q461 369 455 365 Q445 359 438 352 Q428 349 420 341 L413 332 Q405 337 400 348 L393 356 L381 337 L366 359 L353 350 L339 359 L327 369 Q320 376 311 382 Q302 391 297 397 Q285 404 272 404 Q259 404 251 397 Q248 389 255 382 Q267 373 284 369 Q299 364 307 352 Q305 340 301 329 Q304 314 309 301 Q319 285 331 276 Q335 267 332 259 Q318 267 306 277 Q296 283 286 285 Q281 299 271 307 Q264 311 257 310 Q242 309 230 300 Q224 294 223 287 Q222 281 226 275 L230 269 L216 265 Q212 261 212 254 Q213 249 226 243 Q219 228 216 213 Q214 190 216 166 Q216 156 222 152 Q226 165 230 181 L238 212 Q242 228 250 240 L265 244 L260 253 Q270 253 279 259 Q287 255 296 247 L304 239 L321 224 Q307 218 298 207 Q289 194 288 178 L275 169 L260 160 Q245 149 238 132 L228 111 Q245 113 264 118 L291 136 Q289 122 296 109 L302 101 L301 82 L314 91 L311 65 L326 81 Z" },
  { name: "Thud", role: "Orc", src: "/monsters/orc-1-thud.webp", width: 1672, height: 941, roomHeight: 146,
    crop: "490 138 590 635", outline: "M796 199 L801 183 799 171 805 177 818 159 842 145 833 156 819 171 821 178 834 165 850 168 870 179 879 184 892 174 885 186 873 190 856 187 864 197 884 204 888 212 867 207 853 198 864 219 850 211 831 204 814 205 799 215 781 215 765 230 753 250 747 254 728 250 725 255 736 270 740 287 747 302 742 320 727 330 715 347 710 367 707 390 713 400 705 408 700 427 697 438 681 450 675 466 665 483 657 488 650 505 638 516 624 521 620 516 620 506 612 499 610 480 599 477 598 464 589 457 594 446 584 447 580 430 584 416 574 409 577 390 565 395 552 386 542 387 539 377 533 388 522 389 511 400 500 405 503 412 496 424 498 437 505 447 499 465 514 457 528 475 542 489 557 503 573 516 588 526 591 538 594 546 590 554 591 565 599 574 600 584 609 590 618 600 639 604 648 615 659 620 676 614 680 606 676 592 664 585 665 574 669 560 680 558 687 547 699 541 708 526 714 513 726 485 736 463 749 449 758 459 758 481 760 503 740 515 734 530 721 552 716 572 709 586 704 605 710 624 712 642 711 651 715 666 719 688 711 698 692 702 672 710 660 718 650 730 650 737 668 744 704 745 734 741 758 736 775 729 785 720 782 705 778 688 790 674 790 658 786 647 781 628 773 615 786 614 790 636 800 627 817 655 829 634 839 621 852 646 864 619 878 638 888 619 899 637 901 653 910 669 909 682 918 700 917 715 912 730 904 746 904 758 918 766 943 766 973 765 997 761 1007 754 1007 743 996 725 977 707 975 693 984 678 983 660 977 646 970 640 970 624 960 614 956 592 959 576 956 553 949 538 949 523 951 510 966 514 966 494 957 481 952 462 956 440 960 428 974 442 991 451 994 465 999 478 997 497 1002 508 994 516 981 524 974 536 969 550 965 565 969 579 968 590 977 593 984 590 987 581 982 570 989 566 999 573 1001 585 994 599 989 608 988 616 999 620 1009 618 1017 622 1029 616 1037 608 1049 606 1059 599 1063 585 1066 566 1067 540 1066 532 1071 526 1068 513 1073 503 1071 489 1066 483 1068 464 1064 444 1056 424 1045 409 1040 390 1029 366 1017 353 1011 332 1002 316 986 303 968 297 965 291 948 283 941 276 925 273 909 272 917 244 921 231 899 237 878 247 868 236 858 221 844 214 831 207 Z" },
  { name: "Dungeon Lord", role: "Management", src: "/monsters/boss-1-dungeon-lord.webp", width: 1672, height: 941, roomHeight: 178,
    crop: "445 25 765 905", outline: "M818 36 L833 39 846 45 855 55 860 68 867 75 875 78 879 90 883 99 876 97 882 110 894 116 901 120 906 130 902 139 889 141 887 151 894 159 899 170 896 180 883 185 885 196 903 178 919 164 940 153 935 175 928 192 944 196 980 166 974 197 986 201 1008 183 1000 205 1008 211 1046 206 1024 229 1018 238 1023 250 1047 275 1028 280 1018 278 1019 289 1011 301 1016 320 1030 328 1051 326 1060 330 1074 325 1086 325 1094 318 1106 308 1120 306 1129 300 1135 288 1142 287 1147 289 1146 300 1141 308 1135 313 1139 325 1146 331 1155 331 1160 338 1167 332 1170 331 1176 334 1180 330 1186 333 1185 340 1192 340 1194 346 1188 349 1193 354 1187 359 1178 360 1174 368 1165 368 1152 370 1138 371 1123 366 1116 368 1103 362 1093 368 1097 374 1090 385 1084 395 1080 386 1070 395 1064 388 1051 392 1039 386 1034 397 1039 434 1047 473 1058 516 1072 557 1090 599 1107 638 1117 666 1106 646 1094 635 1081 625 1064 619 1058 625 1050 619 1045 631 1037 618 1033 637 1026 640 1029 648 1018 654 1015 646 1006 659 994 646 991 665 982 680 973 733 967 710 961 667 955 611 950 582 942 591 949 632 959 674 969 718 973 772 973 798 982 815 968 835 979 854 985 879 985 898 978 909 967 916 954 920 938 920 927 915 916 906 909 894 908 880 910 864 917 843 911 827 902 814 896 803 889 784 876 765 866 745 854 713 837 677 825 650 817 636 816 660 802 688 797 733 791 755 781 774 782 810 793 828 789 850 781 860 758 869 728 875 694 878 670 877 654 873 650 865 655 856 668 850 691 846 717 837 740 821 741 809 737 793 741 776 744 752 735 722 729 695 725 667 720 644 717 619 706 604 701 635 690 669 685 699 676 719 669 711 652 751 653 721 659 692 667 642 675 592 682 547 688 501 697 464 701 426 705 396 696 400 679 406 665 405 648 399 635 399 629 407 618 401 610 409 592 416 574 417 562 411 552 413 540 395 529 378 516 372 507 360 507 349 500 343 500 335 507 328 510 328 502 315 487 299 477 286 470 281 465 275 463 264 462 254 457 244 458 235 470 231 497 222 507 218 509 205 515 196 524 193 531 197 535 207 534 211 542 207 549 211 550 213 566 204 577 202 585 211 612 278 621 280 630 286 635 301 641 315 653 332 671 336 680 324 688 306 695 291 686 282 666 269 687 265 695 258 705 250 687 218 715 232 721 224 717 200 739 221 749 214 742 201 737 181 755 184 773 181 786 174 778 168 767 165 760 157 752 156 753 151 765 148 765 139 762 127 761 118 763 107 770 96 759 103 751 94 756 87 757 73 760 89 766 94 773 87 774 79 779 70 789 58 784 58 789 49 803 44 Z" },
] as const;

export function getEnemyArt(type: MonsterType, room = 1): DungeonEnemyArt {
  const tier = Math.max(0, Math.min(3, Math.floor((room - 1) / 10)));
  return tier === 0 ? ENEMY_ART[type] : HIGHER_TIER_ART[type][tier - 1];
}

export function EnemySprite({ type, room = 1, className }: { type: MonsterType; room?: number; className?: string }) {
  const id = useId(), art = getEnemyArt(type,room);
  return <svg className={className} viewBox={art.crop} aria-hidden="true">
    <defs><clipPath id={id}>{art.outline.split(/(?=M)/).map((contour,index) => <path key={index} d={contour} />)}</clipPath></defs>
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
export function clampRoomPoint(point: Point, cleared: boolean, bounds = {minX:170,maxX:733}): Point {
  // DOMPoint exposes x/y through prototype accessors: spreading it loses the
  // coordinates. Read them directly and return our own plain movement point.
  const x=Math.max(170,bounds.minX,Math.min(733,bounds.maxX,point.x));
  const doorLane=inDoorLane({x,y:point.y});
  // The whole cleared lane leads to the door. A second y threshold creates
  // an invisible ledge that small keyboard steps can never cross.
  const door = cleared && doorLane;
  // Stop in front of the living guard when walking toward the north door.
  const northEdge = !cleared && doorLane ? GUARD.y + 90 : door ? DOOR.y : 194;
  return { x, y: Math.max(northEdge, Math.min(505, point.y)) };
}

export function roomMerchantPoint(bounds = {minX:170,maxX:733}): Point {
  return {x:bounds.minX,y:270};
}

export function roomMerchantApproach(merchant: Point): Point {
  return {x:merchant.x+(merchant.x < 450 ? 48 : -48),y:merchant.y+36};
}

export function roomFloorTarget(point: Point, cleared: boolean, enemy: MonsterType, lootPoint?: Point, merchantPoint?: Point, room = 1): { point: Point; destination?: "enemy" | "door" | "loot" | "merchant" } {
  const door = inDoorLane(point) && point.y <= 130;
  const guard = Math.abs(point.x - GUARD.x) < 90 && point.y >= GUARD.y - getEnemyArt(enemy,room).roomHeight - 15 && point.y <= GUARD.y + 25;
  if (!cleared && (door || guard)) return { point: STAGING, destination: "enemy" };
  const lootImage = lootPoint && Math.abs(point.x-lootPoint.x) <= 45 && point.y >= lootPoint.y-80 && point.y <= lootPoint.y+25;
  const merchantSide = merchantPoint && merchantPoint.x < 450 ? "left" : "right";
  const stall = MERCHANT_ROOM_ART_LAYOUT.stall;
  const merchantLeft = Math.min(-52,stall.xByOuterSide[merchantSide]);
  const merchantRight = Math.max(52,stall.xByOuterSide[merchantSide]+stall.width);
  const merchantHit = merchantPoint && point.x >= merchantPoint.x+merchantLeft && point.x <= merchantPoint.x+merchantRight && point.y >= merchantPoint.y+stall.y && point.y <= merchantPoint.y+22;
  if (cleared && door) return { point: DOOR, destination: "door" };
  if (cleared && lootPoint && (lootImage || nearRoomLoot(point,lootPoint))) return { point: lootPoint, destination: "loot" };
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
export function DungeonScene({ view, actions, children, topOverlay, footer, presentationOverlay, roomNotes }: { view: RoomView; actions: RoomActions; children?: ReactNode; topOverlay?: ReactNode; footer?: ReactNode; presentationOverlay?: ReactNode; roomNotes?: ReactNode }) {
  const [position, setPosition] = useState<Point>(view.phase === "explore" ? ENTRY : STAGING);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<Facing>("right");
  const point = useRef(position), stopWalk = useRef<(() => void) | null>(null);
  const steering = useRef<ReturnType<typeof createRoomSteering> | null>(null);
  const keyboardInteract = useRef<(() => void) | null>(null);
  const walkGoal = useRef<WalkGoal | null>(null);
  const continueWalk = useRef<((goal: WalkGoal, bounds: ReturnType<typeof portraitRoomCamera>) => void) | null>(null);
  const latest = useRef({ view, actions });
  const [merchantGate]=useState(createMerchantArrivalGate);
  const openMerchant=useCallback(() => {
    const current=latest.current;
    if (current.view.pending || current.view.phase !== "recovery" || !current.actions.merchant) {
      merchantGate.cancel(); return false;
    }
    walkGoal.current=null;
    current.actions.merchant();
    return true;
  },[merchantGate]);
  const playerArrivedAtMerchant=useCallback(() => merchantGate.playerArrived() && openMerchant(),[merchantGate,openMerchant]);
  const merchantArrivalChanged=useCallback((arrived: boolean) => {
    if (merchantGate.merchantArrived(arrived)) openMerchant();
  },[merchantGate,openMerchant]);
  useEffect(() => { latest.current = { view, actions }; }, [view, actions]);
  const svg = useRef<SVGSVGElement>(null), pointer = useRef<Point | null>(null);
  const [camera,setCamera] = useState({actorScale:1,minX:170,maxX:733});
  const currentCamera = useRef(camera);
  useEffect(() => { currentCamera.current=camera; },[camera]);
  const lootPoint = roomLootPoint(view.seed ?? 0,view.room,camera);
  const currentLootPoint = useRef(lootPoint);
  useEffect(() => { currentLootPoint.current=lootPoint; },[lootPoint]);
  const relic = getRelicDefinition(view.relic);
  const cleared = view.enemyHp === 0;
  const relicClip = useId();
  const loot = view.phase === "loot" ? view.loot : undefined;
  const hasRoomHud=Boolean(topOverlay);
  const hasMerchant=view.phase === "recovery" && Boolean(actions.merchant);
  const merchantPoint=hasMerchant ? roomMerchantPoint(camera) : undefined;
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
      currentCamera.current=next;
      setCamera(previous => previous.actorScale === next.actorScale && previous.minX === next.minX && previous.maxX === next.maxX ? previous : next);
      const x=Math.max(next.minX,Math.min(next.maxX,point.current.x));
      if (changed || x !== point.current.x) {
        const goal=walkGoal.current;
        stopWalk.current?.(); stopWalk.current=null; walkGoal.current=null; setWalking(steering.current?.moving ?? false);
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
    const stop = () => { merchantGate.cancel(); steering.current?.stop(); stopWalk.current?.(); stopWalk.current=null; walkGoal.current=null; setWalking(false); };
    window.addEventListener("blur",stop);
    window.addEventListener("pagehide",stop);
    document.addEventListener("visibilitychange",stop);
    return () => { stopWalk.current?.(); window.removeEventListener("blur",stop); window.removeEventListener("pagehide",stop); document.removeEventListener("visibilitychange",stop); };
  }, [merchantGate]);

  useEffect(() => {
    const root=svg.current?.closest("main");
    if (!root) return;
    const blocked = (target: EventTarget | null = document.activeElement) => {
      if (document.querySelector("dialog[open], [role='dialog'][aria-modal='true']:not([hidden]), [role='alertdialog'][aria-modal='true']:not([hidden]), .descent-mobile-menu[open], .descent-supplies-menu[open]")) return true;
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='combobox'], [role='slider'], [data-wallet-controls], [data-keyboard-exclude], [inert]"))
        || (target !== document.body && target !== document.documentElement && !root.contains(target));
    };
    const control=createRoomSteering(() => point.current, target => {
      const {view:current,actions:callbacks}=latest.current;
      if (!canWalk(current) || blocked()) return false;
      const bounds=currentCamera.current;
      const from=point.current;
      const next=clampRoomPoint(target,current.enemyHp === 0,bounds);
      setFacing(previous => movementFacing(point.current,next,previous));
      point.current=next; setPosition(next);
      if (current.phase === "explore" && Math.hypot(next.x-GUARD.x,next.y-GUARD.y) < 125) {
        setFacing(previous => movementFacing(next,GUARD,previous)); callbacks.approach(); return false;
      }
      if ((current.phase === "loot" || current.phase === "recovery") && next.y <= 130 && inDoorLane(next)) {
        callbacks.enter(current.phase === "loot"); return false;
      }
      if (current.phase === "loot" && current.loot && nearRoomLoot(next,currentLootPoint.current)) {
        callbacks.collect?.(); return false;
      }
      if (current.phase === "recovery" && callbacks.merchant) {
        const merchant=roomMerchantPoint(bounds);
        const distance=Math.hypot(next.x-merchant.x,next.y-merchant.y);
        if (distance <= 64 && distance < Math.hypot(from.x-merchant.x,from.y-merchant.y)) {
          setFacing(previous => movementFacing(next,merchant,previous));
          walkGoal.current={target:roomMerchantApproach(merchant),destination:"merchant"};
          playerArrivedAtMerchant(); return false;
        }
      }
    },setWalking);
    steering.current=control;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || blocked(event.target)) { control.stop(); return; }
      const current=latest.current.view;
      if (!canWalk(current)) return;
      const key=roomMovementKey(event.key);
      if (!key && event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      // Repeat never starts a fresh walk after a phase transition or focus loss.
      if (event.repeat) return;
      if (key) {
        merchantGate.cancel();
        stopWalk.current?.(); stopWalk.current=null; walkGoal.current=null;
        latest.current.actions.interact?.();
        control.press(key);
      } else keyboardInteract.current?.();
    };
    const keyup = (event: KeyboardEvent) => { const key=roomMovementKey(event.key); if (key) control.release(key); };
    const focusChanged = (event: FocusEvent) => { if (blocked(event.target)) control.stop(); };
    document.addEventListener("keydown",keydown);
    document.addEventListener("keyup",keyup);
    document.addEventListener("focusin",focusChanged);
    return () => {
      control.stop(); steering.current=null;
      document.removeEventListener("keydown",keydown);
      document.removeEventListener("keyup",keyup);
      document.removeEventListener("focusin",focusChanged);
    };
  },[merchantGate,playerArrivedAtMerchant]);

  useEffect(() => {
    steering.current?.stop();
    if (view.pending || view.phase !== "recovery" || !hasMerchant) {
      merchantGate.cancel();
      if (walkGoal.current?.destination === "merchant") walkGoal.current=null;
    }
  },[view.phase,view.pending,hasMerchant,merchantGate]);

  function moveTo(target: Point, destination?: WalkGoal["destination"], interact = true, bounds = camera) {
    const {view: currentView,actions: currentActions}=latest.current;
    if (!canWalk(currentView) || !isRoomPoint(target)) return;
    merchantGate.cancel();
    steering.current?.stop();
    if (interact) currentActions.interact?.();
    stopWalk.current?.();
    const next = clampRoomPoint(target,currentView.enemyHp === 0,bounds);
    // A door gesture means leaving the room, even if its straight path crosses loot.
    if (currentView.enemyHp === 0 && next.y <= 130 && inDoorLane(next)) destination = "door";
    walkGoal.current={target,destination};
    setFacing(previous => movementFacing(point.current,next,previous)); setWalking(true);
    stopWalk.current=startRoomWalk(point.current,next,step => {
      const current=latest.current;
      if (!canWalk(current.view)) { stopWalk.current=null; walkGoal.current=null; setWalking(false); return false; }
      point.current=step; setPosition(step);
      if (destination !== "door" && current.view.phase === "loot" && current.view.loot && nearRoomLoot(step,currentLootPoint.current)) {
        stopWalk.current=null; walkGoal.current=null; setWalking(false); current.actions.collect?.(); return false;
      }
    },() => {
      stopWalk.current = null;
      if (destination !== "merchant") walkGoal.current=null;
      setWalking(false);
      const current = latest.current;
      if (current.view.pending) return;
      if (current.view.phase === "explore" && (destination === "enemy" || Math.hypot(next.x-GUARD.x,next.y-GUARD.y) < 125)) {
        setFacing(previous => movementFacing(next,GUARD,previous)); current.actions.approach();
      }
      else if ((current.view.phase === "recovery" || current.view.phase === "loot") && destination === "door") current.actions.enter(current.view.phase === "loot");
      else if (current.view.phase === "recovery" && current.actions.merchant && destination === "merchant") {
        setFacing(previous => movementFacing(next,roomMerchantPoint(bounds),previous));
        playerArrivedAtMerchant();
      }
    });
  }

  useEffect(() => {
    keyboardInteract.current=() => moveTo(cleared ? DOOR : STAGING,cleared ? "door" : "enemy");
    continueWalk.current=(goal,bounds) => {
      const current=latest.current.view;
      const merchant=roomMerchantPoint(bounds);
      const target=goal.destination === "loot" ? roomLootPoint(current.seed ?? 0,current.room,bounds)
        : goal.destination === "merchant" ? roomMerchantApproach(merchant) : goal.target;
      moveTo(target,goal.destination,false,bounds);
    };
  });


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
    if (merchantPoint && event.target instanceof Element && event.target.closest(".dungeon-merchant")) {
      moveTo(roomMerchantApproach(merchantPoint),"merchant"); return;
    }
    // Only the painted merchant/cart targets trade. Empty floor around the
    // moving or scaled wagon must remain available for free walking.
    const target = roomFloorTarget(p,cleared,view.enemy,loot ? lootPoint : undefined,undefined,view.room);
    moveTo(target.point,target.destination);
  }

  return <div className={`dungeon-scene-wrap ${view.phase} ${view.enemy === 3 ? "boss-room" : ""} ${children ? "has-overlay" : ""} ${topOverlay ? "has-room-hud" : ""}`} data-room-scene data-room={view.room}>
    {topOverlay && <div className="dungeon-scene-top-overlay">{topOverlay}</div>}
    <svg ref={svg} viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" className="dungeon-scene" tabIndex={0} role="group" aria-label={`Room ${view.room} floor. Hold WASD to walk; E to ${cleared ? "use the door" : "approach the enemy"}. Arrow keys select buttons; Enter activates.`}
      onPointerDown={e => { pointer.current={x:e.clientX,y:e.clientY}; }} onPointerUp={floor} onPointerCancel={() => {pointer.current=null;}}>
      <image href="/dungeon/stone-room.webp" width="900" height="600" />
      <ellipse className="dungeon-room-tint" cx="450" cy="320" rx="340" ry="225" />
      {cleared && <g className="dungeon-door-open"><path d="M407 10 Q450 -10 493 10 L493 77 407 77Z" fill="#030205" /><path d="M420 76 L480 76 523 230 377 230Z" fill="#eac170" opacity=".12" /><text x="450" y="115" textAnchor="middle">{view.phase === "won" ? "VICTORY" : "NEXT ROOM ↑"}</text></g>}
      {!cleared && <g transform={`translate(${GUARD.x} ${GUARD.y}) scale(${camera.actorScale}) translate(${-GUARD.x} ${-GUARD.y})`}><g className={`dungeon-enemy ${view.cue && view.cue !== "potion" ? "is-hit" : ""}`} style={{transformOrigin:`${GUARD.x}px ${GUARD.y}px`}} key={`enemy-${view.cueId}`}>
        <ellipse cx={GUARD.x} cy={GUARD.y-3} rx={spriteWidth*.4} ry={spriteHeight*.07} fill="#000" opacity=".62" />
        <svg x={GUARD.x-spriteWidth/2} y={GUARD.y-spriteHeight} width={spriteWidth} height={spriteHeight} overflow="visible"><EnemySprite type={view.enemy} room={view.room} /></svg>
      </g></g>}
      {loot && <g transform={`translate(${lootPoint.x} ${lootPoint.y}) scale(${camera.actorScale}) translate(${-GUARD.x} ${-GUARD.y})`} className="dungeon-loot" data-room-loot={loot.type} data-loot-position={`${lootPoint.x},${lootPoint.y}`} role="img" aria-label={`Loot on the floor: ${roomLootLabel(loot)}. Walk here to collect.`}>
        <ellipse cx={GUARD.x} cy={GUARD.y+4} rx="48" ry="14" fill="#c59742" opacity=".2" />
        {loot.type === 0 || loot.type === 2 ? <GoldLootSprite amount={loot.gold} x={GUARD.x} y={GUARD.y} /> : <image href={LOOT_ART[loot.type]} x={GUARD.x-34} y={GUARD.y-66} width="68" height="68" />}
        {loot.type !== 0 && loot.type !== 2 && loot.gold > 0 && <GoldLootSprite amount={loot.gold} x={GUARD.x+31} y={GUARD.y+4} scale={.45} />}
        {loot.relicId > 0 && <image href="/dungeon/loot/pouch.webp" x={GUARD.x+28} y={GUARD.y-45} width="46" height="46" />}
        <text x={GUARD.x} y={GUARD.y-84} textAnchor="middle">{roomLootLabel(loot)}</text>
      </g>}
      {merchantPoint && <RoomMerchant destination={merchantPoint} actorScale={camera.actorScale} onArrivalChange={merchantArrivalChanged} />}
      <g className="dungeon-actor-position" style={{transform:`translate(${position.x}px,${position.y}px)`}} data-avatar-position={`${position.x},${position.y}`} data-avatar-facing={facing}><g transform={`scale(${camera.actorScale})`}>
        <ellipse cx="0" cy="0" rx="43" ry="13" fill="#000" opacity=".64" />
        <g transform={`scale(${facing === "left" ? -1 : 1} 1)`}>
        <g key={view.cue ? `avatar-${view.cueId}` : "avatar-idle"} className={`dungeon-avatar ${walking ? "is-walking" : ""} ${view.hp === 0 ? "is-dead" : ""} ${view.cue === "attack" || view.cue === "critical" ? "is-attacking" : ""} ${view.incoming && view.cue ? "takes-hit" : ""}`}>
          <svg x="-70" y="-151" width="158" height="164" overflow="visible"><AvatarSprite /></svg>
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
    {roomNotes && <div className="dungeon-scene-notes">{roomNotes}</div>}
    {presentationOverlay && <div className="dungeon-scene-presentation">{presentationOverlay}</div>}
    <div className="dungeon-scene-bottom">
    {footer && <div className="dungeon-scene-footer">{footer}</div>}
    {children && <div className="dungeon-scene-overlay">{children}</div>}
    <div className="dungeon-floor-controls" data-keyboard-actions>
      {view.phase === "explore" && <button data-keyboard-default="true" onClick={() => moveTo(STAGING,"enemy")} disabled={view.pending}>Approach {view.enemyName} <span>↗</span></button>}
      {view.phase === "recovery" && <><button className="dungeon-enter-room" data-keyboard-default="true" onClick={() => moveTo(DOOR,"door")} disabled={view.pending}>Enter room {view.room+1} <span>↑</span></button>{merchantPoint && <button onClick={() => moveTo(roomMerchantApproach(merchantPoint),"merchant")} disabled={view.pending}>Visit Kevin</button>}</>}
      {view.phase === "combat" && !children && <span>Your turn · Choose an action below</span>}
      {view.phase === "lost" && <span>The dungeon keeps its appointment.</span>}
    </div>
    {!children && <p className="dungeon-controls-help">Hold WASD to walk · E to interact · Arrows + Enter for buttons</p>}
    </div>
  </div>;
}
