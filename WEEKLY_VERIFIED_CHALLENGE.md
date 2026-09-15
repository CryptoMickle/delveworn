# Weekly Verified Challenge V1

Weekly Verified Challenge is Delveworn's wallet-free growth loop. Every player
opens the same challenge ID, receives the same controlled seed and plays the
existing local combat rules. A shared result is accepted only after the
frontend replays its action trace and recalculates the final state and score.

This is a deterministic local replay proof. It is not an onchain attestation,
a signed server receipt or an anti-bot leaderboard.

## Challenge schedule and IDs

- One challenge runs from Monday 00:00 UTC until the next Monday 00:00 UTC.
- IDs use ISO week notation, for example `2026-W38`.
- `/challenge` resolves the current UTC week on each request.
- `/challenge/<challenge-id>` keeps current and historical challenge links
  stable.
- Rules version `1` is part of the seed and proof format. A rules change must
  increment the version instead of changing an old result retroactively.

No weekly content file or deployment is required. `getChallengeDefinition()`
validates the ISO week, calculates its UTC window and derives its seed from the
fixed namespace `delveworn:weekly:<rules-version>:<challenge-id>`.

## Run rules and score

The challenge is a 10-room sprint using Practice Mode combat, loot, supply
stops and the camp before the boss. The run completes when the player dies or
clears Room 10. It requires no wallet, RPC, VRF, payment, token or NFT.

Combat and the spaces between rooms use the same shared Delveworn presentation
components as Practice and Onchain Mode. Challenge state and actions remain
separate, so visual parity does not weaken deterministic replay verification.

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

## Deterministic randomness

Normal Practice Mode still uses Web Crypto. The shared Practice engine now
accepts a randomness function; Weekly Challenge supplies a stateful xorshift32
generator instead. Its seed and every state transition use explicit 32-bit
integer operations so the same action sequence is portable across JavaScript
runtimes.

Random log-copy choices consume the same seeded sequence as encounters,
damage, critical hits, loot and relic rolls. Replaying the complete legal
action trace therefore reconstructs the complete challenge state.

## Proof and verification

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

## Sharing and referrals

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

The existing Vercel Web Analytics dependency records these custom events:

- `challenge_started` once per browser and challenge ID;
- `challenge_completed` once per completed replay proof in this browser;
- `challenge_shared` after a successful share/copy;
- `challenge_referral_visit` after a matching shared result is verified;
- `challenge_referral_completed` when that recipient completes a run;
- `challenge_return_visit` when a browser starts a later challenge ID;
- `challenge_abandoned` when a started, incomplete run leaves the page;
- `challenge_error` with a bounded error code.

Event properties contain the challenge ID, rules version and small aggregate
values such as outcome, room and action count. They do not contain wallet
addresses, proof payloads, run IDs, names, email addresses, free text or a
project-defined user identifier. Local storage keeps the compact action trace,
challenge ID, rules version and an optional 12-character referral, plus
one-bit markers used to deduplicate challenge starts and completed proofs.

## Create, play and verify

1. To create a new weekly challenge, deploy no new data: opening `/challenge`
   after Monday 00:00 UTC resolves the new ISO week and seed automatically.
2. To play a specific challenge, open `/challenge/<challenge-id>` and start the
   run. Reloading reconstructs a saved run from its action trace.
3. To verify a result, open its shared URL. A green **Verified by deterministic
   replay** state appears only after digest validation, legal-action replay and
   score recalculation succeed.
4. For automated verification, call `verifyChallengeProof(challengeId, proof)`
   from `frontend/app/challenge/core.ts` and handle `ChallengeProofError.code`.

## Explicitly outside V1

- global leaderboard, accounts, prizes or rate-limited score submission;
- server signatures, trusted timestamps or authoritative identity;
- wallet connection before or during the challenge;
- onchain writes, `setConsumer`, VRF configuration or contract deployment;
- Farcaster, Telegram, Discord, SDK, grant or partner-season integrations;
- paid entry, tokens, NFTs or sponsored rewards.

On a Somnia deployment, the result screen links to Somnia Onchain Mode only as
an optional next experience after the wallet-free challenge is complete. The
link is hidden from an explicitly configured RISE build. The challenge proof
never includes chain state, and the handoff performs no automatic transaction.
