import type { ReactNode } from "react";
import { RunCard, type RunCardData } from "./run-card";

/** The ended snapshot and all actions remain owned by the current game mode. */
export function DungeonRunEnd({ data, restartAction, copyAction, log, feedback }: {
  data: RunCardData;
  restartAction: ReactNode;
  copyAction?: ReactNode;
  log: string[];
  feedback?: ReactNode;
}) {
  return (
    <div className="dungeon-run-end practice-result-view" data-keyboard-action-scope aria-label="Run ended">
      <div className="run-end-left">
        <section className="run-end-summary" aria-label="Run result">
          <p className="run-end-kicker">RUN ENDED</p>
          <h2>You cleared {data.roomsCleared} {data.roomsCleared === 1 ? "room" : "rooms"}.</h2>
          <p className="run-end-reset-note">New runs start at 100 HP, 3 potions, 0 gold, weapon 0, armor 0 and no relic.</p>
          <div className="run-end-restart" data-keyboard-actions>{restartAction}</div>
        </section>
        <section className="run-end-log" aria-label="Dungeon log">
          <header>
            <h3>DUNGEON LOG</h3>
            <p>The expedition ends here.</p>
          </header>
          {feedback && <div className="run-end-feedback" role="status" aria-live="polite">{feedback}</div>}
          <div>{log.length
            ? log.slice(0, 4).map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)
            : <p>The dungeon has updated your performance review.</p>}
          </div>
          {log.length > 4 && <details><summary>Earlier entries</summary>{log.slice(4).map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}</details>}
        </section>
      </div>
      <RunCard data={data} copyAction={copyAction} />
    </div>
  );
}
