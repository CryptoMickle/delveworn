# Weekly Challenge leaderboard

Weekly Challenge: The First Descent has an optional, informal leaderboard for
rules version 2. The run remains fully playable when the leaderboard is down or
not configured. Scores have no prizes and are not proof of a unique human.

## Production readiness

The leaderboard is deliberately disabled in production until all of these
private server settings exist:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN` for an Upstash-compatible Redis
  REST store; `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are also
  accepted;
- `DELVEWORN_LEADERBOARD_COOKIE_SECRET`, containing at least 32 random
  characters.

`DELVEWORN_LEADERBOARD_ENABLED=false` is an explicit kill switch. It disables
all leaderboard reads and submissions even when storage and the cookie secret
are configured. Leaving it unset preserves the normal readiness checks above.

`GET /api/leaderboard/status` reports `503` and an unavailable reason while
configuration is incomplete. It never falls back to process memory in
production. Local development uses an atomically replaced JSON file in the
operating system temporary directory, or `DELVEWORN_LEADERBOARD_LOCAL_FILE`
when explicitly set.

## HTTP API

`GET /api/leaderboard/<challenge-id>` returns current or archived standings.
The response contains the top ten, plus the current guest's row and two nearby
rows on either side. Duplicate rows are removed. Future challenge IDs are not
readable.

`/challenge/<challenge-id>/leaderboard` is the public rules-v2 standings page.
It links back to the current weekly run and between current and archived weeks.

`POST /api/leaderboard/<current-challenge-id>` accepts JSON with a v2 `proof`
and optional `nickname`. Writes require a matching `Origin` header, a current
UTC challenge according to the server clock, and a proof that passes server
replay. Historical boards are read-only. Request bodies, proofs, rates and the
number of entries per board have explicit bounds; the rate window resets, so
there is no lifetime attempt limit.

Each browser receives an HMAC-signed, `HttpOnly`, `SameSite=Strict` guest
cookie from a read request. A write cannot mint and immediately use a new
credential; the client must retry with the server-issued cookie. The signature
prevents a client from choosing another guest identity.
Only the best score for that guest, challenge and rules version is retained.
Equal or lower scores keep the first row and its nickname. Updates use one
atomic Redis script or a locked local file transaction.

Nicknames are optional, normalized and restricted to 2–20 letters, numbers,
spaces, underscores or hyphens. Moderated names are discarded before storage
and displayed as hidden. Raw rejected names are never persisted.

## Ranking

Rows sort by score descending, then by the time that best was achieved. Equal
scores use competition ranks: `1, 2, 2, 4`. A public entry ID breaks the final
tie deterministically. The server never trusts a submitted score or result
field; it stores only values produced by replaying the v2 proof.

## Version retention

The v2 definition, action alphabet, seed, replay result, score and proof for
the published week 38 fixture are pinned in unit tests. Changes to the shared
First Descent or Practice rules must introduce a new weekly rules version;
the v2 vectors must not be updated to make a changed engine pass. This release
gate keeps archived v2 proofs verifiable and makes accidental dependency drift
fail CI before deployment.

V1 is stronger than a release gate: its verifier imports a frozen rules module
under `app/challenge/v1/`. New Practice behavior must never be added to that
module; a new weekly rules version is required instead.
