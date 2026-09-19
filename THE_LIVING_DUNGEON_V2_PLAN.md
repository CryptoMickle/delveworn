# The Living Dungeon V2 — Oaths & Echoes

## Product decision

The next version should evolve The Living Dungeon from a pact prototype into a
short role-playing expedition where the player can describe a plan, verify what
the game understood, and then live with the consequences.

The central promise is:

> **Tell the dungeon what you are trying to do. See exactly what it understood.
> Approve the plan. Live with the consequences.**

This is an aggressive expansion of the current idea, but it is still a focused
Delveworn mode rather than a full Dungeons & Dragons simulation. It keeps the
top-down rooms, visible avatar, turn-based combat, relics and short runs. AI
adds a new way to express intent and creates continuity between choices. It
does not invent combat math or silently change the rules.

The working title for this direction is **The Living Dungeon — Oaths & Echoes**.

## Why V0 is harder to understand than it should be

The current implementation proves that a natural-language pact can be mapped
to safe, deterministic rules. The technical foundation is good. The player
experience still feels like a configuration form:

- the player chooses between an AI form and a manual form before understanding
  why either exists;
- the prompt field, status text and separate rule card compete for attention;
- the dungeon does not visibly answer in the conversational pattern a ChatGPT
  user expects;
- the AI is used only once, so the rest of the run does not feel very living;
- internal concepts such as interpretation, canonical events and bounded
  beliefs leak into the product language;
- the difference between character dialogue and a binding game rule is not
  immediately obvious;
- on mobile, the answer can appear below the visible area while small text and
  large overlays compete with the room artwork.

V2 should therefore improve understanding before adding breadth. The first
major release is a redesign of the conversation and confirmation loop. Every
later AI mechanic must use the same loop.

## The interaction language

Every important AI-assisted situation follows one pattern:

1. **Understand the room** — the goal, visible actors and usable objects are
   clear before the player writes anything.
2. **Describe a plan** — the player writes naturally or chooses a suggested
   starting phrase.
3. **Check the understanding** — the game says what it understood in plain
   language.
4. **Review the exact rule** — cost, effect, duration and consequence appear in
   a deterministic card.
5. **Approve or change it** — nothing happens until the player approves.
6. **See the consequence** — the grid performs the action and later characters
   react to what actually happened.

The compact product shorthand is:

> **PLAN → ACTION → CONSEQUENCE**

This should feel familiar to a ChatGPT user: write, receive an answer, correct
it if necessary, then act. It should not become a general chatbot. The
conversation belongs to a visible character or a specific room, has a clear
purpose and ends in a game action.

## The new conversation surface

### Start with a conversation, not a mode selector

Remove the initial `Describe a bargain` / `Choose clear terms` decision. When
the player approaches the Pact Keeper, the Keeper starts the conversation:

> **Pact Keeper**
>
> I can change one rule until the boss falls. Tell me what power you want — and
> what you will give up for it.

Under it:

> Write naturally, as you would in ChatGPT. I will turn your request into an
> exact game rule. Nothing changes until you accept it. English and Norwegian
> both work.

The manual builder remains available as a quiet secondary action:
`See every possible pact`.

### Use three unmistakable roles

The transcript has three visual roles:

| Role | Purpose | Presentation |
| --- | --- | --- |
| **You** | The player's own words | Right-aligned message |
| **Pact Keeper / Relic / NPC** | Interpretation, questions and personality | Left-aligned message with portrait |
| **Exact game rule** | The only binding result | Centred gold rule card marked **EXACT AND BINDING** |

Network and service errors appear as neutral system messages. They never speak
in a character's voice.

The permanent trust sentence is:

> **The character interprets your words. The game rule decides what happens.**

### Use a familiar composer

- Heading: `What do you want to try?`
- Pact placeholder: `Describe the power you want and what you would give up…`
- Desktop: `Enter` sends and `Shift+Enter` adds a new line.
- Mobile input text is at least 16 px and controls are at least 44 px.
- A character counter appears only near the limit.
- Suggested phrases fill the composer and remain editable; they do not send
  automatically.

Initial pact suggestions:

- `Protect me from the boss's first hit; I won't use Storm.`
- `Make my opening attacks stronger; I won't heal myself.`
- `Heal me before the boss; I won't buy anything at camp.`

