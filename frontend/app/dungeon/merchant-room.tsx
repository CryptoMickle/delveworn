"use client";

import { useEffect, useRef, useState } from "react";
import { MERCHANT_ROOM_ART_LAYOUT, MerchantSprite, MerchantStallSprite } from "./merchant-art";
import { isRoomPoint, movementFacing, startRoomWalk, type Facing, type Point } from "./movement";

export const MERCHANT_ENTRY = { x: 450, y: 92 } as const;

type RoomMerchantProps = {
  destination: Point;
  actorScale: number;
  onArrivalChange?: (arrived: boolean) => void;
  onPositionChange?: (position: Point) => void;
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

/** Kevin and his wagon enter together, then he turns inward at the shop spot. */
export function RoomMerchant({ destination, actorScale, onArrivalChange, onPositionChange }: RoomMerchantProps) {
  const destinationX = destination.x;
  const destinationY = destination.y;
  const [position, setPosition] = useState<Point>(MERCHANT_ENTRY);
  const [facing, setFacing] = useState<Facing>("left");
  const [arrived, setArrived] = useState(false);
  const currentPosition = useRef<Point>(MERCHANT_ENTRY);
  const stopWalk = useRef<(() => void) | null>(null);

  useEffect(() => {
    stopWalk.current?.();
    stopWalk.current = null;
    onArrivalChange?.(false);
    const target = { x: destinationX, y: destinationY };
    if (!isRoomPoint(target)) return;

    const from = currentPosition.current;
    onPositionChange?.(from);
    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        currentPosition.current = target;
        onPositionChange?.(target);
        setPosition(target);
        setFacing("right");
        setArrived(true);
        onArrivalChange?.(true);
      });
      return () => { active = false; onArrivalChange?.(false); };
    }

    let active = true;
    let firstStep = true;
    const stop = startRoomWalk(from, target, (next) => {
      if (!active) return false;
      if (firstStep) {
        firstStep = false;
        setFacing((previous) => movementFacing(from, target, previous));
        setArrived(false);
      }
      currentPosition.current = next;
      onPositionChange?.(next);
      setPosition(next);
    }, () => {
      if (!active) return;
      stopWalk.current = null;
      setFacing("right");
      setArrived(true);
      onArrivalChange?.(true);
    });
    stopWalk.current = stop;

    return () => {
      active = false;
      stop();
      onArrivalChange?.(false);
      if (stopWalk.current === stop) stopWalk.current = null;
    };
  }, [destinationX, destinationY, onArrivalChange, onPositionChange]);

  return (
    <g
      className="dungeon-merchant"
      data-room-depth-actor="merchant"
      data-merchant-facing={facing}
      data-merchant-destination={`${destinationX},${destinationY}`}
      data-merchant-position={`${position.x},${position.y}`}
      data-merchant-arrived={arrived}
      role="img"
      aria-label="Quartermaster Kevin. Walk here to trade."
      transform={`translate(${position.x} ${position.y}) scale(${actorScale})`}
    >
      <ellipse cx="0" cy="1" rx="42" ry="12" fill="#000" opacity=".55" />
      <svg
        x={MERCHANT_ROOM_ART_LAYOUT.stall.xByOuterSide.right}
        y={MERCHANT_ROOM_ART_LAYOUT.stall.y}
        width={MERCHANT_ROOM_ART_LAYOUT.stall.width}
        height={MERCHANT_ROOM_ART_LAYOUT.stall.height}
        overflow="visible"
      >
        <MerchantStallSprite turned />
      </svg>
      <g transform={`scale(${facing === "right" ? -1 : 1} 1)`}>
        <svg
          x={MERCHANT_ROOM_ART_LAYOUT.person.x}
          y={MERCHANT_ROOM_ART_LAYOUT.person.y}
          width={MERCHANT_ROOM_ART_LAYOUT.person.width}
          height={MERCHANT_ROOM_ART_LAYOUT.person.height}
          overflow="visible"
        >
          <MerchantSprite />
        </svg>
      </g>
      <text x="0" y="24" textAnchor="middle">KEVIN</text>
    </g>
  );
}
