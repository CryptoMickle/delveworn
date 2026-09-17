"use client";

import { useEffect, useState } from "react";
import type { LeaderboardSnapshot } from "./core";

export type WeeklyLeaderboardProps = {
  challengeId: string;
  proof?: string | null;
  personalBest?: number | null;
  friendScore?: number | null;
};

type LeaderboardReply = LeaderboardSnapshot & {
  submission?: {
    status: "inserted" | "improved" | "retained";
    entryId: string;
    score: number;
  };
};

type LeaderboardErrorReply = {
  code?: string;
  message?: string;
  reason?: string;
};

function submissionErrorMessage(reply: LeaderboardErrorReply): string {
  if (reply.message) return reply.message;
  const messages: Record<string, string> = {
    origin: "This score request could not be confirmed as coming from Delveworn. Reload the page and try again.",
    guest_cookie_required: "Your guest session was refreshed. Try posting your score once more.",
    archive_read_only: "This week has ended, so its standings are read-only.",
    rate_limit: "Too many score attempts at once. Wait a minute and try again.",
    invalid_proof: "This run could not be verified. Your score was not posted.",
    request_size: "This score proof is too large to submit.",
    invalid_schema: "This score submission could not be read. Reload the page and try again.",
    capacity: "The leaderboard is temporarily full. Your run and share link still work.",
    storage_error: "The leaderboard is temporarily unavailable. Your run and share link still work.",
    disabled_by_config: "The leaderboard is currently unavailable. Your run and share link still work.",
  };
  return messages[reply.code ?? ""]
    ?? messages[reply.reason ?? ""]
    ?? "Leaderboard unavailable. Your run and share link still work.";
}

export function WeeklyLeaderboard({
  challengeId,
  proof = null,
  personalBest = null,
  friendScore = null,
}: WeeklyLeaderboardProps) {
  const [board, setBoard] = useState<LeaderboardReply | null>(null);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/leaderboard/${encodeURIComponent(challengeId)}`, {
      credentials: "same-origin",
      cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const reply = await response.json() as LeaderboardReply;
      if (!cancelled) {
        setBoard(reply);
        setMessage(null);
      }
    }).catch(() => {
      if (!cancelled) setMessage("Leaderboard unavailable. Your run and share link still work.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [challengeId]);

  async function submit(): Promise<void> {
    if (!proof || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/leaderboard/${encodeURIComponent(challengeId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof, ...(nickname.trim() ? { nickname } : {}) }),
      });
      const reply = await response.json() as LeaderboardReply & LeaderboardErrorReply;
      if (!response.ok) throw new Error(submissionErrorMessage(reply));
      setBoard(reply);
      setMessage(reply.submission?.status === "retained"
        ? "Your earlier best score stays on the board."
        : "Your verified score is on the board.");
    } catch (error) {
      setMessage(error instanceof Error && error.message !== "unavailable"
        ? error.message
        : "Leaderboard unavailable. Your run and share link still work.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="weekly-leaderboard" aria-labelledby="weekly-leaderboard-title">
    <div className="weekly-leaderboard-heading">
      <div>
        <p className="descent-kicker">WEEKLY STANDINGS</p>
        <h2 id="weekly-leaderboard-title">The First Descent leaderboard</h2>
      </div>
      {board?.archived && <span>Final standings</span>}
      {board?.developmentOnly && <span>Local test board · development only</span>}
    </div>

    {(personalBest !== null || friendScore !== null) && <dl className="weekly-leaderboard-comparison">
      {personalBest !== null && <div><dt>Personal best</dt><dd>{personalBest.toLocaleString()}</dd></div>}
      {friendScore !== null && <div><dt>Shared score</dt><dd>{friendScore.toLocaleString()}</dd></div>}
    </dl>}

    {board?.archived && <p>This challenge has ended, so its standings are read-only. You can still share its verified result link.</p>}
    {proof && board && !board.archived && <div className="weekly-leaderboard-submit" data-keyboard-actions>
      <label>
        Nickname <span>(optional)</span>
        <input
          value={nickname}
          onChange={event => setNickname(event.target.value)}
          maxLength={20}
          autoComplete="nickname"
          placeholder="Anonymous guest"
        />
      </label>
      <button type="button" disabled={submitting} onClick={() => void submit()}>
        {submitting ? "Verifying…" : "Post verified score"}
      </button>
    </div>}

    {proof && board && <details className="weekly-proof-details"><summary>What is saved?</summary><p>Posting is optional. The server replays your actions and keeps your best result for this week and the action history needed to check it. Your optional nickname is saved, and a guest identity stays in a browser cookie. Clear the cookie and you may lose access to that guest profile. Scores and nicknames are public; past weeks remain readable.</p><p>Basic start, completion and share events help improve the game. They contain no action proof, nickname or wallet address. No wallet or account is needed.</p></details>}
    {message && <p role="status">{message}</p>}
    {loading && <p role="status">Loading standings…</p>}
    {!loading && board && board.rows.length === 0 && <p>{board.archived
      ? "No verified scores were posted for this challenge."
      : "No verified scores yet. The board is open."}</p>}
    {board && board.rows.length > 0 && <div className="weekly-leaderboard-table-wrap">
      <table>
        <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Score</th><th scope="col">Rooms</th></tr></thead>
        <tbody>{board.rows.map(row => <tr key={row.entryId} data-own={row.own || undefined}>
          <td>#{row.position}</td>
          <th scope="row">{row.nickname ?? (row.nicknameHidden ? "Name hidden" : "Guest")}{row.own ? " (you)" : ""}</th>
          <td>{row.result.score.toLocaleString()}</td>
          <td>{row.result.roomsCleared}/10</td>
        </tr>)}</tbody>
      </table>
      <p>{board.totalEntries.toLocaleString()} verified {board.totalEntries === 1 ? "run" : "runs"}</p>
    </div>}
  </section>;
}