An honest capability line appears below the suggestions:

> You can bargain for boss protection, stronger opening attacks or healing
> before the boss — in exchange for Storm, healing or shopping.

This tells the player where creativity is useful without pretending that
anything can be generated.

### Make clarification feel like conversation

If the player writes `Give me more power`, the Keeper answers:

> I can strengthen your opening attacks. What will you give up until the boss
> falls?

The UI offers short replies while preserving free text. One clarification is
the maximum for this room. If the request is outside the supported rules, the
Keeper states the limit and offers the nearest legal alternatives instead of
showing `unsupported request`.

### End every exchange with an exact card

Example:

> **Pact Keeper**
>
> I understand: you want protection from the boss, and you will leave Storm
> unused.

**PACT OFFER · EXACT GAME RULE**

- **You receive:** 50% less damage from the boss's first retaliation.
- **You promise:** Do not use Storm until the boss is defeated.
- **If you break it:** Storm still happens. You lose the ward, and the boss
  gains 20 current and maximum HP.
- **Ends:** When the boss is defeated.
- **Example:** Using Storm in any remaining fight breaks the pact.

Actions:

- `ACCEPT PACT`
- `CHANGE MY REQUEST`
- `SEE EVERY POSSIBLE PACT`

After acceptance, the conversation closes with a compact acknowledgement and
the rule becomes a persistent HUD element:

> `YOUR PROMISE: No Storm → first boss retaliation −50%`

Any action that would break it is marked **BREAKS YOUR PROMISE** before the
player commits. A deterministic `Explain this` view is always available and
requires no additional AI call.

### Preserve the player's work on failure

The player's message appears immediately. After a short delay the transcript
shows `The Keeper weighs your words…`. A timeout or malformed answer becomes
the next transcript item:

> I could not shape that request right now. Your words are still here.

Actions:

- `TRY AGAIN`, if an attempt remains;
- `BUILD THE PACT MYSELF`;
- `LEAVE WITHOUT A PACT`.

The manual builder opens inline and produces the same exact rule card. The
game never silently changes mode, discards the prompt or blocks the expedition
because the AI service is unavailable.

## Who plays the Dungeon Master role

V2 should capture the useful part of a D&D Dungeon Master without creating a
second, redundant narrator.

- **The living dungeon** is the adversarial world. It selects from approved
  scenes, observes through in-world sources, forms imperfect beliefs and adapts.
- **The relic** is the player's recurring interpreter and companion. It explains
  what the dungeon understood and speaks only at consequential moments.
- **NPCs** know only what they have seen, learned or been told.
- **The deterministic game engine** owns rules, prices, damage, state changes,
  rewards and outcomes.
- **The language model** interprets the player's phrasing and performs short
  character responses within a defined scene.

There should be no permanent `Dungeon Director` chatbot in the interface. The
scene planner can exist under the hood, but the player experiences one coherent
living dungeon and a small cast of identifiable voices.

## The V2 expedition

The target is a 15–25 minute run with eight readable beats. Each scene teaches
or pays off one part of the same system.

### 1. The Threshold — learn the language

The relic asks one simple question and lets the player send an editable example
sentence. The player sees the first `I understood` preview and confirms it.
Nothing dangerous depends on this answer. This is the tutorial for every later
conversation.

The dungeon also reveals one authored **Dungeon Law** that applies to both
sides. One example and an icon explain it.

### 2. The First Test — learn the law

A short fight demonstrates the law in a forgiving situation. Ordinary movement
and combat remain immediate and make no AI requests.

### 3. The Pact Keeper — shape the challenge

The player asks for one benefit and offers one real restriction. The new
conversation surface translates it into an exact rule. The accepted promise
stays visible for the rest of the run.

### 4. The Witness — create an impression

A surviving enemy can carry one observation forward. The player chooses whether
to kill, spare, intimidate or deliberately show it something. The interface
separates:

- **What happened**;
- **What the witness thinks**;
- **Who may hear it**.

This turns imperfect information into a deliberate resource rather than hidden
AI logic.

### 5. The Open Problem — improvise within real mechanics

One room contains a guard, a locked door and three or four visible objects. The
player can choose a common action or describe a combination such as:

> I throw five gold beside the brazier to distract the guard, then inspect the
> lock.

The game previews the exact supported operations before execution:

