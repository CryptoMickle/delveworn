"use client";

import { Fragment, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { MERCHANT_ROOM_ART_LAYOUT, MerchantSprite, MerchantStallSprite } from "./merchant-art";
import { isRoomPoint, type Point } from "./movement";
import { createMerchantJourney, MERCHANT_ENTRY, merchantElapsedAt, merchantPoseAt, startMerchantJourney, type MerchantPose, type MerchantProgress } from "./merchant-motion";
export { MERCHANT_ENTRY } from "./merchant-motion";

export type MerchantRoomActors = {
  figure: ReactElement;
  wagon: ReactElement;
  position: Point;
  wagonPosition: Point;
};
type RoomMerchantProps = {
  destination?: Point;
  actorScale: number;
  onArrivalChange?: (arrived: boolean) => void;
  onPositionChange?: (position: Point) => void;
  children?: (actors: MerchantRoomActors | null) => ReactNode;
};

/** Coordinates two independent walks and consumes each trade intent once. */
export function createMerchantArrivalGate() {
  let merchantIsReady = false;
  let playerIsReady = false;
  const consume = () => {
    if (!merchantIsReady || !playerIsReady) return false;
    playerIsReady = false;
    return true;
  };
  return {
    merchantArrived(arrived: boolean) {
      merchantIsReady = arrived;
      return consume();
    },
    playerArrived() {
      playerIsReady = true;
      return consume();
    },
    cancel() { playerIsReady = false; },
    get waiting() { return playerIsReady; },
  };
}

/** One entrance controller owns two independently depth-sorted room figures. */
export function RoomMerchant({ destination, actorScale, onArrivalChange, onPositionChange, children }: RoomMerchantProps) {
  const destinationX=destination?.x, destinationY=destination?.y;
  const progress=useRef<MerchantProgress>({stage:"entering",progress:0});
  const [pose,setPose]=useState<MerchantPose>(() => ({
    stage:"entering",progress:0,position:MERCHANT_ENTRY,
    wagon:{x:MERCHANT_ENTRY.x,y:MERCHANT_ENTRY.y-115*actorScale},facing:"left",wagonTurn:0,
  }));

  useEffect(() => {
    onArrivalChange?.(false);
    if (destinationX === undefined || destinationY === undefined) {
      progress.current={stage:"entering",progress:0};
      return;
    }
    const target={x:destinationX,y:destinationY};
    if (!isRoomPoint(target) || !Number.isFinite(actorScale) || actorScale <= 0) return;
    const plan=createMerchantJourney(target,actorScale);
    let active=true;
    const publish=(next: MerchantPose) => {
      if (!active) return;
      progress.current={stage:next.stage,progress:next.progress};
      setPose(next);
      onPositionChange?.(next.position);
    };
    const reducedMotion=typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || progress.current.stage === "ready") {
      queueMicrotask(() => {
        if (!active) return;
        publish(merchantPoseAt(plan,plan.duration));
        onArrivalChange?.(true);
      });
      return () => { active=false; onArrivalChange?.(false); };
    }
    const resume={...progress.current};
    queueMicrotask(() => publish(merchantPoseAt(plan,merchantElapsedAt(plan,resume))));
    const stop=startMerchantJourney(plan,publish,() => { if (active) onArrivalChange?.(true); },undefined,resume);
    return () => { active=false; stop(); onArrivalChange?.(false); };
  },[destinationX,destinationY,actorScale,onArrivalChange,onPositionChange]);

  if (!destination) return children?.(null) ?? null;
  const arrived=pose.stage === "ready";
  const wagon=<g className="dungeon-merchant dungeon-merchant-wagon" data-room-depth-actor="wagon"
    data-merchant-part="wagon" data-wagon-position={`${pose.wagon.x},${pose.wagon.y}`}
    data-wagon-facing={pose.wagonTurn < .5 ? "left" : "right"}
    data-wagon-turn={pose.wagonTurn} data-merchant-stage={pose.stage}
    role="img" aria-label="Kevin's wagon. Walk here to trade."
    transform={`translate(${pose.wagon.x} ${pose.wagon.y}) scale(${actorScale})`}>
    <g transform={`scale(${Math.max(.02,Math.abs(Math.cos(Math.PI*pose.wagonTurn)))} 1)`}>
      <svg x={-MERCHANT_ROOM_ART_LAYOUT.stall.width/2} y={MERCHANT_ROOM_ART_LAYOUT.stall.y}
        width={MERCHANT_ROOM_ART_LAYOUT.stall.width} height={MERCHANT_ROOM_ART_LAYOUT.stall.height} overflow="visible">
        <MerchantStallSprite turned={pose.wagonTurn >= .5} />
      </svg>
    </g>
  </g>;
  const figure=<g className="dungeon-merchant dungeon-merchant-figure" data-room-depth-actor="merchant"
    data-merchant-part="figure" data-merchant-facing={pose.facing}
    data-merchant-destination={`${destinationX},${destinationY}`}
    data-merchant-position={`${pose.position.x},${pose.position.y}`}
    data-merchant-stage={pose.stage} data-merchant-arrived={arrived}
    role="img" aria-label="Quartermaster Kevin. Walk here to trade."
    transform={`translate(${pose.position.x} ${pose.position.y}) scale(${actorScale})`}>
    <ellipse cx="0" cy="1" rx="42" ry="12" fill="#000" opacity=".55" />
    <g transform={`scale(${pose.facing === "right" ? -1 : 1} 1)`}>
      <svg x={MERCHANT_ROOM_ART_LAYOUT.person.x} y={MERCHANT_ROOM_ART_LAYOUT.person.y}
        width={MERCHANT_ROOM_ART_LAYOUT.person.width} height={MERCHANT_ROOM_ART_LAYOUT.person.height} overflow="visible">
        <MerchantSprite />
      </svg>
    </g>
    <text x="0" y="24" textAnchor="middle">KEVIN</text>
  </g>;
  const actors={figure,wagon,position:pose.position,wagonPosition:pose.wagon};
  if (children) return children(actors);
  return <Fragment>{wagon}{figure}</Fragment>;
}
