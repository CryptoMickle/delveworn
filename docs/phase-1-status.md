# Revised Phase 1 — continuation record

Updated: 2026-09-15. Scope: a top-down, turn-based Delveworn vertical slice.

## Decision gate

The user's revised request explicitly requires approval of milestone B's small
visual prototype **before producing or integrating a complete new asset set**.
Milestones C–F must wait for that approval. A prototype is not a finished Phase 1.
Approval received on 2026-09-15: **"Veldig bra. Fortsett"**, following the
original-style revision. Milestones C–F are authorized. Preserve the original
monster artwork style; do not reopen the visual approval gate.

**User correction (2026-09-15):** "Nei, behold stilen i monsternes
originalgrafikk". The original monster artwork is now the fixed visual source
of truth. The painted target and flat vector character style were rejected.
The subsequent approval authorizes the small matching asset set and C–F.

**Further correction:** "Kanskje gjøre spilleren mindre binær kjønnsmessig?"
The selected base avatar is now androgynous: less broad shoulders, neutral
proportions, practical clothing and a hidden face. Same plum cloak/art style.

**Room composition correction:** the monster now guards the north doorway.
Tier 1 actors are smaller, especially Grave Belle. The original monster images
and the androgynous adventurer remain unchanged.

## Current checkpoint — restored core and mobile room controls

The user's phone-review corrections supersede the earlier training proposal:
no starting relic choice, original combat rules, physical floor-loot pickup,
original Delveworn background, and compact HP/actions inside the room on mobile.
`/play` is the playable local slice. `/concept` is a historical development-only
review. Classic Practice, Weekly and existing Somnia onchain mode remain.

### Milestones C–D — gameplay and state

- One start button: 100 HP, three potions, zero gold, base weapon/armor and no
  owned/equipped relic. Ten curated encounters, supplies after 5, camp after 9,
  boss in 10. No starter builds or added guard/reply multipliers.
- Attack, Storm, Potion, criticals, armor, camp and relic choices use default
  Practice engine calculations. Original Practice/Weekly golden traces remain
  identical; direct parity tests cover all three actions and a complete win.
- Killing rolls the original reward once. Gold/items stay in `pendingLoot`
  until the avatar arrives. Pickup applies those exact deltas once without a
  turn or RNG draw. A door tap first routes to uncollected loot. Reload cannot
  reroll it. Healing/shop/door/relic decisions wait until pickup.
- Boss loot precedes the original keep/equip relic decision. Relics are earned
  after the boss, and each new run starts with no relic.
- Rules `first-descent-2`; save key `delveworn_first_descent_v2`. Earlier v1
  preview saves remain separate and untouched. Unknown saves are preserved;
  unavailable storage permits a labeled session-only run.
- Revision guards and Web Locks protect writes; the fallback without Web Locks
  remains best-effort. Movement/animation/audio own no combat RNG. Reload uses
  a safe actor anchor. Other modes' saves are unchanged.
- The scene accepts only `RoomView` / `RoomActions`. Its new combat-control slot
  contains UI, not wallet/RPC authority. Somnia remains the intended onchain
  configuration; a live snapshot adapter to this scene is not shipped, and the
  previous VRF adapter mismatch is unresolved.
- Documented automated policy: 200 valid terminal runs, 110 wins (55%), mean
  46.17 combat turns. These are not measured human completion or session times.

### Milestone E — presentation

- Original monster files and androgynous avatar preserved. All tier-1 enemies
  guard the north door, with heights 120/110/146/178 scene units. No new tiers.
- Loot uses four new transparent WebP cutouts: potion, weapon, armor and boss
  pouch. Gold reuses the original coin. All four have genuine alpha and clear
  corners; prompts/provenance are in `phase-1-evidence/transparent-loot.md`.
- The original plum-to-black background is restored exactly. Attack, Storm
  and Potion use the original orange/violet/green accents. Mobile combat HP,
  potion count and 58px action buttons sit inside the bottom of the room.
- Same 390px mobile room height across phases avoids resizing during combat
  and pickup. Desktop controls remain inside the room panel below the scene.
  A compact safe-healing row appears after pickup. Reduced motion and native
  scrolling remain supported.
- Nine static React/SVG illustrations cover four enemies and five loot views.
  These are illustration exports, not browser screenshots or responsive QA.

### Milestone F — verification and preview

- Frontend tests: **97 passed, 0 failed**. TypeScript passed. ESLint: **0 errors,
  14 pre-existing warnings**. Alpha-channel and loot routing checks pass.