- spend 5 gold;
- distract the guard for one turn;
- inspect the door.

The value is the ability to combine known verbs, targets and resources. A more
eloquent prompt never earns a stronger result.

### 6. The Temptation — make the promise matter

A situation makes the forbidden action attractive. The relic reacts because it
values promises, then offers one concrete alternative. The player keeps full
control and sees the breach consequence before choosing.

### 7. The Prepared Boss — pay off belief and deception

Before combat, a visible clue explains the boss's preparation:

> The Scrivener saw you rely on Storm and warned the Keeper. The Keeper has
> prepared a storm ward.

If the player planted a false impression, the boss can prepare for the wrong
strategy. Boss adaptation is deterministic and traceable to a source.

### 8. The Echo — make the run legible

The ending uses three short sections:

- **You promised**;
- **You did**;
- **The dungeon reacted**.

It also names one behaviour pattern that could become a voluntary Echo encounter
in a later run. V2 can record this profile before the actual Echo room is built.

## Aggressive development roadmap

The milestones are ordered so that each one produces a complete, testable
experience. Later milestones do not begin just because the earlier code is
finished; their clarity and gameplay gates must also pass.

| Release | Focus | Estimated work | Player-visible result |
| --- | --- | ---: | --- |
| **Foundation 0** | Behaviour-neutral refactor and V2 save format | 2–3 days | No visible change; safe base for expansion |
| **V1.1 — Understandable Dungeon** | Language, onboarding, measurement | 3–5 days | The current run explains itself clearly |
| **V1.2 — The Dungeon Answers** | Conversation shell and Pact V2 | 1–2 weeks | Natural dialogue becomes an exact promise |
| **V2.0 — Plans Become Actions** | One improvisation room | 1–2 weeks | Free text combines supported mechanics |
| **V2.1 — The Dungeon Can Be Fooled** | Visible beliefs and deception | 1–2 weeks | The player can shape a boss's preparation |
| **V2.2 — The Oath Relic** | Recurring relic partner | 1–2 weeks | One relationship develops through actions |
| **V2.3 — New Laws** | Authored expedition-wide rules | 1 week | Runs demand different tactics |
| **V3.0 — Echoes** | Past play becomes optional encounters | 2–3 weeks | The player meets a pattern from an earlier run |
| **Research track** | Fixed-truth mystery | After V2 proves fun | Questions and evidence change the route |

The estimates assume one focused implementation stream plus art and design
support. They are planning ranges, not launch commitments.

### Foundation 0 — make expansion safe

The V0 engine has good authority boundaries, but the 617-line client currently
mixes interface, audio, API lifecycle and storage. The data model and save
validator also assume exactly six scenes. Split these responsibilities before
adding new mechanics:

1. Extract the conversation surface, Pact Room, expedition record and active
   rule HUD into focused components.
2. Move run persistence and AI request lifecycle into separate hooks.
3. Replace the fixed six-scene assumption with a versioned map of stable scene
   IDs and a deterministic `sceneHistory`.
4. Add structured `ConversationReceipt` records containing only approved IDs,
   bound revision and acceptance state. Do not make generated prose part of the
   authoritative save.
5. Introduce a V2 save key and validator. Leave V1 data untouched; migrate only
   fields that can be translated without guessing. Otherwise explain that the
   experimental V2 expedition starts fresh.

**Gate:** all existing unit and browser tests pass before and after the split,
saved V2 runs round-trip identically, and invalid or future saves cannot reach
the engine.

### V1.1 — Understandable Dungeon

1. Replace internal terminology in all player-facing copy.
2. Add the one-sentence mode promise to the homepage and entrance.
3. Add a first-visit explanation that fits on one card.
4. Replace the side-by-side Pact UI with a single chronological flow on phone
   and desktop.
5. Add a compact active-promise HUD and pre-action breach labels.
6. Show the source of every boss adaptation.
7. Add privacy-safe funnel events before changing the mechanics.

**Gate:** four of five first-time, ChatGPT-familiar testers can explain what
they should write, what their pact gives them, what it costs and what breaks it.

### V1.2 — The Dungeon Answers

