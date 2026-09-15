import type { KeyboardEvent, PointerEvent, RefObject } from "react";

export type Point = { x: number; y: number };
export type Cue = "attack" | "storm" | "potion" | null;

/** A single vector art study. Geometry and light never read gameplay randomness. */
function Masonry() {
  return <>
    <defs>
      <clipPath id="concept-relic-clip"><circle cx="-50" cy="-75" r="18" /></clipPath>
      <linearGradient id="room-floor" x2=".8" y2="1">
        <stop stopColor="#34312e" /><stop offset="1" stopColor="#1d1d24" />
      </linearGradient>
      <linearGradient id="room-stone" x2="0" y2="1">
        <stop stopColor="#56504a" /><stop offset="1" stopColor="#24242b" />
      </linearGradient>
      <linearGradient id="room-wall" x2="0" y2="1">
        <stop stopColor="#24232b" /><stop offset=".6" stopColor="#35323a" /><stop offset="1" stopColor="#141419" />
      </linearGradient>
      <radialGradient id="torch-light">
        <stop stopColor="#ffad43" stopOpacity=".28" /><stop offset=".45" stopColor="#d9752c" stopOpacity=".1" /><stop offset="1" stopColor="#ed8a31" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="room-vignette">
        <stop offset=".32" stopColor="#090a11" stopOpacity="0" /><stop offset="1" stopColor="#080a0f" stopOpacity=".9" />
      </radialGradient>
      <linearGradient id="door-light" x2="0" y2="1">
        <stop stopColor="#8b71b6" stopOpacity=".45" /><stop offset="1" stopColor="#a491c8" stopOpacity="0" />
      </linearGradient>
      <pattern id="room-tiles" width="134" height="104" patternUnits="userSpaceOnUse">
        <path d="M3 5 66 3 65 50 4 51Z" fill="#37353a" stroke="#14161d" strokeWidth="3" />
        <path d="m71 4 60 2-1 45-60-1Z" fill="#323137" stroke="#14161d" strokeWidth="3" />
        <path d="m3 57 94-2 1 45-95 1Z" fill="#2b2c33" stroke="#14161d" strokeWidth="3" />
        <path d="m103 56 28 2-1 41-27 1Z" fill="#35333a" stroke="#14161d" strokeWidth="3" />
        <path d="M7 9 60 7M75 9h49M9 61l81-2M108 61h16" stroke="#625a55" opacity=".35" />
        <path d="m14 33 13 4 3 13m74 29-15 2-7 16m43-77-8 9 7 12" fill="none" stroke="#1b1d25" strokeWidth="2" />
        <path d="m8 49 10-1m51 44 8 2m29-63 5 2" stroke="#767064" opacity=".17" />
      </pattern>
      <pattern id="wall-blocks" width="110" height="40" patternUnits="userSpaceOnUse">
        <path d="M2 2h105v35H2Z" fill="url(#room-wall)" stroke="#101117" strokeWidth="3" />
        <path d="M7 6h94" stroke="#64594f" opacity=".4" />
      </pattern>
    </defs>
    <rect width="900" height="640" fill="#0a0c12" />
    <path d="M386 0h128v129H386Z" fill="#11121c" />
    <path d="M407 0h86v111h-86Z" fill="url(#room-tiles)" opacity=".36" />
    <path d="M79 131 112 87h676l36 44v405l-37 36H112l-33-36Z" fill="#090b10" stroke="#38353d" strokeWidth="3" />
    <rect x="112" y="134" width="676" height="401" fill="url(#room-floor)" />
    <rect x="112" y="134" width="676" height="401" fill="url(#room-tiles)" opacity=".78" />
    <path d="M124 157h652v365H124Z" fill="none" stroke="#746347" strokeWidth="2" opacity=".33" />
    <path d="M133 166h634v347H133Z" fill="none" stroke="#090d14" strokeWidth="4" />
    <rect x="89" y="82" width="723" height="77" fill="url(#wall-blocks)" />
    <path d="M83 78h735v16H83ZM87 147h726v16H87Z" fill="url(#room-stone)" stroke="#111219" strokeWidth="3" />
    <path d="M84 161h31v378H84Zm704 0h31v378h-31Z" fill="url(#wall-blocks)" stroke="#0e0f15" strokeWidth="4" />
    <path d="M87 537h307v30H87Zm418 0h309v30H505Z" fill="url(#room-stone)" stroke="#11121a" strokeWidth="4" />
    <path d="M394 536v91h111v-91" fill="url(#room-tiles)" stroke="#22222a" strokeWidth="8" />
    <path d="M395 557h109m-109 16h109m-109 17h109m-109 17h109" stroke="#090c12" strokeWidth="4" />
    <g opacity=".45" fill="none" stroke="#867053">
      <circle cx="451" cy="340" r="115" strokeWidth="2" />
      <circle cx="451" cy="340" r="103" />
      <circle cx="451" cy="340" r="87" strokeDasharray="2 16" strokeWidth="5" />
      <path d="m451 267 64 110H387Z" strokeWidth="2" /><path d="m451 413 64-110H387Z" strokeWidth="2" />
      <circle cx="451" cy="340" r="29" strokeWidth="2" />
      <path d="m451 313 10 27-10 27-10-27Z" />
      {[0,1,2,3].map(i => <path key={i} d="m443 204 8-12 8 12-8 12Z" transform={`rotate(${i*90} 451 340)`} />)}
    </g>
    {[{x:155,y:177},{x:744,y:177},{x:155,y:477},{x:744,y:477}].map(({x,y}) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
      <ellipse cy="25" rx="40" ry="18" fill="#080b10" opacity=".7" />
      <path d="m-24 15 0-49 11-8h26l11 8v49l-12 8h-24Z" fill="url(#room-stone)" stroke="#11131a" strokeWidth="3" />
      <path d="m-15-34 5-9H10l6 9v39l-6 9h-20l-5-9Z" fill="#414049" stroke="#716157" strokeOpacity=".5" />
      <path d="M-28-34h56v12h-56Zm-1 43h58v13h-58Z" fill="url(#room-stone)" stroke="#191c23" strokeWidth="2" />
    </g>)}
    {[250,650].map(x => <g key={x}>
      <ellipse cx={x} cy="176" rx="177" ry="191" fill="url(#torch-light)" />
      <g transform={`translate(${x} 113)`}>
        <path d="m-7 4 4 33h6L7 4Z" fill="#4b3428" stroke="#b28650" strokeWidth="2" />
        <path d="M-13 2h26l-5 12H-8Z" fill="#33252a" stroke="#96704c" strokeWidth="2" />
        <path className="concept-flame" d="M0-41C18-25 15-9 9 0H-8C-22-15-4-22 0-41Z" fill="#f59a3c" />
        <path d="M0-22C7-10 8-6 4 0H-4C-9-8 0-15 0-22Z" fill="#ffe4a0" />
      </g>
    </g>)}
    <g stroke="#766351" fill="none" strokeWidth="2" opacity=".55">
      <path d="M309 90q-10 78 44 31q30-28 25-51" strokeDasharray="4 4" />
      <path d="M538 80q-7 80 44 24" strokeDasharray="4 4" />
    </g>
    <g transform="translate(200 443) rotate(-14)">
      <ellipse cy="20" rx="41" ry="18" fill="#14151b" />
      <path d="m-26 6 8-22 21 2 10 22-9 8H-21Z" fill="#b6a384" stroke="#554a40" strokeWidth="3" />
      <path d="m-18 0 8-2 2 8h-10Zm19-2 7 2v6H0Z" fill="#29262a" />
      <path d="m-5 8 3 6h-7Z" fill="#53483d" />
      <path d="m12 17 30 9m-13-22L10 28" stroke="#897b66" strokeWidth="6" strokeLinecap="round" />
    </g>
    <g fill="#4c4544" stroke="#181b23" strokeWidth="2">
      <path d="m668 463 17-6 15 10-8 13-21-3Z" /><path d="m704 479 17-8 14 14-6 9-22-2Z" /><path d="m210 230 9-13 17 2 4 13-17 7Z" />
    </g>
    <path d="m185 304 24-13 10 13 21-5m429 98-24 3-15 16-19-2" stroke="#11151c" strokeWidth="3" fill="none" />
    <rect width="900" height="640" fill="url(#room-vignette)" pointerEvents="none" />
  </>;
}

