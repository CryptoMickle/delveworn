# Weekly Verified Challenge — current V2 grid and frozen V1 archive

Weekly Challenge: The First Descent is Delveworn's wallet-free primary entry.
Every player opens the same challenge ID and controlled seed. A shared result
is accepted only after the action trace is replayed and the final state and
score are recalculated.

This is a deterministic local replay proof. It is not an onchain attestation,
a signed server receipt or an anti-bot leaderboard.

There is one current Weekly entry: the home page, `/play` and `/challenge` all
route to Weekly V2 at `/challenge/<challenge-id>?v=2`. V2 uses the shared
First Descent grid, physical loot interaction, boss relic decision and result
card. Existing unversioned `/challenge/<challenge-id>` links remain on the
original V1 UI and verifier. The archived V1 behavior and published proofs are
not rewritten to match V2.

## Challenge schedule, IDs and routes

- One challenge runs from Monday 00:00 UTC until the next Monday 00:00 UTC.
- IDs use ISO week notation, for example `2026-W38`.
- `/challenge` resolves the current UTC week and redirects to its V2 route.
- `/challenge/<challenge-id>` keeps current and historical challenge links
  stable as frozen V1 compatibility links.
- `/challenge/<challenge-id>?v=2` is the current shared-grid challenge.
- Rules versions are part of the seed and proof formats. A rules change must
  add a version instead of changing an old result retroactively.

No weekly content file or deployment is required. `getChallengeDefinition()`
validates the ISO week, calculates its UTC window and derives its seed from the
fixed namespace `delveworn:weekly:<rules-version>:<challenge-id>`.

## Current V2 grid flow

V2 reuses the First Descent state machine and shared dungeon room while keeping
Weekly authority over the seed, legal action log, score and verifier. Walking,
artwork, Kevin's movement and monster speech consume no Weekly combat randomness
and add no score-bearing action.

Loot is held after a kill. Reaching it collects the exact rolled resources;
reaching the door first forfeits them. Room 10 finishes only after floor loot is
resolved and the earned boss relic is kept or equipped. The result can then
continue to Room 11 in local Practice. That handoff preserves the completed
Weekly result, identifies the source run, generates Room 11 once through the
normal Practice engine and resumes later Practice progress on repeated imports.
It is local Practice from that point, not a continued verified Weekly score.

V2 scoring uses the replayed terminal state:

```text
rooms cleared × 10,000
+ 5,000 when Room 10 is fully resolved
+ remaining HP × 20
+ remaining gold × 5
+ remaining potions × 100
+ (weapon level + armor level) × 250
- combat turns × 10
```

Movement and other presentation actions do not count as combat turns. V2 saves
only the run ID and compact action trace; reload reconstructs the run before it
is shown or accepted. Shared V2 links include `v=2`, a replay proof and an
optional validated referral.

## Frozen V1 run rules and score

The challenge is a 10-room sprint using Practice Mode combat, loot, supply
stops and the camp before the boss. The run completes when the player dies or
clears Room 10. It requires no wallet, RPC, VRF, payment, token or NFT.

V1 retains its original presentation and immediate engine-credited loot. It
does not inherit V2's physical loot, bypass or boss relic decision. This keeps
old action traces and results stable.

Score V1 is calculated only from the replayed state:

```text
rooms cleared × 10,000
+ 5,000 when Room 10 is cleared
+ remaining HP × 20
+ remaining gold × 5
+ remaining potions × 100
+ (weapon level + armor level) × 250
- valid actions × 10
```

The result includes challenge ID, rules version, seed, cleared/defeated
outcome, rooms cleared, remaining HP/gold/potions, weapon and armor levels,
equipped relic, action count and score. The V1 sprint stops on the first boss
kill, before its relic is used, but the relic field keeps the result schema
ready for later rule versions.

## V1 deterministic randomness

Normal Practice Mode still uses Web Crypto. The shared Practice engine now
accepts a randomness function; Weekly Challenge supplies a stateful xorshift32
generator instead. Its seed and every state transition use explicit 32-bit
integer operations so the same action sequence is portable across JavaScript
runtimes.

Random log-copy choices consume the same seeded sequence as encounters,
damage, critical hits, loot and relic rolls. Replaying the complete legal
action trace therefore reconstructs the complete challenge state.

### V1 archive lock

V1 replay imports its own frozen combat and random modules from
`frontend/app/challenge/v1/`. Those modules do not import Practice rules, so a
future Practice update cannot change an archived V1 score or proof. The
published week-38 proof and several full multi-seed state/RNG traces are golden
test vectors. They are release contracts: change weekly rules by adding a new
version, never by updating the V1 vectors.

## V1 proof and verification

The `r` query parameter is base64url-encoded JSON containing only:

