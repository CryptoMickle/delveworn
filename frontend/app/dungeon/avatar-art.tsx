"use client";

import { useId } from "react";

export type AvatarOrientation = "north" | "south";

const AVATAR_SOURCE: Record<AvatarOrientation, string> = {
  north: "/dungeon/adventurer.webp",
  south: "/dungeon/adventurer-south.webp",
};

type LegRig = {
  path: string;
  cutout: string;
  origin: string;
};

/**
 * The source art is rendered in its existing 1230 × 1278 coordinate space.
 * The exposed leg is a continuous clipped copy that swings from the hip. The
 * cape-side leg uses its visible lower portion for a smaller counterstep, while
 * a static source-art cover keeps the cape and concealed joints intact.
 */
export const AVATAR_LEG_PATHS: Record<AvatarOrientation, {
  back: LegRig;
  front: LegRig;
  active: "back" | "front";
  cover: string;
}> = {
  north: {
    back: {
      path: "M410 900 L535 900 L535 960 L520 975 L520 1140 L380 1140 L380 970 L395 930 Z",
      cutout: "M410 900 L535 900 L535 960 L520 975 L520 1140 L380 1140 L380 970 L395 930 Z",
      origin: "475px 790px",
    },
    front: {
      path: "M620 660 L755 650 L760 755 L785 825 L810 915 L790 950 L660 945 L650 860 L630 790 Z M640 850 H820 V950 L900 1000 V1170 H630 V960 L650 920 Z",
      cutout: "M610 640 H810 V840 H920 V1190 H620 V840 H610 Z",
      origin: "690px 690px",
    },
    active: "front",
    cover: [
      "M0 0 H1230 V700 H0 Z",
      "M510 620 L750 620 L760 755 L725 830 L650 820 L610 850 L565 800 L560 700 Z",
      "M730 600 H890 V860 H760 V760 H730 Z",
      "M385 865 H545 V960 H385 Z",
    ].join(" "),
  },
  south: {
    back: {
      path: "M630 650 L730 640 L755 700 L760 780 L790 860 L780 900 L660 900 L645 850 L650 770 Z M630 800 H805 V915 H890 V1130 H610 V920 L640 880 Z",
      cutout: "M620 630 H790 V790 H900 V1150 H610 V790 H620 Z",
      origin: "695px 665px",
    },
    front: {
      path: "M485 860 L620 850 L620 920 L600 995 L645 1100 L630 1160 L580 1180 L455 1170 L430 1130 L450 1050 L455 960 L470 900 Z",
      cutout: "M485 860 L620 850 L620 920 L600 995 L645 1100 L630 1160 L580 1180 L455 1170 L430 1130 L450 1050 L455 960 L470 900 Z",
      origin: "535px 865px",
    },
    active: "back",
    cover: [
      "M0 0 H1230 V675 H0 Z",
      "M515 610 L730 610 L745 765 L700 845 L650 830 L610 865 L555 830 Z",
      "M450 610 H550 V790 L520 810 L470 785 Z",
      "M720 610 H875 V775 L815 790 L760 755 Z",
    ].join(" "),
  },
};

type AvatarSpriteProps = {
  walking?: boolean;
  orientation?: AvatarOrientation;
};

function AvatarImage({ source, filterId, clipId, maskId }: {
  source: string;
  filterId: string;
  clipId?: string;
  maskId?: string;
}) {
  return <image href={source} width="1230" height="1278" preserveAspectRatio="none"
    filter={`url(#${filterId})`} clipPath={clipId ? `url(#${clipId})` : undefined}
    mask={maskId ? `url(#${maskId})` : undefined} />;
}

function RiggedLeg({ source, filterId, clipId, name, rig, primary }: {
  source: string;
  filterId: string;
  clipId: string;
  name: "back" | "front";
  rig: LegRig;
  primary: boolean;
}) {
  return <g data-avatar-part={`${name}-leg`} data-avatar-joint="whole-leg"
    className={`dungeon-avatar-leg dungeon-avatar-leg-${name} dungeon-avatar-leg-${primary ? "primary" : "secondary"}`}
    style={{ transformOrigin: rig.origin }}>
    <AvatarImage source={source} filterId={filterId} clipId={clipId} />
  </g>;
}

/** The approved raster remains untouched; walking uses articulated clipped copies. */
export function AvatarSprite({ walking = false, orientation = "north" }: AvatarSpriteProps = {}) {
  const prefix = useId();
  const filterId = `${prefix}-avatar-alpha`;
  const bodyMaskId = `${prefix}-avatar-body`;
  const coverClipId = `${prefix}-avatar-joint-cover`;
  const backClipId = `${prefix}-avatar-back-leg`;
  const frontClipId = `${prefix}-avatar-front-leg`;
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
        <clipPath id={backClipId} clipPathUnits="userSpaceOnUse"><path d={paths.back.path} /></clipPath>
        <clipPath id={frontClipId} clipPathUnits="userSpaceOnUse"><path d={paths.front.path} /></clipPath>
        <clipPath id={coverClipId} clipPathUnits="userSpaceOnUse"><path d={paths.cover} /></clipPath>
        <mask id={bodyMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1230" height="1278">
          <rect width="1230" height="1278" fill="white" />
          <path d={paths.back.cutout} fill="black" />
          <path d={paths.front.cutout} fill="black" />
        </mask>
      </>}
    </defs>
    <image href={preloadSource} width="1" height="1" opacity="0" pointerEvents="none"
      data-avatar-preload={orientation === "north" ? "south" : "north"} />
    {!walking
      ? <g data-avatar-part="original"><AvatarImage source={source} filterId={filterId} /></g>
      : <g data-avatar-gait={orientation}>
          <g data-avatar-part="body"><AvatarImage source={source} filterId={filterId} maskId={bodyMaskId} /></g>
          <RiggedLeg source={source} filterId={filterId} name="back" rig={paths.back}
            clipId={backClipId} primary={paths.active === "back"} />
          <RiggedLeg source={source} filterId={filterId} name="front" rig={paths.front}
            clipId={frontClipId} primary={paths.active === "front"} />
          <g data-avatar-part="joint-cover"><AvatarImage source={source} filterId={filterId} clipId={coverClipId} /></g>
        </g>}
  </svg>;
}
