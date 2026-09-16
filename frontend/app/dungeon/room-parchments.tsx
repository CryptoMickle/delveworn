type RoomParchmentsProps = {
  monster?: { name: string; role: string; description: string };
  entries: readonly string[];
  fallback?: string;
};

/** Read-only room atmosphere: reuse the existing persona and confirmed log.
 * The overlay never takes pointer input away from walking or floor loot. */
export function RoomParchments({ monster, entries, fallback }: RoomParchmentsProps) {
  const notes=entries.filter(entry => entry.trim()).slice(0,2).map(entry => {
    // The HUD/report already carries the numbers. Keep the existing punchline
    // when a combat or reward sentence precedes it in the same log entry.
    const sentences=entry.split(/(?<=[.!?])\s+/u);
    return sentences.length > 1 && /\d/.test(sentences[0]) && /\b(damage|hp|gold|potion)\b/i.test(sentences[0])
      ? sentences.slice(1).join(" ") : entry;
  });
  if (!notes.length && fallback) notes.push(fallback);
  return <div className="room-parchments">
    {monster && <aside className="room-parchment room-parchment-monster" aria-label="Monster field notes">
      <p className="room-parchment-label">Field notes · {monster.role}</p>
      <h2>{monster.name}</h2>
      <p className="room-parchment-copy">{monster.description}</p>
    </aside>}
    {notes.length > 0 && <aside className="room-parchment room-parchment-humor" aria-label="Dungeon remarks">
      <p className="room-parchment-label">The dungeon remarks</p>
      {notes.map((line,index) => <p className="room-parchment-copy" key={`${index}:${line}`}>{line}</p>)}
    </aside>}
  </div>;
}
