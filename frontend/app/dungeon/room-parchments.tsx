import { MonsterSpeech, type MonsterSpeechContext } from "./monster-speech";

type RoomParchmentsProps = {
  monster?: { name: string; role: string; description: string };
  speech: MonsterSpeechContext;
};

/** Read-only room atmosphere. It never takes pointer input from the floor. */
export function RoomParchments({ monster, speech }: RoomParchmentsProps) {
  return <div className="room-parchments">
    {monster && <aside className="room-parchment room-parchment-monster" aria-label="Monster field notes">
      <p className="room-parchment-label">Field notes · {monster.role}</p>
      <h2>{monster.name}</h2>
      <p className="room-parchment-copy">{monster.description}</p>
    </aside>}
    <MonsterSpeech {...speech} />
  </div>;
}