1. Build the reusable transcript, composer, suggestion chips and message roles.
2. Add `I understood` responses and at most one clarification turn.
3. Render the binding rule only from the validated game object.
4. Support `Accept`, `Change` and the inline authored fallback.
5. Preserve prompts and focus across timeout, retry and mobile keyboard changes.
6. Add deterministic `Explain this` content.
7. Expand Pact V2 to six restrictions, six boons and three durations, using an
   authored compatibility matrix and power budget.

**Gate:** equivalent intentions create equivalent pact objects, and the player
can predict whether an action breaks the promise before acting.

### V2.0 — Plans Become Actions

1. Author one room with three or four visible targets.
2. Define a small action vocabulary: inspect, distract, offer, threaten, reveal,
   conceal, endure and promise.
3. Define eligible targets, costs, preconditions and outcomes as game data.
4. Interpret text into action, target and resource IDs only.
5. Compose at most three operations into one preview.
6. Execute only after explicit confirmation.
7. Keep common one-tap solutions beside free text.

**Gate:** free text enables useful combinations that would be awkward as a
menu, while a simple and elaborate phrasing of the same plan has the same cost
and outcome.

### V2.1 — The Dungeon Can Be Fooled

1. Add two witness types and four possible beliefs.
2. Give every belief a visible source fact and recipient.
3. Let the player deliberately reveal or conceal one supported signal.
4. Add four authored boss preparations tied to those beliefs.
5. Show the evidence before the boss fight and in the ending.
6. Never give an enemy access to inventory, history or intent it did not learn.

**Gate:** at least 75% of testers can explain why the boss prepared as it did,
and can intentionally cause one wrong preparation.

### V2.2 — The Oath Relic

Prototype one relic, provisionally **The Oathshard**, with a clear interest in
promises.

1. Give it three deterministic attitudes: supportive, warning and opposed.
2. Let it speak only before or after pivotal decisions.
3. Make every intervention end in an option, clue or tradeoff.
4. Change the relic through actions rather than message count.
5. Add one visible rune, crack or animation after a kept or broken oath.
6. Keep dialogue brief: normally one line and never more than one exchange at a
   decision point.

**Gate:** testers describe the relic as a character with an interest, and can
name a mechanical choice it changed without feeling interrupted by it.

### V2.3 — New Laws

Ship three hand-balanced Dungeon Laws, one per expedition. They affect both
player and enemy and appear physically at the entrance.

Candidate laws:

- healing grants the opponent a temporary shield;
- repeating the same attack weakens its next use;
- an action avoided in one fight becomes stronger in the next.

The model can explain a selected law but cannot generate or alter one.

**Gate:** the law changes at least one tactical decision in most completed runs
and does not create an incompatible pact or unwinnable boss state.

### V3.0 — Echoes

The deterministic event log classifies a run into a small profile:

- aggressive opener;
- early resource spender;
- Storm specialist;
- defensive survivor;
- oath keeper;
- oath breaker.

A later run may offer one optional room built from a previous profile. The
first version uses only the current player's own structured history. It does
not copy raw conversation text. Public sharing and other players' Echoes wait
until the solo feature is proven understandable and fun.

**Gate:** players recognise the behaviour that created the Echo and want to
change their plan when facing it.

### Research track — a mystery with a fixed truth

Build one authored mystery only after the main loop works:

- one immutable event sequence;
- three witnesses or information sources;
- six approved clues;
- questions interpreted as requests to inspect available knowledge;
- a player theory converted into a precise claim before submission;
- different routes for a correct and an incorrect conclusion.

The model may phrase testimony. It may not change the culprit, invent decisive
evidence or declare a theory correct because it sounds persuasive.

## First content budget

The first complete V2 should stay within this envelope:

- one biome;
- one recurring relic personality;
- one Pact Keeper;
- one boss with four preparations;
- three Dungeon Laws;
- six pact restrictions and six boons in approved combinations;
- one finished improvisation room and one later variant;
- two witness types and four beliefs;
- six Echo profiles;
- no more than four AI requests in one run, including clarification.

This is enough to feel substantially different across runs while remaining
possible to balance, explain and test.

## Technical architecture

### Keep one authority boundary

The pipeline for every AI-assisted action is:

```text
player text
  → structured interpretation
  → deterministic legality and balance checks
  → exact player preview
  → explicit approval
  → deterministic state transition
  → factual event
```

The model never receives a tool that can grant gold, change HP, issue a relic,
move the avatar, alter a rule, submit a wallet action or select an arbitrary
reward.