- All three existing CI build configurations passed locally. Development-only
  `/concept` remains a production 404. Current evidence is in
  `phase-1-evidence/verification.md`.
  Current phone preview: source `a542b55`, deployment
  `dpl_H3RoHdmpY6reNWa7tcC6X6i7huC3`, READY. `/play` and seven room/actor/loot
  assets returned HTTP 200 through its seven-day shareable link. The earlier
  `4ebf5cb` preview is superseded; tokens are delivered only in the conversation.
- Browser suite discovery: **153 tests in 10 files**, including 18 First
  Descent device cases. Discovery is not execution.
- Current browser execution remains blocked: the in-app Browser's mandatory
  admin policy check is unavailable. No alternative browser bypass was used.
- Earlier baseline: 129 passed, 2 failed, 4 skipped. These are historical, not
  a current pass. Physical phone/desktop review, current full browser suite,
  measured first-run duration and the 5–10-person blind test remain open.
- No production release, Git push/merge, new remote CI or contract transaction.

**Status: phone-review preview; not production-ready. Phase 1 remains open
until actual device and browser gameplay checks pass.**

See `FIRST_DESCENT.md` for play, recovery and the next phone checklist.

## Workspace and baseline

- Repository: `CryptoMickle/delveworn`; frontend: `frontend/`.
- One local working branch: `feat/phase-1-dungeon-slice`, renamed from
  `feat/weekly-verified-challenge`; history and existing work preserved.
- Clean starting tree at `89be65f`, following `cbd5d71` (the previous Weekly work)
  and upstream base `57a2d28`. No push, merge or deployment performed.
- GitHub inspected on 2026-09-15: upstream has two newer commits, `cdca101`
  (stable combat buttons/pending status) and `1a7119a` (development badge).
  Their diff was reviewed; these independent remote changes are not overwritten
  or merged here. Reconcile them before a later publication review.
