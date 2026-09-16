import type { MonsterType } from "../practice/engine";

export type RoomTheme = {
  id: "crypt" | "goblin" | "orc" | "boss";
  artTier: number;
  backgroundSrc: string;
  referenceSrc: string;
  openDoorPath: string;
  doorLightPath: string;
};

const ROOM_DOOR = {
  openDoorPath:"M407 10 Q450 -10 493 10 L493 77 407 77Z",
  doorLightPath:"M420 76 L480 76 523 230 377 230Z",
};
const ROOM_ART = [
  {id:"crypt",files:["zombie-1-grave-belle.webp","zombie-2-miss-morgue.webp","zombie-3-velvet-rot.webp","zombie-4-lady-decomposition.webp"]},
  {id:"goblin",files:["goblin-1-gary.webp","goblin-2-kevin-the-unqualified.webp","goblin-3-gribble.webp","goblin-4-garys-supervisor.webp"]},
  {id:"orc",files:["orc-1-thud.webp","orc-2-brutus.webp","orc-3-gronk.webp","orc-4-meatwall.webp"]},
  {id:"boss",files:["boss-1-dungeon-lord.webp","boss-2-senior-dungeon-lord.webp","boss-3-executive-overlord.webp","boss-4-chairman-below.webp"]},
] as const;

/** Match the original monster painting's ten-room art cadence, capped at tier 4.
 * The selected room remains the same through combat, loot and recovery. */
export function getRoomTheme(monster: MonsterType, room = 1): RoomTheme {
  const artTier=Math.min(4,Math.max(1,Math.floor((room-1)/10)+1));
  const family=ROOM_ART[monster], file=family.files[artTier-1];
  return {id:family.id,artTier,backgroundSrc:`/dungeon/rooms/original/${file}`,
    referenceSrc:`/monsters/${file}`,...ROOM_DOOR};
}
