# Somnia onchain leaderboard recommendation

Date: 17 September 2026

Status: first version implemented and published to `delveworn.app` on
19 September 2026. No contract change is required.

## Implemented first version

- `/onchain/leaderboard` shows **Somnia — Deepest Descent** standings and
  links every row to its gameplay account and record-setting transaction.
- `/api/onchain-leaderboard` reconstructs records from the active contract's
  canonical `MonsterSpawned` and `CombatResolved` events. Browsers have no
  score-write endpoint.
- The verified deployment begins at block `476477529`. The event signatures
  and representative live history were checked against Somnia Shannon before
  implementation.
- The source replays complete deployment history on each cache refresh. This
  avoids cursor and rollback state while the event set is small, handles run
  restarts without losing the previous best, and re-reads reorganized history.
  A 64-block safety buffer excludes the chain tip.
- The existing Redis service stores only short-lived and fallback snapshots in
  a separate onchain namespace. Weekly guest identities, nicknames and proof
  submissions are not reused.
- The connected gameplay account can open **Your rank** from the wallet
  controls. Standard MetaMask and popup-free smart accounts remain separate.

## Recommendation

Add a separate **Somnia — Deepest Descent** leaderboard. Rank each gameplay
account by its highest number of rooms cleared in one run, including progress
in an ongoing run. Keep Weekly Challenge standings separate.

Weekly is a ten-room run with a shared weekly seed and a replay-verified score
that includes resources and combat actions (`frontend/app/descent/weekly.ts`).
Somnia uses independent VRF outcomes and continues beyond room ten. Combining
those results would compare different rules and different opportunities.

Do not reward elapsed time: wallet approval, bundling and VRF waits are outside
the player's tactical control. Equal depth should share a rank. The canonical
block/transaction/log position at which the record was achieved can provide
stable display order without awarding a higher rank for speed.

## First useful version

- Link to **Somnia leaderboard** from the onchain entrance and game menu.
- Show rank, shortened gameplay address, best depth, and an explorer link to
  the record-setting kill. Highlight the connected gameplay account.
- Keep one best record per account per chain, contract deployment and rules
  edition. Start with one deployment-scoped board; introduce seasons when
  gameplay changes materially. Avoid inventing a weekly reset for an ongoing
  endless run.
- Update records automatically from confirmed chain events. The browser must
  never submit a trusted score. No extra player transaction is needed.
- Use the existing Redis service, with a separate onchain key namespace and
  data model. Reuse visual components where suitable, but not Weekly's guest
  cookie identity, action-proof verifier or typed score-entry model.
- Defer custom nicknames, account merging and rewards. Address-based standings
  already answer the useful first question: who has gone deepest?

## Identity must match the contract

`src/Delveworn.sol` keys player state by `msg.sender`. Standard MetaMask plays
as its wallet address; Popup-free Play plays as its smart-account address
(`frontend/app/somnia-session-keys.ts` and `onchain-game.tsx`). These are
separate runs and should initially be separate gameplay accounts on the board.

Never identify the player by the temporary session-key address, transaction
sender, bundler or browser guest cookie. Use the event's indexed `player`.
Renewing a session for the same smart account must preserve that account's row.
Owner-to-smart-account grouping would need independently verified ownership
and a policy for multiple admins or ownership changes; a browser-supplied owner
address is insufficient. One address is not proof of one human.

## Can the current contract support it?

**A depth-record board does not inherently require a new contract.** The local
contract exposes `MonsterSpawned(player, room, ...)` and
`CombatResolved(player, ..., monsterDefeated)`. A canonical room-one spawn
marks a new run; subsequent successful kill events establish cleared depth.
Identify that run by the room-one transaction hash and log index. Pair kills
with the current spawned room and reject inconsistent sequences rather than
guessing. Retain the previous best when `startGame()` resets current state.

The existing getters expose only current player state, not a durable best or
enumerable player list. Polling `getPlayer()` alone would lose records after a
restart. There are no explicit `RunStarted`/`RunEnded` events or persistent run
IDs in the reviewed source. This limits clean end-of-run history, but not a
board of maximum verified depth. Do not label a historical run as ended unless
its terminal state is actually established.

**Before implementation:** verify the live V3 deployment's event signatures,
creation block and representative receipts against its actual runtime/source.
The local pending-loot V4 source is not proof of the deployed contract. Existing
preflight documents explicitly do not claim bytecode equivalence or complete
historical log coverage.

## Indexing and validation

Backfill canonical logs from the verified deployment block, then maintain a
durable cursor with bounded range reads. Persist block hashes, deduplicate logs,
handle reorganizations and replay from checkpoints. Publish only records past
a verified finality policy; do not rank optimistic UI/WebSocket snapshots.
If complete history is unavailable, label the board's verified coverage period
and exclude incomplete runs rather than presenting it as all-time.

Required checks include restart after a best run, duplicate/out-of-order logs,
reorg rollback, VRF retries, revived players, kills from Attack and Storm,
session renewal, separate EOA/smart-account identities and deployment isolation.
Run indexing independently of game controls so an unavailable leaderboard
cannot interrupt combat.

For a later contract edition, explicit run IDs and start/end events would make
history easier to audit. They are a convenience for a richer leaderboard,
not a reason to deploy a new game contract solely for the first depth board.
