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

## Database verification (17 September 2026)

The Lua used by `RedisRestLeaderboardStore` is now exercised against a real,
isolated Redis server by `npm run test:redis`. The test server has no TCP port,
uses a temporary Unix socket, and is stopped/removed after the tests. Its CLI
transport wraps actual Redis responses in the REST JSON envelope; this tests
Redis execution, not a live Upstash service or its authentication.

The suite found and fixed two integration bugs:

- Lua encodes an empty table as an object. Empty boards now explicitly return
  `rows: []`, so a new week can load before its first submission.
- Entries with identical scores and timestamps now have the same stable order
  in local and Redis storage. They still share the same competition rank.

It also covers concurrent best-score retries, retention of an equal result,
capacity, top-ten/own-neighbor windows, and expired rate limits. The Frontend CI
runs it as a separate Redis integration job. Locally, install standard Redis
binaries or set `REDIS_SERVER_BIN` and `REDIS_CLI_BIN` to existing binaries.

New server submissions retain the verified action proof privately for future
replay audits. Public responses omit both that proof and the secret guest ID.
Previous development-only records may lack a proof. Public result sharing is
still voluntary and separate from leaderboard submission.

## Preview activation

Initial read-only Vercel checks found no storage resources and no Marketplace
installations in the `crypto-mickle` scope. The user subsequently authorized
the recommended database setup through Vercel. A random private cookie-signing
secret is now installed in Preview only. Production settings are unchanged.

Selected resource: **Upstash Redis, Free plan, `delveworn-weekly-preview`**, scoped
to `delveworn-app` Preview only, in IAD1 near the current server functions.
The provider currently lists a $0 plan with 256 MB and 500,000
commands/month; paid tiers must not be selected automatically.
[Provider pricing](https://upstash.com/pricing/redis).

The creation request explicitly set `autoUpgrade=false`, `prodPack=false`, and
`eviction=false`. The user explicitly approved the Marketplace terms and
Vercel confirmed acceptance. Resource `store_g9zwhkHsqaGyrwEK` is now available,
with plan `free` and only `delveworn-app (preview)` connected. Vercel's resource
page also confirms IAD1 and eviction disabled. REST credentials were installed
by the integration as server environment variables; none are public variables.

Hosted verification passed on deployment `dpl_BUPBBDSNbr9Yw7FWwUREWA8buLqN`
(code `b9820dd`): empty/current/archive reads, a verified first submission,
retention on retry, replacement by a better result, durable re-read, private
proof/guest-ID omission, rejected archive writes, invalid proofs and wrong
origins. The labelled `Preview QA` row improved from 50,840 to 107,190 and is
visible in the preview browser. It is an automated internal test result, not an
external player or a user-test outcome.

Production remains a separate activation. Do not put credentials in public
variables, Git, reports, logs or chat.