1. rules version;
2. challenge ID;
3. compact action codes;
4. SHA-256 digest of the canonical version/ID/action tuple.

The verifier rejects payloads that are empty, larger than 2,048 characters,
use an unknown schema or action, exceed 320 actions, belong to another
challenge, fail the integrity digest, contain an illegal state transition or
do not end in a completed run. It then derives the seed, replays every action
and calculates the displayed result. No claimed score or final state is read
from the URL.

SHA-256 detects accidental edits and simple result-field manipulation. Because
the verifier and game are public client code, a determined user can create a
new valid action trace or search the known seed. Server signatures or onchain
attestation are required before adding prizes or an authoritative leaderboard.

## V1 sharing and referrals

A completed run produces:

```text
/challenge/2026-W38?r=<proof>&ref=<12-character-run-id>
```

The run ID is the first 12 hexadecimal characters of the proof digest. The
shared page verifies and displays the sender's result before offering **Play
this challenge**. That action removes the sender's result payload and preserves
the validated `ref` value for referral-completion measurement.

The browser share sheet is used when available; clipboard copy is the fallback.
If both fail, the canonical result URL remains visible for manual copying.

## Analytics and privacy

The existing Vercel Web Analytics dependency records bounded custom events.
V1 keeps its original event contract; V2 also distinguishes the home entry,
resume, retry and the first successful transition into Practice:

- `challenge_started` once per browser and challenge ID;
- `challenge_completed` once per completed replay proof in this browser;
- `challenge_shared` after a successful share/copy;
- `challenge_referral_visit` after a matching shared result is verified;
- `challenge_referral_completed` when that recipient completes a run;
- `challenge_return_visit` when a browser starts a later challenge ID;
- `challenge_abandoned` when a started, incomplete run leaves the page;
- `challenge_error` with a bounded error code;
- `challenge_home_started`, `challenge_resumed` and `challenge_retry` for V2;
- `challenge_practice_continued` only after a new V2-to-Practice import succeeds,
  not when it is canceled or merely resumed.

Event properties contain the challenge ID, rules version and small aggregate
values such as outcome, room and action count. They do not contain wallet
addresses, proof payloads, run IDs, names, email addresses, free text or a
project-defined user identifier. Local storage keeps the versioned compact
action trace, challenge ID and optional referral, plus replay proofs for the
friend target and personal best. Local Practice records remain separate and
are labeled self-reported.

## Create, play and verify

1. To create a new current challenge, deploy no weekly data: opening
   `/challenge` after Monday 00:00 UTC resolves the new ISO week and V2 seed.
2. To play the current grid challenge, open `/challenge/<challenge-id>?v=2`.
   Reloading reconstructs a saved run from its compact action trace.
3. Existing unversioned links continue to open V1. Their shared proofs are
   verified only by the frozen V1 code.
4. A verified state appears only after digest validation, legal-action replay
   and score recalculation succeed. V1 uses `verifyChallengeProof`; V2 uses
   `verifyWeeklyDescentProof`.

## Leaderboard and trust boundary

V2 includes an optional informal leaderboard. It is active in local development
with the local file store, and server replay calculates every accepted score.
Production remains deliberately unavailable until a durable Redis-compatible
database and a private `DELVEWORN_LEADERBOARD_COOKIE_SECRET` are configured.
The Weekly run, replay result and sharing continue to work when the leaderboard
is unavailable. No production database configuration or deployment is claimed
here; see `WEEKLY_LEADERBOARD.md`.

V1 does not submit to this leaderboard. Both versions remain informal
competitions: a replay proves rule-consistent actions and score, not a unique
human player.

## Explicitly outside this delivery

- server signatures, trusted timestamps or authoritative identity;
- wallet connection before or during the challenge;
- onchain writes, `setConsumer`, VRF configuration or contract deployment;
- Farcaster, Telegram, Discord, SDK, grant or partner-season integrations;
- paid entry, tokens, NFTs or sponsored rewards;
- physical Safari verification and the planned external 5–10-player test.

On a Somnia deployment, the result screen links to Somnia Onchain Mode only as
an optional next experience after the wallet-free challenge is complete. The
link is hidden from an explicitly configured RISE build. The challenge proof
never includes chain state, and the Practice handoff performs no transaction.

## Current verification state

The local automated baseline is 248 passing tests, a passing production build
with webpack (including TypeScript), and lint with 0 errors and 14 existing
warnings. Internal QA in the approved in-app browser completed two full V2
runs, a shared target with reload and result comparison, local leaderboard
submission, and Room 11 Practice continuation. Mobile layouts at 375×812 and
320×568 and desktop were inspected. See `LEVERANSE_FASE_1_2026-09-17.md`.
Physical Safari, standalone Playwright execution and external player testing
remain outstanding. Production deployment is not part of this delivery.
