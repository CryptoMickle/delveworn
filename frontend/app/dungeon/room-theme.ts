import type { MonsterType } from "../practice/engine";

export type RoomTheme = {
  id: "crypt" | "goblin" | "orc" | "boss";
  backgroundSrc: string;
  openDoorPath: string;
  doorLightPath: string;
};

const ORIGINAL_DOOR = {
  openDoorPath:"M407 10 Q450 -10 493 10 L493 77 407 77Z",
  doorLightPath:"M420 76 L480 76 523 230 377 230Z",
};
const GENERATED_DOOR = {
  openDoorPath:"M407 10 Q450 -10 493 10 L493 90 407 90Z",
  doorLightPath:"M420 89 L480 89 523 230 377 230Z",
};
const ROOM_THEMES = [
  {id:"crypt",backgroundSrc:"/dungeon/stone-room.webp",...ORIGINAL_DOOR},
  {id:"goblin",backgroundSrc:"/dungeon/rooms/goblin-storeroom.webp",...GENERATED_DOOR},
  {id:"orc",backgroundSrc:"/dungeon/rooms/orc-armory.webp",...GENERATED_DOOR},
  {id:"boss",backgroundSrc:"/dungeon/rooms/boss-hall.webp",...GENERATED_DOOR},
] as const satisfies readonly RoomTheme[];

/** Room appearance follows the monster family and never combat phase state. */
export function getRoomTheme(monster: MonsterType): RoomTheme {
  return ROOM_THEMES[monster];
}
