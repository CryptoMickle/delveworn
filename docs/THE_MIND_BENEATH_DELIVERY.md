# The Mind Beneath — delivery evidence

## Implementation

The replacement lives at `/living-dungeon`; Practice, Weekly Challenge and Onchain retain their engines, components and save keys. The home card changes only this mode's description. The previous Living Dungeon source remains for regression coverage, but the route uses the new engine and interface.

The game contains a deterministic grid, sealed multi-turn plans, physical enemy reactions and interrupted plans; line-of-sight, darkness and distraction; individual observations and beliefs; moving reports and interceptable relays; competing, decaying dungeon hypotheses; six teachable principles with applicability, priorities, examples and corrections; compositions saved as personal maneuvers; moral choices and paid overrides; relationships with spendable favors; scars; twelve directed first-chapter chambers; eight room families; five budgeted boss components; and continuing rescue, escort, evidence and report-control scenarios with later Echoes.

The interface exposes the same actions through visible suggestions, object connections, editable steps, a short intention field, mouse, touch and keyboard. Ghost paths and numbered actions show the preview in the room. The board keeps a fixed aspect ratio. The private-learning and suspected-theory summaries stay brief; provenance is behind “Why?”. Event-driven sound distinguishes the dungeon learning from the relic understanding. Reduced motion disables transitions, and hidden tabs pause automatic execution.

## Causal chains verified in the engine

1. **A credible public lie.** Repeated Storm attacks spend energy in several rooms with a credible observer. The observer carries actual observations to a relay. Delivered reports increase the Storm hypothesis; unrelated hidden teaching cannot enter it. A later arena contains conductive hazards and an Echo can spend its component budget on Storm Ward. Mixed, inconsistent signatures and unsupported traces weaken confidence instead of automatically fooling the dungeon.
2. **A private understanding.** The player teaches protection, performs a nonlethal rescue, saves the actual operation composition and corrects its boundary. Rebinding uses the semantic role of a new object. The relic can carry the learned diversion to the Echo's shadow resonator: the guard physically turns, the light goes out, the player receives an opening, and the guard's defense temporarily drops. The action cites the demonstration, correction and applicable principle.
3. **The difference matters.** Storm Ward resists the public strategy. A hidden attack receives its own mechanical advantage; the relic's opening temporarily disrupts the certified defenses. Both the boss component and the relic's action retain separate source chains. The post-boss reconstruction links those causes instead of presenting an unstructured log.
4. **Correction changes behavior.** The first mistaken generalization protects the wrong figure. Correction removes that protection and updates the private interpretation. Changing a principle's applicability changes the relic's selected priority. Overriding an independent choice costs four energy and one trust.
5. **A plan can fail physically.** While a sealed sequence runs, a hostile guardian can destroy its needed diversion object. The next step interrupts; the engine preserves the approved sequence and the destruction event. The player must revise the next attempt.
6. **Continuation preserves history.** A 24-room replay crosses three Echoes, avoids recently used room families and resumes to exactly the same facts, beliefs, resources, random state and pending actions.

## AI boundary and costs

The server uses the existing OpenAI credential and model configuration. All provider calls use strict JSON schema and `store: false`. It replays the submitted journal, validates every operation, simulates the proposal and binds the result to run, revision, digest, request and generation. Direct moves and combat run locally. A deadline, rate limiter, bounded cache and authored suggestions preserve play during failures. Input text is transient and excluded from analytics and the event journal; a player-chosen maneuver name is part of the local save.

Limits are explicit: 400 input characters, 12 proposed operations, 48 compiled steps, 900 provider output tokens, a provider deadline of at most six seconds, 40 AI requests per page session, and the existing distributed request limiter. Cache hits do not invoke the provider. The normalized-text/context cache does not claim universal semantic equivalence; production checks compare a Norwegian and English expression of the same plan.

The production checks used **3,082 input tokens and 469 output tokens** across three real `gpt-5.6-terra` calls. At the published standard rates of $2 / million input tokens and $12 / million output tokens, that is **$0.011792 (about 1.18 US cents)** before any cache discount. This is a token-based estimate, not an invoice or account-wide spend reading. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

## Actual limits

