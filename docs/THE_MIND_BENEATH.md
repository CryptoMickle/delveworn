# The Mind Beneath

Product invariant: **Teach the relic who you are. Convince the dungeon you are someone else.**

Living Dungeon owns a new chain-neutral domain under `frontend/app/living-dungeon/mind/`. Other modes, contracts, wallet providers and their save keys are outside this change. The former V0 domain stays available for historical save recognition and regression tests; it does not adjudicate the new game.

## Permanent architecture

The pure, seeded engine is the only authority for legality, turns, health, energy, inventory, movement, visibility, interruptions and outcomes. A versioned journal of accepted commands reproduces every state, event and random result. Facts are immutable records; beliefs never overwrite them. UI previews use a disposable simulation of this same engine. Approval seals an operation sequence; changed circumstances can interrupt it but cannot rewrite it.

The information boundary has six separate projections: facts → observations → local beliefs → reports → received reports → dungeon hypotheses. Geometric line of sight, darkness, distraction and cover determine observation. A report must traverse a physical relay before the dungeon may use it. Private teaching has no path into that projection. Reports carry source event IDs, originator, route, timing, reliability and cost. Uncorroborated evidence and alternating signatures increase uncertainty; repeated costly, credible public performances establish a persona.

Relic principles have scope, confidence, examples, counterexamples and correction history. Saved maneuvers are compositions of typed world operations with semantic role bindings, rather than room-specific scripts. Rebinding changes objects, never the player's boundary. Autonomous choices cite their principle and example. Overrides consume visible energy and trust.

The first chapter has twelve chambers across six directed acts. Scenario grammar continues after the first Echo with anti-repetition, recurring relationships, scars, colliding principles and progressively harder information routes. Difficulty changes observation and interruptions rather than scaling enemy HP. Boss components come from a fixed, budgeted catalogue; every selected component cites delivered evidence.

AI interprets teaching and proposes bounded operation sequences. The server reconstructs the submitted journal, minimizes context, validates strict output, compiles and simulates proposed operations. Responses bind run ID, revision, context digest, request ID and generation token. The client rejects stale results. Free text is transient, is sent only after an explicit submit, and is never sent to analytics or stored in the journal. Existing server environment and distributed rate limits are reused. Provider requests use `store: false`, bounded input/output, deadlines, cache and fallback. No AI response can directly mutate the world.

Saves are local, versioned, replay-validated and protected against cross-tab overwrite. Unsupported or corrupt saves remain untouched. The original V0 save is preserved. This mode works without a network, wallet or chain.

## Quality gates and evidence

1. Truth / visibility / observation / report delivery / private boundary: unit invariants.
2. Teaching / emotional overgeneralization / correction / independent choice: directed engine tests.
3. Lens / exact preview / stepwise combat / interruptions / role-based maneuvers: integration tests.
4. Competing theories / costly performance / noise / adaptive geometry: paired-style replays.
5. Complete chapter / Echo / three mechanical chills: complete expedition replays and browser E2E.
6. Continuing grammar / persistence / migration / controls / mobile: long replay, reload and responsive checks.

Production is gated on typecheck, lint, unit/integration tests, browser expedition, build, deployment checks and a real provider request. Results and unverified physical-device properties are recorded in the delivery report; targets such as 45–60 minute pacing are not treated as measured facts without a timed playtest.

## Future boundaries

Pactcraft can add certified operation preconditions, not arbitrary executable rules. Semantic debt/memory/authority are additional fact and belief predicates. Recurring agents consume their own observation projections. Shared Echoes export only certified component recipes and redacted provenance. Counterfactuals branch a replay without committing it. Machine-verified rules must pass the same budget, operation validator and reproducibility suites.

## Teaching the player the loop

The board has a persistent “Next step” guide derived from the current saved state. The first rescue introduces one action at a time: a private rule, a preview, execution, preserving a maneuver and reaching the stairs. Later guidance handles reuse, correction, an interrupted or paused plan, escorts, retreat after a failed rescue and finishing an Echo. It never commits a world action until the player presses its button.

The preview control says “Execute the plan”; the map labels the player and explains sight fields, planned movement and report paths. Custom written intentions are behind an optional disclosure. “How to play” explains controls and the two kinds of learning, pauses automatic execution and preserves native keyboard navigation while focused. Teaching and subsequent guide transitions scroll back to the board. Guidance does not change the mechanical rules. The English release migrates earlier journals as described below.


## English rules and legacy replay

The active game is English throughout: interface, controls, accessibility text, authored chapter, principles, hypotheses, causal reconstruction, errors and fallback. AI instructions require a short English response even to another input language. Norwegian and English equivalent intentions continue to receive the same operation treatment. User-chosen maneuver names are preserved verbatim.

Save v3 / `mind-beneath-2` uses the existing browser storage slot. Authored prose participates in the original context digest, so translating state without a migration would invalidate old committed plans. `legacy-v2/` freezes the six original simulation modules. Each v2 command is first validated against its original revision and digest, then replayed under the English rules; only verified plans receive a new binding. No stale-plan check is bypassed. The next successful saved action writes the upgraded journal; loading alone leaves the old data intact. Tests compare an entire old expedition through the Echo against an exact English replay, and also cover in-flight plans, custom names, corrections, invalid bindings and concurrent writes.

## Painted presentation

`art.tsx` reuses the existing Delveworn adventurer, enemy cutouts, eight room paintings, logo and item art. A 281 KB atlas supplies Living Dungeon-specific characters and objects. The fixed board projection applies equally to artwork, floor input, plans, walls and sightlines. Decorative image bounds never determine a target's clickable area. World-state events drive brief flashes; there is no continuous particle or idle animation loop. See `frontend/public/living-dungeon/README.md` for source paths, generation prompts and rendering details.
