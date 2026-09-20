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
