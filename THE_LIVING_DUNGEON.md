# The Living Dungeon

The proposed next evolution is documented in
[The Living Dungeon V2 — Oaths & Echoes](THE_LIVING_DUNGEON_V2_PLAN.md). The
long-term product direction is in
[The Living Dungeon — Master Plan](THE_LIVING_DUNGEON_MASTER_PLAN.md).

The Living Dungeon is an experimental, wallet-free Delveworn story run at
`/living-dungeon`. It now tests two connected ideas: a player can state the
victory they want and describe how they intend to achieve it, then later shape
a pact in natural language. In both cases the game remains the sole authority
over legal mechanics and outcomes.

The first implementation is intentionally a vertical slice. One opening room,
the Witness Gate, supports a finite authored catalogue. It does not generate
arbitrary rooms, physics, objects or rewards.

The current expedition has six scenes:

1. the Witness Gate, with an Intent-to-World maneuver or a normal warm-up fight;
2. the Pact Room;
3. a pressure fight;
4. a witness encounter;
5. a camp temptation;
6. a boss that prepares from the witness's bounded belief.

The run uses the existing top-down room, movement, combat controls, action
animation and audio. It has its own validated browser save and does not touch
Practice, Weekly Challenge or Onchain state.

## Intent-to-World V1: the Witness Gate

The opening room asks the player to define victory before choosing an action:

- **Rescue:** free the chained cartographer;
- **Acquire:** claim the warden's sigil;
- **Discover:** reveal the gate's true memory.

That choice selects a distinct premise and a set of visible, usable entities.
The player then describes a maneuver using what is actually present. Four
method families—Cunning, Mercy, Force and Risk—produce twelve authored
combinations across the three premises. A player may also state a boundary:
no killing, no Storm, no gold, no lying, or no additional restriction.

The execution chain is:

```text
desired victory
  -> bounded world shape
  -> authored premise and visible objects
  -> described maneuver
  -> bounded semantic IDs
  -> deterministic compiler
  -> exact preview
  -> player commitment
  -> deterministic resolution and observed belief
```

The exact preview names every step, resource cost, success chance, possible
setback, watcher and belief signal. The compiled plan is bound to the current
run revision and a digest of every state value that can affect legality or
resolution. A stale or modified plan is rejected before execution.

The masked warden observes the method that was visible in the room. It does not
learn the player's private wording or hidden intention. Resolution can add one
of four bounded signals: favoring misdirection, paying to protect others,
breaking obstacles or gambling with Storm. These are explicit game facts for
later adaptation rather than model-written memories.

That knowledge does not teleport to the boss. When the later Dungeon
Scrivener is reached, the engine records an explicit relay from the masked
warden. Only a surviving Scrivener can carry the sourced impression onward and
change the boss's preparation.

Success resolves the opening nonlethally and moves the expedition forward. A
setback pays the disclosed cost, raises the warden's alarm and enters the
ordinary warm-up combat. The player can choose normal combat without using the
interpreter at all. AI failure therefore changes neither availability nor the
authoritative rules.

### What the model may select

For the Witness Gate, model output is restricted to IDs for:

- premise and objective;
- method;
- target and supporting object;
- player boundary;
- whether clarification is required.

It cannot author steps, costs, probability, damage, observers, beliefs,
rewards, entities or state changes. Those values come from the versioned
catalogue and deterministic compiler. An authored fallback returns the same
bounded shape when model interpretation is disabled or unavailable.

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

Natural-language interpretation is optional and server-only. The Witness Gate
uses the bounded flow above. In the later Pact Room, the model may return only
these semantic slots:

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
the run immediately exposes authored alternatives and normal combat. The
expedition never depends on a model response.

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

## Measurement and privacy

The first slice measures only closed mechanical categories:

- `world_shaped`: objective, method, boundary and source;
- `maneuver_compiled`: premise ID, method ID, source and compiler result;
- `maneuver_committed`: authored maneuver ID;
- `maneuver_resolved`: authored maneuver ID, success or setback, and belief signal ID.

The analytics contract has no fields for the player's statement, maneuver
description, generated prose, run ID, save, wallet or network identity. Runtime
allowlists rebuild each payload and remove unknown properties before sending.
The two composers disclose that their free text is sent to OpenAI for the
requested interpretation. That prose is not written into the expedition save
or analytics, and provider requests set `store: false`.

## Validation

From `frontend/`:

```bash
node --import tsx --test tests/living-dungeon-improvisation.test.ts tests/living-dungeon-improvisation-ai.test.ts tests/living-dungeon-analytics.test.ts
node --import tsx --test tests/living-dungeon.test.ts tests/living-dungeon-ai.test.ts
npm test
npm run lint
npm run build
npx playwright test tests/e2e/living-dungeon.spec.ts
```

The browser checks cover entry from the mode selector, arrow/Enter actions,
menu fallback, a full six-scene run, pre-breach confirmation and the compact
boss clue on phone layouts.