- Latest observed [Frontend CI](https://github.com/CryptoMickle/delveworn/actions/runs/34968428253)
  succeeded at `1a7119a`. CI also succeeded for the local upstream base
  [`57a2d28`](https://github.com/CryptoMickle/delveworn/actions/runs/34955290510).
  These results do **not** represent CI on the unpublished local commits.
- Read parent `AGENTS.md` and `frontend/AGENTS.md`. Synced `sources/` are
  read-only. Read the installed Next.js guides before adding prototype code.
- Root `.gitignore` ignores `docs/`; milestone documents are explicitly tracked.

## Milestone A — inspection completed

### Map of the code

| Area | Current source and behavior | Reuse / boundary |
| --- | --- | --- |
| Routes | `frontend/app/page.tsx`, `/practice`, `/onchain`, `/challenge` | Preserve current routes; no additional Weekly work. |
| Practice | `app/practice/engine.ts`, `page.tsx`, `storage.ts` | Local turn-based rules, no wallet/RPC/VRF. Use existing transitions. |
| Randomness | `app/practice/random.ts`; Solidity randomness adapters | Injected local RNG; authoritative callback onchain. Animation must never consume game RNG. |
| Progress | `roomsCleared`, living monster, loot/relic phase | Sequential, no map or physical position yet. Boss every tenth combat room. |
| Combat | Attack, Storm, criticals, potion retaliation, armor and weapon scaling | Reuse damage/healing calculations; enemies currently differ mainly by stats. |
| Recovery | `app/between-rooms.tsx`, camps, supply and relic selection | Shared presentation already exists. Supply after room 5; camp before boss 10. |
| Relics | `app/relics.ts`, engine rules, `src/RelicRules.sol` | 15 relics, one equipped, modifiers/crit/heal/revive. Layer visuals by relic ID. |
| Persistence | Practice save v1, bounded/schema-checked; onchain snapshot/recovery | Keep normal saves untouched. New scenario needs a versioned save and explicit ruleset. |
| Onchain | `app/onchain-game.tsx`, `src/Delveworn.sol` | Snapshot V3, pending lock, owner/session guards and retry/recovery are authority boundaries. |
| Shared UI | `game-ui.tsx`, HUD, battle/recovery/run-end, keyboard and scroll helpers | Reuse data/affordances, avoid transplanting the giant onchain component. |
| Sound | `game-audio.ts`, `use-game-audio.ts`, `boss-battle-score.ts` | Existing procedural cues, mute, focus/background cancellation; separate from game RNG. |
| Artwork | `public/monsters`, `assets/relics`, loot, logo, merchant and hero | 16 monster portraits, 15 relic icons; no top-down avatar/tile/walk assets. |
| Tests/CI | Node/tsx, Playwright (Chromium + WebKit), Foundry | Frontend CI: lint/test/build, 3 chain/session configurations. Solidity CI: fmt/build/test. |

### Actual mechanics to preserve

Practice starts at 100 HP, three potions, no equipped relic. Attack rolls a
narrow damage range with 15% base critical chance. Storm rolls from zero to a
higher maximum and cannot crit. A surviving enemy retaliates. Combat potions
heal 25 before half retaliation, capped at maximum HP; two per normal fight,
three per boss. Outside combat a potion heals safely. Armor reduces incoming
damage; weapon levels raise both outgoing ranges.

Zombie/Goblin/Orc base HP: 30/40/60; damage: 5/7/9. Boss: 90 HP/12 damage,
with room scaling. No current timed guard, chase, charge or intent cycle.
After a boss, one random relic is added to the collection; equipping is optional.
Owned relics can be changed between fights. Relic side effects are meaningful.

### Authority

HP, damage, potions, gold, purchases, relic ownership/equipment, enemy identity,
random outcomes and room completion come from the mode's authoritative state.
Onchain this is the contract, never the room renderer. Positions, wall geometry,
fog, doors, idle/walk/attack effects, sounds and camera are presentation.
Walking through a door may request `enterNextRoom`; it cannot confirm the next
room or send a second request while one is pending. Reload uses confirmed state.

The core remains chain-agnostic. Somnia is the intended optional onchain product
configuration; RISE support is legacy configuration, not a reason to fork rules.
The user's unresolved Somnia adapter mismatch remains unresolved here. No live
adapter correctness, wallet flow or VRF health is asserted by local tests.

### Technical debt and regression risks

1. `onchain-game.tsx` is over 10,000 lines, mixing rendering, wallet/session,
   transaction and recovery logic. Add a narrow view adapter; avoid broad refactor.
2. Practice save validation assumes current boss/relic cadence. Do not insert
   starter relics/new behavior into existing saved runs or silently reinterpret them.
3. `docs/relics-v2.md` describes an older room-5/three-offer scheme. Current code
   awards a single random boss relic. Current executable rules take precedence.
4. README statements about live Somnia support do not resolve the adapter issue.
5. Existing keyboard shortcuts select cards; WASD/avatar controls must be scoped
   to the new scene and must not steal wallet/form/modal keyboard input.
6. Preserve canonical pending locks, no double door entry, and account/mode
   invalidation during late responses. Visual damage must follow confirmed results.
7. Current portraits cannot serve as animated top-down sprites. Preserve their
   mood and silhouettes; do not mix unrelated full-image styles.
8. 14 existing lint warnings, mainly the onchain component and latency monitor.
9. A 10–15 minute target is a design hypothesis, not current measured playtime.

### Baseline verification (fresh run)

- Frontend unit/regression tests: **81 passed, 0 failed**.
- Lint: **0 errors, 14 existing warnings**.
- Default production build including TypeScript: **passed**.
- Foundry formatting: **passed**; tests: **143 passed, 0 failed, 0 skipped**
  across 13 suites. A sandbox warning prevented writing an optional signature
  cache; it did not affect compilation or tests.
- Full existing Playwright suite: **129 passed, 2 failed, 4 skipped** (3.1 min).
  Failures: boss-death audio cancellation on desktop; iPhone SE visual test
  reports only 125.67px of unobscured monster art (requires 150px). These were
  found before prototype code. Do not claim an all-green baseline.
  Targeted retry (desktop + WebKit boss-death/visual cases): **2 passed,
  2 failed**; both original failures reproduced.
- Reviewed actual test-captured desktop/Android combat and desktop camp images,
  plus iPhone SE combat. Desktop has clear portrait/action separation; mobile
  stacks large portraits above actions. On the smallest screen the sticky dock
  crowds the artwork. There is no visible player or walkable world in any mode.
  Tracked examples: `phase-1-evidence/before-desktop.png`, `before-mobile.png`.
  This is artifact-based visual review and automated interaction coverage, not
  an interactive in-app browser walkthrough or a physical-phone check.
- In-app Browser navigation was denied three times because its admin-policy check
  was unavailable. No alternative interactive browser was used to bypass it.

## Milestone B — approved; C–F in progress

Specification: `docs/phase-1-vertical-slice.md`. Review/test instructions:
`docs/phase-1-review.md`. Audit commit: `c96cee1`.

### Delivered

- Ten-combat-room plan matching existing boss/supply/camp cadence, with entrance
  and recovery spaces. First 10–15 minutes, three builds, enemy/boss behavior,
  controls, mobile/desktop layout, presentation, architecture and boundaries.
- Earlier **painted dark fantasy** proposal, now **rejected**. One ImageGen image
  saved at `docs/phase-1-evidence/art-direction-target.png`; retained as history.
  Do not use it as the selected style reference.
- Local development-only `/concept`: one room, visible avatar, Gary, floating
  Stormglass, HUD, intent, Attack/Storm/Potion, damage/healing feedback, walking,
  approach/door states, optional existing sound and explicit restart.
- Reuses the actual Practice transitions with a repeatable training fixture.
  No normal Practice save read/write, no wallet/RPC calls, no earned ownership.
- Code-drawn temporary scene/characters demonstrate layering and controls;
  they deliberately have lower texture/detail fidelity than the painted target.
  Static scene illustrations are exported from that source for inspection.
- Scoped styles, reduced-motion support, keyboard/floor-tap handlers and mobile
  layout are implemented. Their browser behavior is **not verified** yet.
- Nothing from milestones C–F, a full asset pack or a contract change has been
  integrated. Existing Practice/onchain/Weekly code remains intact.

### Verification after the concept

- Existing frontend unit/regression suite: **81 passed, 0 failed**.
- Lint: **0 errors, 14 existing warnings**, none in new files.
- Explicit TypeScript check: **passed**.
- Somnia standard production build: **passed**. Local compiled
  `.next/server/app/concept.meta` has **status 404** as required by the dev-only
  gate. No production server/network request was needed to inspect that artifact.
- Both static SVG scene exports rendered successfully and were visually reviewed.
  Fixed floating-damage/name overlap and ensured the exported relic image appears.
- These illustration exports do not verify HTML layout or interaction. In-app
  Browser policy verification remains unavailable. No claim of tested keyboard,
  touch, responsive browser layout or real-device performance for `/concept`.
- The existing baseline Playwright failures remain open; no new browser tests
  have been added/run for the concept. Contract source is unchanged; 143 baseline
  Foundry tests pass. The full CI build matrix is for the later F checkpoint;
  only default/Somnia standard builds were rerun in this work.

### B review state (historical)

#### Revision 02 — preserve original monster style

- `/concept` now opens with the unchanged original Gary, Grave Belle and Thud
  artwork and a revised one-room mockup made with those files as direct ImageGen
  references. The image is `frontend/public/concept/original-style-revision.png`.
- The original monster files were not edited. New avatar/environment/effects
  must match their detailed dimensional rendering, expressive faces, material
  textures and cinematic lighting. Preserve Gary's original dagger, hair, eyes,
  clothes and silhouette; no substituted helmet/armor/mace design.
- The earlier interactive vector study is retained in a collapsed section and
  explicitly labeled as temporary graphics. It is not the selected art style.
- Updated the specification and review guide. Exact image prompt/provenance and
  limitations are in `phase-1-evidence/original-style-revision-prompt.md`.
  A failed cutout without transparency was not integrated.
- Fresh revision checks: TypeScript passed; changed-page ESLint passed;
  production build passed and compiled `/concept` metadata still reports 404.
  `git diff --exit-code -- public/monsters` confirmed original assets unchanged.
  No combat/contract logic changed, so full gameplay suites were not repeated.
- Browser inspection was attempted once after the user opened the page; the
  same policy-check failure remains. Responsive/interactive visual QA is still
  unverified. The generated mockup is not evidence of implemented game graphics.

The local dev server was left running at `http://127.0.0.1:3100/concept` for
the user's review on this Mac. Restart instructions are in the review guide.
All work is local. No push, merge, production deploy or onchain transaction.
That B approval has since been received. The new `/play` implementation and
remaining browser-verification gate are recorded at the top of this file.

## Resume checklist

1. Read this file, the specification and review guide; inspect Git status and
   preserve both prior Weekly commits and all newer remote work.
2. Preserve the approved original-monster style and androgynous avatar. Do not
   reopen the B approval gate; C–F were authorized with "Veldig bra. Fortsett".
3. Resolve the Browser policy-check outage, then verify `/play` on desktop and
   touch/phone with the Browser skill. Do not bypass the restriction.
4. Run the current full browser suite, verify both baseline fixes and the new
   ten-room controls/recovery. Follow `FIRST_DESCENT.md` for the blind test.
5. Preserve actual onchain rules; Somnia stays behind its existing boundary.
   No transaction/deployment. Update this file after every milestone.

## Explicit exclusions

No Market Dungeon edits, Weekly expansion, NFT implementation, SDK, social
integrations, grants, partnerships, accounts, production publication, merge,
onchain transactions or `setConsumer` in this work.
