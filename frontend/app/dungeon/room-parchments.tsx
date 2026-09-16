import type { ReactNode } from "react";
import { MonsterSpeech, type MonsterSpeechContext } from "./monster-speech";

export type MonsterFieldNotesData = { name: string; role: string; description: string };

/** The same field-note card is used on the room floor and expanded artwork. */
export function MonsterFieldNotes({ monster, className, children }: {
  monster: MonsterFieldNotesData;
  className?: string;
  children?: ReactNode;
}) {
  return <aside className={["room-parchment",className].filter(Boolean).join(" ")} aria-label="Monster field notes">
    <p className="room-parchment-label">Field notes · {monster.role}</p>
    <h2>{monster.name}</h2>
    <p className="room-parchment-copy">{monster.description}</p>
    {children}
  </aside>;
}

type RoomParchmentsProps = {
  monster?: MonsterFieldNotesData;
  speech: MonsterSpeechContext;
};

/** Read-only room atmosphere. It never takes pointer input from the floor. */
export function RoomParchments({ monster, speech }: RoomParchmentsProps) {
  return <div className="room-parchments">
    {monster && <MonsterFieldNotes monster={monster} className="room-parchment-monster" />}
    <MonsterSpeech {...speech} />
  </div>;
}
