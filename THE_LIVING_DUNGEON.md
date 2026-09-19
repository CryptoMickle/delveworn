# The Living Dungeon

The proposed next evolution is documented in
[The Living Dungeon V2 — Oaths & Echoes](THE_LIVING_DUNGEON_V2_PLAN.md).

The Living Dungeon is an experimental, wallet-free Delveworn story run at
`/living-dungeon`. It tests one idea: the player can shape a rule in natural
language, while the game remains the sole authority over legal mechanics and
outcomes.

The current expedition has six scenes:

1. a warm-up fight;
2. the Pact Room;
3. a pressure fight;
4. a witness encounter;
5. a camp temptation;
6. a boss that prepares from the witness's bounded belief.

The run uses the existing top-down room, movement, combat controls, action
animation and audio. It has its own validated browser save and does not touch
Practice, Weekly Challenge or Onchain state.

## Pact V0

Every pact has one restriction, one boon and one disclosed breach consequence.
The initial restrictions are:

- do not use Storm;
- do not choose voluntary healing;
- buy nothing at camp.

The initial boons are:

- halve the boss's first retaliation;
- add 15% damage to the first two damaging boss actions;
- restore 20 HP on entry to the boss room.

A forbidden action is still available. Selecting it opens a confirmation that
states the exact consequence: the action happens, the boon is forfeited and the
boss gains 20 current and maximum HP. There is no hidden punishment, and the
boss debt still applies if the player already received the boon.

The witness records one observed action. If spared, it forms one sourced,
bounded belief. That belief may be wrong, but it can change the boss's
preparation. The boss room shows a clue before combat, and the action previews
reflect the resulting rules.

## AI boundary and fallback

Natural-language pact interpretation is optional and server-only. The model may
return only these semantic slots:

- desired boon;
- offered sacrifice;
- fixed duration;
- breach tolerance;
- whether one clarification is needed.

It cannot supply numbers, rules, rewards, inventory changes, game actions or
wallet calls. The deterministic Pact V0 catalogue constructs the actual offer,
binds it to the current run revision and shows the complete rule card before
acceptance.

The route uses strict structured output, sends no tools, stores no model
response and has a four-second deadline. Proposal length, request size, origin,
enum values and response shape are validated. Two persisted interpretation
attempts are allowed per Pact Room. Per-address and global server limits protect
provider cost.

If AI is disabled, unconfigured, slow, malformed, unavailable or rate-limited,
the run immediately exposes the complete authored menu. The expedition never
depends on a model response.

Local development defaults to the authored menu. To enable interpretation, set
server-only values in `frontend/.env.local`:

```text
LIVING_DUNGEON_AI_ENABLED=true
LIVING_DUNGEON_AI_MODEL=gpt-5.6-terra
LIVING_DUNGEON_AI_TIMEOUT_MS=4000
LIVING_DUNGEON_AI_RATE_SECRET=<at least 32 private characters>
OPENAI_API_KEY=<server-only key>
```

Production also requires the existing Upstash-compatible Redis variables
`KV_REST_API_URL` and `KV_REST_API_TOKEN` (or their `UPSTASH_REDIS_REST_*`
aliases). Missing production rate-limit storage fails closed to the authored
menu and makes no provider call.

## Authority and scope

Facts, rules, beliefs and story presentation are stored separately:

| State | Authority |
| --- | --- |
| Facts | Append-only deterministic game events |
| Rules | Versioned Pact and combat engine |
| Beliefs | Derived from explicit source facts |
| Story | Presentation of approved facts and beliefs |

This prototype has no wallet, RPC, VRF, contract call, token, leaderboard or
competitive claim. Blockchain integration remains a later choice after the
mechanic proves fun. The current save is local and intentionally separate from
other Delveworn modes.

## Validation

From `frontend/`:

```bash
node --import tsx --test tests/living-dungeon.test.ts tests/living-dungeon-ai.test.ts
npm test
npm run lint
npm run build
npx playwright test tests/e2e/living-dungeon.spec.ts
```

The browser checks cover entry from the mode selector, arrow/Enter actions,
menu fallback, a full six-scene run, pre-breach confirmation and the compact
boss clue on phone layouts.
