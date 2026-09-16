"use client";

import { useId } from "react";

const GOLD_COIN_IMAGE = "/assets/delveworn-gold-coin.webp";

/** Bounds around the sprite's bottom-center room anchor, before scale. */
export const GOLD_LOOT_SPRITE_BOUNDS = {
  x: -40,
  y: -68,
  width: 80,
  height: 72,
} as const;

type GoldLootSpriteProps = {
  amount: number;
  x?: number;
  y?: number;
  scale?: number;
  className?: string;
};

type CoinLayer = {
  x: number;
  y: number;
  size: number;
  rotation: number;
  showAt: number;
};

// Back-to-front paint order. Higher-value drops gain height and width gradually,
// while the count label remains the exact statement of the reward.
const COIN_LAYERS: readonly CoinLayer[] = [
  { x: -10, y: -30, size: 36, rotation: -5, showAt: 7 },
  { x: 11, y: -27, size: 36, rotation: 6, showAt: 6 },
  { x: -18, y: -18, size: 37, rotation: -9, showAt: 4 },
  { x: 17, y: -18, size: 37, rotation: 9, showAt: 5 },
  { x: -18, y: -7, size: 38, rotation: -7, showAt: 2 },
  { x: 18, y: -6, size: 38, rotation: 7, showAt: 3 },
  { x: 0, y: 2, size: 40, rotation: 0, showAt: 1 },
] as const;

function visibleCoinCount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(COIN_LAYERS.length, Math.ceil(Math.log2(Math.floor(amount) + 1)));
}

/**
 * A compact floor pile assembled from the existing gold coin painting.
 * The anchor is the pile's bottom center, matching the room actor/loot anchors.
 */
export function GoldLootSprite({
  amount,
  x = 0,
  y = 0,
  scale = 1,
  className,
}: GoldLootSpriteProps) {
  const filterId = useId();
  const coinCount = visibleCoinCount(amount);

  if (coinCount === 0) return null;

  return (
    <g
      className={className}
      transform={`translate(${x} ${y}) scale(${scale})`}
      data-visible-coins={coinCount}
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="135%" colorInterpolationFilters="sRGB">
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  20 20 20 0 -0.1"
            result="alpha"
          />
          <feComposite in="SourceGraphic" in2="alpha" operator="in" />
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#080403" floodOpacity=".65" />
        </filter>
      </defs>
      {COIN_LAYERS.filter((coin) => coin.showAt <= coinCount).map((coin) => (
        <image
          key={coin.showAt}
          href={GOLD_COIN_IMAGE}
          x={coin.x - coin.size / 2}
          y={coin.y - coin.size}
          width={coin.size}
          height={coin.size}
          transform={`rotate(${coin.rotation} ${coin.x} ${coin.y - coin.size / 2})`}
          filter={`url(#${filterId})`}
        />
      ))}
    </g>
  );
}