- **Pacing:** twelve authored chambers form the first chapter. The 45–60 minute target has not been validated with a timed human playtest. Automated playthrough speed is not evidence of human pacing or emotional impact.
- **Device thermals:** responsive layout, touch, WebKit, reduced motion and absence of continuous idle animation are checked. No physical iPhone temperature, battery or sustained thermal-throttling measurement is available from this environment.
- **Persistence:** local browser storage, not account/cloud sync. Version 3 uses deterministic replay, validated v2 migration and an integrity checksum, not cryptographic anti-cheat. Cross-tab writes are protected. V0 saves are preserved separately, because their missing observations cannot truthfully be invented during migration. Unsupported saves remain untouched.
- **Long-run bounds:** local journal storage currently has a 12,000-command / 4 MB ceiling; beyond it play continues in memory with a visible warning. AI requests accept at most 2,000 journal commands / 750 KB; longer runs retain immediate actions and authored fallback. An archival checkpoint migration is a future persistence extension.
- **Content bounds:** AI composes a certified operation language and chooses among approved scenario families. It does not invent executable rules, unrestricted moral predicates, new art or arbitrary NPC behaviors. Six principles and five boss components are curated. Saved maneuvers are player-created compositions, not a catalogue of four fixed abilities.
- **Presentation:** custom vector room art and short synthesized motifs; no recorded voice performance, continuous music score or generative character art. Typed intention and platform dictation are available; there is no dedicated microphone recorder.
- **Future systems:** Pactcraft, shareable Echoes, counterfactual branches and machine-verified new rule generation have documented extension points and are not included as completed features.

## Verification record

- `npm test`: 366 passed, including 25 new Mind Beneath unit/integration tests and the existing suites.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; the new route and API are included in the production build.
- `npm run lint`: zero errors, 13 existing warnings in `onchain-game.tsx` and `vrf-latency-monitor.mjs`; no warnings in the new mode.
- Desktop Chromium and iPhone 11 Pro WebKit: 12/12 browser tests passed, including the full first chapter and post-Echo continuation through visible controls, plus first teaching, maneuver reuse, reload, pointer/touch, WASD/arrows, reduced motion, no horizontal overflow, failed AI and stale AI.
- Additional Android Chromium and iPhone SE WebKit checks: 10 passed.
- Existing other-mode browser suites: 17 passed, eight failed. All eight failures reproduced on untouched commit `dc3badf` in a separate baseline directory. They concern obsolete immediate-combat/loot selectors and same-tick storage expectations. The baseline also showed one extra timing-sensitive failure under its slower Webpack server. No Practice, Challenge or Onchain game logic was edited. All six Weekly Challenge browser checks passed on the changed tree.

The unit suites map to the requested gates as follows:

| Gate | Evidence |
| --- | --- |
| Facts, LoS, observations, reports, private/public separation | `mind-truth.test.ts`: private teaching exclusion, occlusion/darkness/distraction, delivery requirement, interception, source chains |
| Relic learning and moral agency | `mind-learning.test.ts`: demonstration, correction, applicability, priority, paid override, favor provenance |
| Planning and combat | Same-engine preview/direct execution equality, role rebinding, actual object destruction and immutable interrupted plan |
| Fallible theories and costly deception | Consistent observed cost versus contradictory noise; different later geometry and boss loadouts for two styles |
| Directed chapter and mechanical chills | `mind-expedition.test.ts`: full chapter, autonomous resonator action, sourced defense disruption, public/quiet Echo comparison |
| Persistence and continuation | 24 chambers / three Echoes, anti-repeat grammar, exact replay, corruption handling, cross-tab conflict, mobile reload |
| AI reliability | `mind-ai.test.ts`: strict provider contract, bounded output, timeout, provider failure, cache rebinding, malformed requests, stale responses |

## Production verification — 20 September 2026

Production deployment: `dpl_5G2FVSy5EzJa2NPvzQx27d6rWaZw`, code commit `17064fe`.