function Adventurer() {
  return <g className="concept-avatar-body">
    <ellipse cy="1" rx="32" ry="12" fill="#070911" opacity=".75" />
    <path d="M-12-37-22-8l-1 8h17l7-36M8-36 7-5l3 7h16l-6-40" fill="#27262e" stroke="#0b1118" strokeWidth="3" />
    <path d="M-18-65C-36-45-39-22-38-11L-8-17 14-11 28-16 19-55Z" fill="#514065" stroke="#151720" strokeWidth="3" />
    <path d="m-15-59-15 40 23-10 15 12-4-45" fill="#736080" opacity=".65" />
    <path d="M-21-65 1-75l27 16-12 31-32 2Z" fill="#746958" stroke="#202027" strokeWidth="3" />
    <path d="m-15-59 15-5 20 9-9 20-23-2Z" fill="#b29869" /><path d="M-11-56 0-57l14 6-6 12h-16Z" fill="#81725b" />
    <path d="m-19-34 33 4-3 8-32-4Z" fill="#392c2a" stroke="#181922" strokeWidth="2" />
    <rect x="-3" y="-32" width="9" height="8" fill="#d3ae6b" rx="1" />
    <path d="m-26-58-8 17 10 9 9-13M22-58l15 14-4 16-12-4-4-14" fill="#8c785d" stroke="#211f23" strokeWidth="3" />
    <path d="m-25-68 7-22 20-8 20 14 3 27-22 5Z" fill="#51485e" stroke="#171720" strokeWidth="3" />
    <path d="m-16-72 14-15 15 13-2 16H-9Z" fill="#262332" />
    <path d="M-10-70h20l-4 16-13-3Z" fill="#b59a77" /><path d="M-10-71h21l-2 7h-19Z" fill="#1b1d29" />
    <path d="m-20-83 17-9 16 10" fill="none" stroke="#958497" strokeWidth="3" />
    <g className="concept-sword" transform="translate(34 -30) rotate(24)">
      <path d="M-3 8v-62l4-14 5 14V8Z" fill="#d0c8b5" stroke="#434950" strokeWidth="2" />
      <path d="M1-56V5" stroke="#f6ecce" /><path d="M-11 3h25v6h-25ZM0 9h5v17H0Z" fill="#bb9758" stroke="#544032" strokeWidth="2" />
    </g>
  </g>;
}

