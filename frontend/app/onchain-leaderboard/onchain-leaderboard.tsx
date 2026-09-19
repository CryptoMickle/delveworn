"use client";

import { useEffect, useState } from "react";
import {
  shortPlayerAddress,
  type OnchainLeaderboardSnapshot,
} from "./core";

type Reply = Omit<OnchainLeaderboardSnapshot, "rows"> & {
  rows: Array<OnchainLeaderboardSnapshot["rows"][number] & { own: boolean }>;
  requestedPlayer: string | null;
};

async function fetchStandings(player: string | null): Promise<Reply> {
  const query = player ? `?player=${encodeURIComponent(player)}` : "";
  const response = await fetch(`/api/onchain-leaderboard${query}`, { cache: "no-store" });
  const reply = await response.json() as Reply & { message?: string };
  if (!response.ok) throw new Error(reply.message ?? "Somnia standings are temporarily unavailable.");
  return reply;
}

export function OnchainLeaderboard({
  explorerUrl,
  player = null,
}: {
  explorerUrl: string;
  player?: string | null;
}) {
  const [board, setBoard] = useState<Reply | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const reply = await fetchStandings(player);
      setBoard(reply);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : "Somnia standings are temporarily unavailable. Your onchain run is unaffected.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchStandings(player).then(reply => {
      if (cancelled) return;
      setBoard(reply);
      setMessage(null);
    }).catch(error => {
      if (!cancelled) setMessage(error instanceof Error
        ? error.message
        : "Somnia standings are temporarily unavailable. Your onchain run is unaffected.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [player]);

  const explorer = explorerUrl.replace(/\/+$/, "");
  const ownVisible = board?.rows.some(row => row.own) ?? false;

  return <section className="onchain-leaderboard" aria-labelledby="onchain-leaderboard-title">
    <div className="onchain-leaderboard-heading">
      <div>
        <p className="descent-kicker">SOMNIA · DEEPEST DESCENT</p>
        <h2 id="onchain-leaderboard-title">Onchain standings</h2>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading}>
        {loading ? "Reading chain…" : "Refresh"}
      </button>
    </div>

    <p className="onchain-leaderboard-rule">
      Ranked by the most rooms cleared in one run. Equal depths share a rank. Runs in progress count.
    </p>

    {message && <p className="onchain-leaderboard-message" role="status">{message}</p>}
    {loading && !board && <p className="onchain-leaderboard-message" role="status">Reading verified contract events…</p>}

    {board && <>
      <div className="onchain-leaderboard-proofbar">
        <span>{board.totalPlayers.toLocaleString()} public gameplay {board.totalPlayers === 1 ? "account" : "accounts"}</span>
        <span>{board.stale ? "Cached snapshot" : `Indexed through block ${board.indexedThroughBlock.toLocaleString()}`}</span>
      </div>

      {player && !ownVisible && <p className="onchain-leaderboard-message">
        This gameplay account has not cleared a room on this contract yet.
      </p>}

      {board.rows.length === 0 ? <p className="onchain-leaderboard-message">No completed rooms yet. The dungeon is open.</p> :
        <div className="onchain-leaderboard-table-wrap">
          <table>
            <thead><tr><th scope="col">Rank</th><th scope="col">Gameplay account</th><th scope="col">Deepest run</th><th scope="col">Proof</th></tr></thead>
            <tbody>{board.rows.map(row => <tr key={row.player} data-own={row.own || undefined}>
              <td>#{row.position}</td>
              <th scope="row">
                <a href={`${explorer}/address/${row.player}`} target="_blank" rel="noreferrer">
                  {shortPlayerAddress(row.player)} ↗
                </a>
                {row.own && <span>YOU</span>}
              </th>
              <td><strong>{row.roomsCleared.toLocaleString()}</strong> {row.roomsCleared === 1 ? "room" : "rooms"}</td>
              <td><a href={`${explorer}/tx/${row.proofTransactionHash}`} target="_blank" rel="noreferrer">Event ↗</a></td>
            </tr>)}</tbody>
          </table>
        </div>}

      <details className="onchain-leaderboard-details">
        <summary>How is this verified?</summary>
        <p>The board reads MonsterSpawned and CombatResolved events from the active Delveworn contract, starting at its creation block. The browser cannot submit or edit a score.</p>
        <p>Each gameplay account keeps its best depth. A standard MetaMask account and a popup-free smart account appear separately because the contract records them as separate players.</p>
        <p>Wallet addresses, room progress and proof transactions shown here are already public on Somnia Shannon Testnet.</p>
      </details>
    </>}
  </section>;
}
