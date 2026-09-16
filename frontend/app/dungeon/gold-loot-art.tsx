"use client";

import { memo, useId } from "react";

const GOLD_COIN_IMAGE = "/assets/delveworn-gold-coin.webp";
const COIN_THICKNESS = 5.2;

/** Bounds around the sprite's bottom-center room anchor, before scale. */
export const GOLD_LOOT_SPRITE_BOUNDS = {
  x: -40,
  y: -68,
  width: 80,
  height: 72,
} as const;

export const GOLD_LOOT_THRESHOLDS = {
  medium: 10,
  large: 25,
} as const;

type GoldLootSpriteProps = {
  amount: number;
  x?: number;
  y?: number;
  scale?: number;
  className?: string;
};

type GoldLootTier = "small" | "medium" | "large";

type CoinStack = {
  x: number;
  bottom: number;
  width: number;
  coins: number;
};

// Back-to-front paint order. Each tier has a deliberately different footprint
// and height so the reward reads before the exact amount label is read.
const STACKS_BY_TIER: Record<GoldLootTier, readonly CoinStack[]> = {
  small: [{ x: 0, bottom: -1, width: 36, coins: 3 }],
  medium: [
    { x: 10, bottom: -1, width: 38, coins: 6 },
    { x: -15, bottom: 0, width: 32, coins: 3 },
  ],
  large: [
    { x: 0, bottom: -1, width: 38, coins: 9 },
    { x: -20, bottom: 0, width: 34, coins: 6 },
    { x: 21, bottom: 0, width: 32, coins: 4 },
  ],
};

export function goldLootTier(amount: number): GoldLootTier | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= GOLD_LOOT_THRESHOLDS.large) return "large";
  if (amount >= GOLD_LOOT_THRESHOLDS.medium) return "medium";
  return "small";
}

function StackBands({
  stack,
  stackIndex,
  id,
}: {
  stack: CoinStack;
  stackIndex: number;
  id: string;
}) {
  const radiusX = stack.width / 2;
  const radiusY = stack.width * 0.135;
  const left = stack.x - radiusX;
  const right = stack.x + radiusX;
  const topY = stack.bottom - stack.coins * COIN_THICKNESS;
  const faceClipId = `${id}-face-${stackIndex}`;

  return (
    <g filter={`url(#${id}-shadow)`}>
      {Array.from({ length: stack.coins }, (_, index) => {
        const centerY = stack.bottom - (index + 1) * COIN_THICKNESS;

        return (
          <g key={index}>
            <path
              d={`M ${left} ${centerY} L ${left} ${centerY + COIN_THICKNESS} A ${radiusX} ${radiusY} 0 0 0 ${right} ${centerY + COIN_THICKNESS} L ${right} ${centerY} Z`}
              fill={`url(#${id}-side)`}
              stroke="#7b3e08"
              strokeWidth="0.8"
            />
            <ellipse
              cx={stack.x}
              cy={centerY}
              rx={radiusX}
              ry={radiusY}
              fill={`url(#${id}-top)`}
              stroke="#9d570d"
              strokeWidth="0.75"
            />
            <path
              d={`M ${left + 1} ${centerY + COIN_THICKNESS} A ${radiusX - 1} ${radiusY - 0.5} 0 0 0 ${right - 1} ${centerY + COIN_THICKNESS}`}
              fill="none"
              stroke="#ffd96b"
              strokeOpacity="0.72"
              strokeWidth="0.65"
            />
          </g>
        );
      })}

      <image
        href={GOLD_COIN_IMAGE}
        x={left}
        y={topY - radiusY}
        width={stack.width}
        height={radiusY * 2}
        preserveAspectRatio="none"
        clipPath={`url(#${faceClipId})`}
      />
      <ellipse
        cx={stack.x}
        cy={topY}
        rx={radiusX}
        ry={radiusY}
        fill={`url(#${id}-shine)`}
        pointerEvents="none"
      />
      <ellipse
        cx={stack.x}
        cy={topY}
        rx={radiusX - 0.8}
        ry={radiusY - 0.5}
        fill="none"
        stroke="#ffdf73"
        strokeWidth="1.25"
      />
      <ellipse
        cx={stack.x}
        cy={topY}
        rx={radiusX - 2.3}
        ry={Math.max(1, radiusY - 1.45)}
        fill="none"
        stroke="#8a4608"
        strokeOpacity="0.8"
        strokeWidth="0.65"
      />
    </g>
  );
}

/**
 * Upright stacks of horizontally laid coins, anchored at the bottom center.
 * The stack silhouette communicates reward tier; the room label gives the
 * exact amount.
 */
export const GoldLootSprite = memo(function GoldLootSprite({
  amount,
  x = 0,
  y = 0,
  scale = 1,
  className,
}: GoldLootSpriteProps) {
  const rawId = useId();
  const id = `gold-loot-${rawId.replace(/:/g, "")}`;
  const tier = goldLootTier(amount);

  if (tier === null) return null;

  const stacks = STACKS_BY_TIER[tier];
  const visibleCoins = stacks.reduce((total, stack) => total + stack.coins, 0);

  return (
    <g
      className={className}
      transform={`translate(${x} ${y}) scale(${scale})`}
      data-gold-tier={tier}
      data-coin-stacks={stacks.length}
      data-visible-coins={visibleCoins}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f4809" />
          <stop offset="0.13" stopColor="#d88612" />
          <stop offset="0.34" stopColor="#ffe27a" />
          <stop offset="0.58" stopColor="#d98a13" />
          <stop offset="0.82" stopColor="#ffc943" />
          <stop offset="1" stopColor="#7b3907" />
        </linearGradient>
        <radialGradient id={`${id}-top`} cx="42%" cy="28%" r="76%">
          <stop offset="0" stopColor="#ffe88b" />
          <stop offset="0.58" stopColor="#e8a31d" />
          <stop offset="1" stopColor="#8c4708" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff5ba" stopOpacity="0.3" />
          <stop offset="0.42" stopColor="#ffd34d" stopOpacity="0.05" />
          <stop offset="1" stopColor="#5b2803" stopOpacity="0.28" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-25%" y="-25%" width="150%" height="160%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="1.7" stdDeviation="1.4" floodColor="#080403" floodOpacity="0.7" />
        </filter>
        {stacks.map((stack, index) => {
          const radiusX = stack.width / 2;
          const radiusY = stack.width * 0.135;
          const topY = stack.bottom - stack.coins * COIN_THICKNESS;
          return (
            <clipPath id={`${id}-face-${index}`} key={index}>
              <ellipse cx={stack.x} cy={topY} rx={radiusX - 1.1} ry={radiusY - 0.7} />
            </clipPath>
          );
        })}
      </defs>
      {stacks.map((stack, index) => (
        <StackBands key={index} stack={stack} stackIndex={index} id={id} />
      ))}
    </g>
  );
});