### Separate four kinds of state

| State | Meaning | Authority |
| --- | --- | --- |
| **Facts** | What actually happened | Append-only engine events |
| **Rules** | What actions and outcomes are legal | Versioned game data and code |
| **Beliefs** | What a specific actor thinks and why | Derived from named facts |
| **Presentation** | How a character says it | Templates or bounded model output |

The player-facing labels are `What happened`, `What they think` and `Why they
think it`. The internal names do not appear in the experience.

### Structured contracts

Pact interpretation returns semantic IDs, not prose rules or numbers:

```text
desired_boon_id
offered_restriction_id
duration_id
needs_clarification
clarification_topic
```

Improvisation returns at most three approved operations:

```text
action_id
target_id
resource_id
amount_band_id
sequence_index
needs_clarification
```

Server validation rejects unknown IDs, impossible combinations, extra fields,
stale run revisions and state digests that no longer match. The client renders
the exact rule from validated catalogue data, never from model prose.

Do not create one general AI Director endpoint. Use small contracts for each
purpose on a shared server gateway:

- `pact/interpret`;
- `improvisation/interpret`;
- `dialogue/perform` only where authored or templated character lines do not
  provide enough value.

The first refactor should divide the current implementation along these lines:

```text
living-dungeon/
  components/conversation-shell.tsx
  components/pact-room.tsx
  components/expedition-record.tsx
  hooks/use-living-dungeon-run.ts
  hooks/use-dungeon-interpretation.ts
  improvisation/catalogue.ts
  improvisation/schema.ts
  improvisation/engine.ts
  knowledge-engine.ts
  knowledge-explanations.ts
  analytics.ts
```

These are responsibility boundaries, not a requirement to create every empty
file on day one.

### Model recommendation

Use the currently proven `gpt-5.6-terra` with **low reasoning** for the first V2
runtime. It already handles the strict Pact schema and reduces migration risk.
After the evaluation set exists, test a faster, lower-cost model for routine
intent mapping and keep Terra only for ambiguous clarification or short
character performance. Do not use the most expensive reasoning tier in the
live game.

For development:

| Work | Recommended model | Reasoning |
| --- | --- | --- |
| Runtime pact/action interpretation | `gpt-5.6-terra` initially | Low |
| Routine classifier after parity testing | Faster low-cost model | Low |
| Offline adversarial and semantic review | `gpt-6-astra` | High |
| Implementation and test generation | `gpt-5.6-terra` | High |

The model choice is an implementation detail behind a versioned interpreter.
Game saves and replay data store approved IDs and rule versions, never a model
name or free-form response as authority.

### Latency and cost budget

- Ordinary movement, combat, buttons and animations never wait for AI.
- AI calls occur only at authored conversation beats.
- Maximum four requests per run, including clarifications.
- Target p95 response time: under 2.5 seconds.
- Hard deadline: four seconds, followed by the inline authored fallback.
- Target fallback rate: under 5% when the service is enabled.
- Initial target provider cost: under USD 0.02 per completed run.
- Cache only safe, normalized interpretations; never cache one player's raw
  conversation for another player.

Short presentation lines can be prefetched at room transitions when the facts
are already fixed. A loading model call must never delay a combat resolution or
the avatar's movement.

### Privacy and retention

- Do not send the full run or unrelated player history to the model.
- Send only the current supported choices and the minimum necessary facts.
- Do not place raw prompt text in analytics, logs, URLs, share links or Echoes.
- Store approved action IDs and concise deterministic summaries.
- Treat all player text as untrusted input.
- Keep the complete authored path playable when AI is unavailable.

### Evaluation suite

Create a versioned offline set before expanding beyond Pact V2:

- English and Norwegian paraphrases;
- short, verbose and misspelled requests;
- ambiguous benefit or sacrifice;
- contradictory requests;
- attempts to negotiate a free benefit;
- prompt-injection and rule-changing language;
- different phrasings with the same intended action;
- unsupported requests that need helpful alternatives;
- stale state and invalid target combinations.

Targets:

- at least 98% structurally valid responses;
- at least 95% semantically correct approved IDs;
- 100% rejection of unknown mechanics and model-supplied numbers;
- equivalent mechanical outcomes for equivalent intentions;
- complete authored fallback for every supported scene.