- Canonical route: [delveworn.app/living-dungeon](https://delveworn.app/living-dungeon).
- Immutable deployment: [delveworn-drb63p3gy-crypto-mickle.vercel.app](https://delveworn-drb63p3gy-crypto-mickle.vercel.app).
- Vercel production build passed and assigned `delveworn.app` to this deployment.
- `/living-dungeon`, `/practice`, `/challenge` and `/onchain`: HTTP 200.
- Real teaching request: correct protection principle and applicability, valid state binding, 3,160 ms, 1,020 input / 66 output tokens.
- Real Norwegian plan: certified extinguish → noise → release composition, valid state binding, 3,408 ms, 1,034 input / 192 output tokens.
- Equivalent English plan: valid state binding, 3,164 ms, 1,028 input / 211 output tokens.
- Both returned plans executed through the deterministic engine, completed the rescue and produced identical room, health, inventory and energy states. The provider's decorative signature choices differed; the engine correctly retained authority over actual action signatures.
- The production browser displayed the new game, preserved notice of its previous V0 save, accepted a private lesson and rendered a legal ghost-plan preview.

Reproduce the endpoint check with `node --import tsx scripts/check-mind-production.ts` from `frontend/`. It writes only response metadata and certified operations, never credentials or raw provider context. The evidence from this run is retained in `docs/THE_MIND_BENEATH_PRODUCTION_CHECK.json`.

## Follow-up: knowing what to do next — 20 September 2026

Player feedback identified the immediate next action as the main obstacle. A guide above the board now derives a concrete action from the saved room: teach, preview, execute, preserve, escort, correct, continue or recover from an interruption. The first rescue has five visible steps. Later guidance handles the Echo and continuing scenario families, including waiting at the stairs for an escorted person. This is presentation over the existing commands; it introduces no engine, journal or save-version change.

The first lesson sits beside the room, the player is labelled DU, the lens explains its colors and paths, and the commit button says Utfør planen. Optional written intentions are collapsed. Slik spiller du pauses execution while open; reading its keyboard controls does not move the player. The guidance itself requires no provider call. The prior real-AI verification remains applicable to the unchanged API; it was not repeated for this UI update.

Verification: all 366 unit/integration tests passed; all 14 Desktop Chromium/iPhone 11 Pro WebKit browser tests passed, including both complete expeditions and a new guided rescue → reload → preserve → reuse → correction path. TypeScript and the production build passed. Lint has zero errors and the same 13 pre-existing warnings. Mobile visual inspection confirmed all three initial choices fit at 375 × 812, and the next action and board remain separate. The first browser run exposed a test that chose report interruption when an escort was needed after the boss; the test now follows the actual room guide and verifies completion.

Published deployment: `dpl_ENWmbhBbmdR9oNbHvM9YUfy5Z3CP`, [immutable build](https://delveworn-9a1ibdosd-crypto-mickle.vercel.app/living-dungeon), promoted to [delveworn.app/living-dungeon](https://delveworn.app/living-dungeon). No other mode's implementation changed.


## Painted world and English release — 20 September 2026

The active game is now English throughout, including UI and accessibility names, the next-action guide, chapter and room text, principles and corrections, event descriptions, the relic's directed voice, theories, causal explanations, errors and fallback. The provider is instructed to answer in English even when the player writes another language. Custom maneuver names remain the player's text.

The board now uses the original Delveworn adventurer, existing orc/zombie cutouts, eight original room paintings, the logo and item/relic artwork. A new 281,332-byte atlas adds the masked warden, cartographer, scribe, bell, brazier, conduit, alcove and stairs. Physical walls, shadows, chains, shields, health, reported routes and plan paths stay attached to actual world state. Short impact effects finish in 650 ms and respect reduced motion. Fixed interaction rectangles prevent decorative SVG bounds from moving click/touch targets. Shared art and other modes were not edited.

Source paths, the two exact generation prompts, selected generator outputs and black-key rendering are documented in [`frontend/public/living-dungeon/README.md`](../frontend/public/living-dungeon/README.md). Generation used the built-in ImageGen tool. It does not expose a billed dollar amount. The graphics themselves introduce no OpenAI request and no continuous animation or particle loop. Physical-device thermal measurements remain unavailable.

Save v3 / `mind-beneath-2` can resume valid Norwegian v2 memories, including a partly executed plan. The frozen original rules verify the entire old journal and its bindings before the same choices are replayed under English rules. Only verified plans are rebound. Facts, observations, reports, resources, random state, learning, personal names, relationships and boss outcomes are preserved. Existing storage is not overwritten merely by loading it.

Verification for this release:

- 372 unit tests passed, including full old-expedition migration through the Echo to an exactly identical English replay, partial-plan migration, preserved custom names, invalid bindings and cross-tab writes.
- TypeScript passed. Lint has zero errors and the same 13 pre-existing warnings outside Living Dungeon.
- Vercel production build passed (24 seconds).
- English preview and painted art inspected at desktop, 375 px and 320 px; no horizontal overflow at 320 px.
- Browser checks cover the complete chapter and post-boss continuation, keyboard, mouse, touch, reduced motion, asset loading, hit targets, interrupted/stale AI, onboarding, normal resume and old-memory migration.

Canonical production is `dpl_6P1ADWEZR6QGAx6hTwUTzfj8UEmT`, promoted from [delveworn-cf4fjxfa9-crypto-mickle.vercel.app](https://delveworn-cf4fjxfa9-crypto-mickle.vercel.app). Application source corresponds to code commit `1a46cb3`.

All 18 browser checks passed across desktop Chromium and iPhone 11 Pro WebKit: 14 short checks, two complete expeditions after correcting an English selector typo, and two old-save migration checks. The production browser confirms `lang=en`, `painted-1` artwork and the English guided introduction. There is one English game, with no Norwegian locale, alternate route or language selector. The frozen Norwegian modules are only a historical journal validator; they are never rendered.

The canonical production check returned HTTP 200 for Living Dungeon, Practice, Challenge and Onchain. Three real provider calls returned English lines, valid bindings and executable plans. The two equivalent plan intentions produced identical room, health, inventory and energy outcomes after engine execution. Latencies were 2,062–2,926 ms. Usage was **3,121 input and 365 output tokens** on `gpt-5.6-terra`. Applying the same $2 / million input and $12 / million output rates recorded in the earlier check gives **$0.010622**, about 1.06 US cents; this is a conditional token estimate, not an invoice. Built-in ImageGen billing is not exposed. Exact response metadata and English lines are retained in [`THE_MIND_BENEATH_ENGLISH_PRODUCTION_CHECK.json`](THE_MIND_BENEATH_ENGLISH_PRODUCTION_CHECK.json).