function Goblin() {
  return <g className="concept-goblin-body">
    <ellipse cy="1" rx="39" ry="13" fill="#0a0a13" opacity=".8" />
    <path d="m-20-35-9 26-8 6 4 5h22l5-29M8-30l7 30h23l-1-7-10-6-2-23" fill="#6e7749" stroke="#1c2222" strokeWidth="3" />
    <path d="m-27-56-11 11 4 21 15-3 6-22M24-57l18 17-3 16-15-1-7-18" fill="#8d9653" stroke="#2f342b" strokeWidth="3" />
    <path d="m-25-61 22-12 30 13 1 31-29 8-22-8Z" fill="#6a5440" stroke="#1f2428" strokeWidth="3" />
    <path d="m-16-56 12 22 18-28 9 11-6 25-24 2-16-21Z" fill="#998164" />
    <path d="m-27-41 51 7-3 9-48-8Z" fill="#30292b" stroke="#a08255" strokeWidth="2" />
    <path d="m-30-81-25-18 7 24 24 11m52-17 26-20-4 25-25 13" fill="#919750" stroke="#343b2d" strokeWidth="3" />
    <path d="m-24-91 22-9 25 10 9 25-13 15-28 3-19-19Z" fill="#9ca55d" stroke="#343929" strokeWidth="3" />
    <path d="m-19-73 12-5 2 13-12 1m22-14 16 1-1 10-13 3" fill="#d7c98d" /><path d="M-12-76v9m26-10-2 9" stroke="#201d22" strokeWidth="4" />
    <path d="m0-76-6 18 14-2-1-12Z" fill="#b6ad69" stroke="#797345" strokeWidth="2" />
    <path d="m-13-53 27-1-6 8-14-2Z" fill="#383027" /><path d="m-12-56 2 8 5-1m14-7-2 8 5-2" fill="#e1d5a4" />
    <path d="m-28-87 6-19 27-6 23 15 1 14-22-8-34 9Z" fill="#727575" stroke="#2a2b2e" strokeWidth="3" />
    <path d="m-19-104-12-17 3 26m40-13 15-15-6 22" fill="#cfbea0" stroke="#554b3f" strokeWidth="2" />
    <path d="m-4-109 10 21" stroke="#b8a47c" strokeWidth="5" />
    <g transform="translate(41 -35) rotate(-28)">
      <path d="M-3 18V-28H4v46Z" fill="#987451" stroke="#342d2c" strokeWidth="2" />
      <path d="m-15-34 7-11 18 2 9 15-7 14-21-3Z" fill="#767779" stroke="#252a30" strokeWidth="3" />
      <path d="m-12-39-8-9 1 14M-3-42l3-12 7 13m8 7 12-1-9 9M2-18l2 10 7-9" fill="#d0baa0" stroke="#484447" strokeWidth="2" />
    </g>
  </g>;
}

