import { FAMILY_COPY } from "./catalogue";
import type { Entity, Family, Relationship, Room, Run } from "./types";

/** Presentation identities are shared by the board, prose and AI context.
 * Historical world names stay immutable: changing them would invalidate saved plans. */
export const GUARDIAN_CAST = {
  bell: { type: 1, room: 1, name: "Gary", species: "Goblin" },
  kiln: { type: 2, room: 11, name: "Brutus", species: "Orc" },
  archive: { type: 1, room: 11, name: "Gribnob the Unqualified", species: "Goblin" },
  bridge: { type: 2, room: 1, name: "Thud", species: "Orc" },
  garden: { type: 0, room: 21, name: "Velvet Rot", species: "Zombie" },
  tribunal: { type: 2, room: 21, name: "Gronk", species: "Orc" },
  reservoir: { type: 0, room: 11, name: "Miss Morgue", species: "Zombie" },
} as const;

export const KEVIN_NAME = "Quartermaster Kevin";
export const KEVIN_RELATIONSHIP = "kiln";
export const guardianCast = (family: Family) => family === "echo" ? null : GUARDIAN_CAST[family];
export const isKevin = (room: Room, entity: Entity) => room.family === "kiln" && entity.role === "captive";

const aliases = new Map<string, string>([
  ...Object.entries(GUARDIAN_CAST).map(([family, cast]) => [FAMILY_COPY[family as keyof typeof GUARDIAN_CAST].guardian, `${cast.name} · ${cast.species}`] as [string, string]),
  [FAMILY_COPY.kiln.captive, KEVIN_NAME],
]);
export const displayName = (name: string) => aliases.get(name) ?? name;
export function entityName(room: Room, entity: Entity): string {
  const cast = entity.role === "guardian" && guardianCast(room.family);
  return cast ? `${cast.name} · ${cast.species}` : isKevin(room, entity) ? KEVIN_NAME : entity.name;
}

export function witnessName(run: Run, roomIndex: number, id: string): string {
  const present = roomIndex === run.room.index && run.room.entities.find(e => e.id === id);
  if (present) return entityName(run.room, present);
  const family = run.history[roomIndex];
  if (!family) return "A witness";
  if (id === "guardian") return displayName(FAMILY_COPY[family].guardian);
  if (id === "captive") return displayName(FAMILY_COPY[family].captive);
  return id === "observer" ? roomIndex > 11 ? "The Wandering Scribe" : "The One-Handed Scribe" : "Another Witness";
}

/** Only use on authored world prose, never player input or personal maneuver names.
 * Quoted maneuver names inside historical facts are preserved verbatim. */
export function worldText(text: string): string {
  return text.split(/(“[^”]*”)/g).map((part, index) => {
    if (index % 2) return part;
    for (const [from, to] of aliases) part = part.replaceAll(from, to);
    return part;
  }).join("");
}

export function favorAvailability(run: Run, relationship: Relationship) {
  const reason = run.status !== "playing" ? "Return to the chamber before calling in a favour."
    : run.activePlan ? "Finish or stop your plan before calling in a favour."
    : relationship.debt < 1 ? "No favours owed. Help them again to earn another."
    : run.room.index < 4 ? "Supply routes open in chamber 5. Your favour will wait."
    : run.facts.some(f => f.room === run.room.index && f.actor === relationship.id && f.kind === "choice") ? "Already helped in this chamber. Another favour must wait until the next."
    : null;
  return { reason, supplies: !reason && run.player.potions < 4, silence: !reason && !!run.room.entities.find(e => e.id === "relay")?.active };
}
