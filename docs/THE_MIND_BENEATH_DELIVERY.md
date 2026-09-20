# The Mind Beneath — delivery evidence

## Implementation

The replacement lives at `/living-dungeon`; Practice, Weekly Challenge and Onchain retain their engines, components and save keys. The home card changes only this mode's description. The previous Living Dungeon source remains for regression coverage, but the route uses the new engine and interface.

The game contains a deterministic grid, sealed multi-turn plans, physical enemy reactions and interrupted plans; line-of-sight, darkness and distraction; individual observations and beliefs; moving reports and interceptable relays; competing, decaying dungeon hypotheses; six teachable principles with applicability, priorities, examples and corrections; compositions saved as personal maneuvers; moral choices and paid overrides; relationships with spendable favors; scars; twelve directed first-chapter chambers; eight room families; five budgeted boss components; and continuing rescue, escort, evidence and report-control scenarios with later Echoes.

The interface exposes the same actions through visible suggestions, object connections, editable steps, a short intention field, mouse, touch and keyboard. Ghost paths and numbered actions show the preview in the room. The board keeps a fixed aspect ratio. The private-learning and suspected-theory summaries stay brief; provenance is behind “Hvorfor?”. Event-driven sound distinguishes the dungeon learning from the relic understanding. Reduced motion disables transitions, and hidden tabs pause automatic execution.

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

Production request measurements and final verification results are recorded below after deployment.

## Actual limits

- **Pacing:** twelve authored chambers form the first chapter. The 45–60 minute target has not been validated with a timed human playtest. Automated playthrough speed is not evidence of human pacing or emotional impact.
- **Device thermals:** responsive layout, touch, WebKit, reduced motion and absence of continuous idle animation are checked. No physical iPhone temperature, battery or sustained thermal-throttling measurement is available from this environment.
- **Persistence:** local browser storage, not account/cloud sync. Version 2 uses deterministic replay and an integrity checksum, not cryptographic anti-cheat. Cross-tab writes are protected. V0 saves are preserved separately, because their missing observations cannot truthfully be invented during migration. Unsupported saves remain untouched.
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