## Measurement

Instrumentation should exist before V2 changes the mechanics. Do not collect
raw prompt text.

Core events:

- `living_run_started`;
- `conversation_opened`;
- `suggestion_used`;
- `interpretation_returned` with AI/menu/fallback source;
- `clarification_requested`;
- `rule_accepted`, `rule_revised` and `rule_rejected`;
- `promise_kept` and `promise_broken`;
- `improvisation_attempted` and `improvisation_confirmed`;
- `belief_seen` and `belief_source_opened`;
- `boss_clue_seen`;
- `living_run_completed` and `living_run_abandoned`;
- `living_retry_started`.

Product targets:

| Question | Target |
| --- | ---: |
| Can the player explain benefit, promise and breach before accepting? | ≥ 80% |
| Can the player predict whether the next action breaks the pact? | ≥ 85% |
| Can the player explain why the boss adapted? | ≥ 75% |
| Do players use free text at least once when buttons remain available? | ≥ 50% |
| Do fewer than one in ten runs end in the Pact Room? | < 10% abandonment |
| Does waiting consume less than one twentieth of a run? | < 5% of playtime |
| Does the run finish when the AI service is disabled? | ≥ 95% completion parity |
| Do players choose another run to try a different promise, law or Echo? | ≥ 50% |

## Mobile requirements

- Keep the room visible in roughly the upper 32–38% of the viewport while a
  conversation is open.
- Present transcript, exact rule and actions in one vertical column.
- Pin the composer above the safe area and mobile keyboard.
- Horizontally scroll suggestion chips instead of creating a tall text block.
- When a rule arrives, dismiss the keyboard and bring the exact card into view
  without a page jump.
- Collapse Field Notes and other overlays during a conversation.
- Use at least 14 px body text, 16 px input text and 44 px controls.
- After acceptance, return visual priority to the room and avatar.

## Risks and hard rules

| Risk | Rule |
| --- | --- |
| Prompt skill produces better rewards | Same intent always maps to the same authored mechanics |
| The dungeon seems omniscient | Every belief names its source |
| AI makes play slow | Calls occur only in special rooms; ordinary play is local |
| Generated prose looks authoritative | Only the gold exact-rule card can change state |
| Too many systems overload the player | Show one active promise, one relevant belief and one next consequence |
| The relic becomes noisy | One short intervention per pivotal event |
| Laws and pacts create unfair combinations | Run a compatibility matrix and strength budget before the run starts |
| Echoes expose private text | Build Echoes only from approved event IDs |
| Service failure stops a run | Every scene has a complete authored route |

## Explicitly out of scope

- a full D&D ruleset, classes or player races;
- an always-available general chatbot;
- a separate player-facing Dungeon Director;
- freely generated combat rules, enemies, rewards or code;
- long conversations with no mechanical result;
- multiple talking relics before the first one works;
- public player-generated Echoes in the first release;
- leaderboard or blockchain claims for adaptive runs;
- generated mysteries before one fixed mystery works;
- model calls for movement, ordinary combat or visual animation.

The mode remains chain-agnostic. A later verifiable mode may commit an authored
rule-set ID, interpreter version and accepted action IDs, but blockchain support
must not constrain the AI experiment or be presented as proof that a subjective
interpretation was correct.

## The first build to start now

The next implementation should be one vertical slice called
**Conversation Shell**. It changes no pact balance and adds no new room yet.

1. Split the current client without changing behaviour and introduce the V2
   save envelope.
2. Instrument the current Pact Room without storing prompt text.
3. Replace the form and tabs with the chronological transcript.
4. Add the opening Keeper message and full-sentence starter prompts.
5. Add `I understood`, one clarification and the exact binding rule card.
6. Add `Accept`, `Change` and the inline manual fallback.
7. Add the active-promise HUD and pre-action breach marker.
8. Add a source sentence to the boss preparation.
9. Add English/Norwegian semantic evals and desktop/mobile browser coverage.

This first build answers the most important question before more AI is added:

> **Does the player feel that the dungeon understood them, while still knowing
> exactly which game rule will execute?**

If the answer is yes, the same conversation shell becomes the foundation for
improvisation, deliberate deception, the relic relationship and eventually
Echoes. That creates one coherent signature mechanic instead of a collection of
unrelated AI features.