export function ConceptScene({ position, walking, inCombat, cleared, ended, atDoor, cue, turn, damage, incoming, critical, healed, onFloor, onKeys, svgRef }: {
  position: Point; walking: boolean; inCombat: boolean; cleared: boolean; ended: boolean;
  atDoor: boolean; cue: Cue; turn: number; damage: number; incoming: number; critical: boolean;
  healed: number; onFloor: (event: PointerEvent<SVGSVGElement>) => void;
  onKeys: (event: KeyboardEvent<SVGSVGElement>) => void; svgRef: RefObject<SVGSVGElement | null>;
}) {
  return <svg className="concept-scene" ref={svgRef} viewBox="0 0 900 640" preserveAspectRatio="xMidYMid slice"
    role="group" aria-label="Dungeon floor" aria-describedby="concept-controls" tabIndex={0}
    onPointerUp={onFloor} onKeyDown={onKeys} data-combat={inCombat} data-cleared={cleared}>
    <Masonry />
    <g aria-hidden="true">
      <g transform="translate(450 89)">
        <path d="M-56 76V-14Q0-74 56-14v90" fill="#0b0d16" stroke="#62535c" strokeWidth="15" />
        <path d="M-64 77h18M46 77h18M-59 47h13m91 0h17M-59 13h13m90 0h14M-37-30l10 12m54 0 12-12M0-46v20" stroke="#a28769" strokeWidth="4" opacity=".5" />
        {!cleared && <g stroke="#6e6672" strokeWidth="5"><path d="M-32-12v82m21-93v93m22-93v93m21-82v82M-44 14h88m-88 40h88" /><path d="M-8 46h16v15H-8Z" fill="#b2945c" strokeWidth="2" /></g>}
        {cleared && <path d="M-39 65 39 65 89 181H-89Z" fill="url(#door-light)" />}
      </g>
      <g className="concept-enemy" transform="translate(585 315)" data-defeated={cleared}>
        <ellipse rx="61" ry="25" fill="#b96750" fillOpacity=".07" stroke="#b96750" strokeOpacity={inCombat ? ".65" : ".22"} strokeDasharray="5 6" />
        <g key={`enemy-${turn}`} className={cue && cue !== "potion" ? "concept-hit" : ""}><Goblin /></g>
        {!cleared && <g transform="translate(0 -151)"><rect x="-43" y="-19" width="86" height="28" rx="5" fill="#1a141c" stroke="#55404b" /><text textAnchor="middle" fill="#ebceaf" fontSize="13" letterSpacing="2">GARY</text></g>}
      </g>
      <g className="concept-avatar" style={{ transform: `translate(${position.x}px, ${position.y}px)` }} data-x={position.x} data-y={position.y} data-walking={walking} data-dead={ended}>
        <ellipse rx="35" ry="14" fill="#afa0d1" fillOpacity=".08" stroke="#b5a2d6" strokeOpacity=".48" />
        <g key={`avatar-${turn}`} className={cue === "attack" ? "concept-lunge" : cue === "potion" ? "concept-heal" : ""}><Adventurer /></g>
        <g className="concept-relic" data-activated={cue === "storm"}>
          <ellipse cx="-50" cy="-67" rx="25" ry="20" fill="#9b5be8" opacity=".09" />
          <circle cx="-50" cy="-73" r="23" fill="#37234b" fillOpacity=".7" stroke="#bd93fb" strokeOpacity=".45" />
          <image href="/assets/relics/stormglass.webp" x="-67" y="-95" width="34" height="40" preserveAspectRatio="xMidYMid slice" clipPath="url(#concept-relic-clip)" />
          <path d="m-50-105 3 5-3 5-3-5Zm-29 22 2 4-2 4-2-4Z" fill="#d4b5ff" />
        </g>
        {cue === "potion" && <g key={`heal-${turn}`} className="concept-float" fill="#a6edc3"><text y="-110" textAnchor="middle" fontSize="23" fontWeight="700">+{healed} net HP</text></g>}
        {cue && incoming > 0 && <text key={`incoming-${turn}`} className="concept-float concept-incoming" x="33" y="-112" fill="#f7b1a5" fontSize="21" fontWeight="700">−{incoming}</text>}
      </g>
      {cue === "storm" && <g key={`storm-${turn}`} className="concept-lightning" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${position.x-50} ${position.y-78} 395 230 450 252 469 173 505 224 585 247`} stroke="#8d4bda" strokeWidth="17" opacity=".28" />
        <path d={`M${position.x-50} ${position.y-78} 395 230 450 252 469 173 505 224 585 247`} stroke="#b994fd" strokeWidth="6" />
        <path d={`M${position.x-50} ${position.y-78} 395 230 450 252 469 173 505 224 585 247`} stroke="#f1e1ff" strokeWidth="2" />
        <path d="m467 173-6-48 26 14m17 84 37-45 18 4" stroke="#bfa2fc" strokeWidth="2" />
      </g>}
      {cue === "attack" && <path key={`slash-${turn}`} className="concept-slash" d="M523 197Q578 278 644 286Q576 322 523 197" fill="#f2dbaa" fillOpacity=".85" />}
      {cue && cue !== "potion" && <g key={`damage-${turn}`} className="concept-float"><text x="585" y="132" textAnchor="middle" fontSize={critical ? "36" : "30"} fontWeight="700" fill={cue === "storm" ? "#dac3ff" : "#ffda94"}>{critical ? "CRIT " : ""}{damage}</text></g>}
      {atDoor && <g><rect x="247" y="235" width="406" height="86" rx="8" fill="#18141f" stroke="#a68b64" /><text x="450" y="268" textAnchor="middle" fill="#e9d2b0" fontSize="21" fontFamily="Georgia, serif">The next descent awaits.</text><text x="450" y="293" textAnchor="middle" fill="#b1a4bf" fontSize="13">End of this one-room concept</text></g>}
    </g>
  </svg>;
}
