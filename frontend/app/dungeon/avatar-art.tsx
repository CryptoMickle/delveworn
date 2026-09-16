"use client";

import { useId } from "react";

export type AvatarOrientation = "north" | "south";

const AVATAR_SOURCE: Record<AvatarOrientation, string> = {
  north: "/dungeon/adventurer.webp",
  south: "/dungeon/adventurer-south.webp",
};

/**
 * Lower-leg masks begin beneath the coat and cloak. Each moving copy extends
 * above its knee pivot, while the final joint cover restores the original
 * cloak/cuff pixels over that overlap so a stride cannot open a seam.
 */
export const AVATAR_LEG_PATHS = {
  north: {
    back: "M360 965 H580 V1200 H360 Z",
    front: "M620 920 H930 V1200 H620 Z",
    cutout: "M360 970 H580 V1278 H360 Z M620 950 H925 V1278 H620 Z",
    cover: "M0 0 H1230 V980 H0 Z",
    backOrigin: "468px 970px",
    frontOrigin: "735px 950px",
  },
  south: {
    back: "M430 950 H625 V1230 H430 Z",
    front: "M610 900 H920 V1180 H610 Z",
    cutout: "M430 960 H610 V930 H920 V1278 H430 Z",
    cover: "M0 0 H1230 V970 H0 Z",
    backOrigin: "527px 960px",
    frontOrigin: "703px 930px",
  },
} as const;

type AvatarSpriteProps = {
  walking?: boolean;
  orientation?: AvatarOrientation;
};

function AvatarImage({ source, filterId, clipId }: {
  source: string;
  filterId: string;
  clipId?: string;
}) {
  return <image href={source} width="1230" height="1278" preserveAspectRatio="none"
    filter={`url(#${filterId})`} clipPath={clipId ? `url(#${clipId})` : undefined} />;
}

/** The approved raster remains untouched; only clipped copies of its legs move. */
export function AvatarSprite({ walking = false, orientation = "north" }: AvatarSpriteProps = {}) {
  const prefix = useId();
  const filterId = `${prefix}-avatar-alpha`;
  const bodyClipId = `${prefix}-avatar-body`;
  const backClipId = `${prefix}-avatar-back-leg`;
  const frontClipId = `${prefix}-avatar-front-leg`;
  const coverClipId = `${prefix}-avatar-joint-cover`;
  const paths = AVATAR_LEG_PATHS[orientation];
  const source = AVATAR_SOURCE[orientation];
  const preloadSource = AVATAR_SOURCE[orientation === "north" ? "south" : "north"];

  return <svg viewBox="0 0 1230 1278" aria-hidden="true"
    className={`dungeon-avatar-art${walking ? " is-walking" : ""}`}
    data-avatar-orientation={orientation} data-avatar-walking={walking ? "true" : "false"}>
    <defs>
      <filter id={filterId} colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  20 20 20 0 -0.1" result="alpha" />
        <feComposite in="SourceGraphic" in2="alpha" operator="in" />
      </filter>
      {walking && <>
        <clipPath id={backClipId} clipPathUnits="userSpaceOnUse"><path d={paths.back} /></clipPath>
        <clipPath id={frontClipId} clipPathUnits="userSpaceOnUse"><path d={paths.front} /></clipPath>
        <clipPath id={coverClipId} clipPathUnits="userSpaceOnUse"><path d={paths.cover} /></clipPath>
        <clipPath id={bodyClipId} clipPathUnits="userSpaceOnUse">
          <path d={`M0 0 H1230 V1278 H0 Z ${paths.cutout}`} fillRule="evenodd" clipRule="evenodd" />
        </clipPath>
      </>}
    </defs>
    <image href={preloadSource} width="1" height="1" opacity="0" pointerEvents="none"
      data-avatar-preload={orientation === "north" ? "south" : "north"} />
    {!walking
      ? <g data-avatar-part="original"><AvatarImage source={source} filterId={filterId} /></g>
      : <g data-avatar-gait={orientation}>
          <g data-avatar-part="body"><AvatarImage source={source} filterId={filterId} clipId={bodyClipId} /></g>
          <g data-avatar-part="back-leg" className="dungeon-avatar-leg dungeon-avatar-leg-back"
            style={{ transformOrigin: paths.backOrigin }}>
            <AvatarImage source={source} filterId={filterId} clipId={backClipId} />
          </g>
          <g data-avatar-part="front-leg" className="dungeon-avatar-leg dungeon-avatar-leg-front"
            style={{ transformOrigin: paths.frontOrigin }}>
            <AvatarImage source={source} filterId={filterId} clipId={frontClipId} />
          </g>
          <g data-avatar-part="joint-cover"><AvatarImage source={source} filterId={filterId} clipId={coverClipId} /></g>
        </g>}
  </svg>;
}
