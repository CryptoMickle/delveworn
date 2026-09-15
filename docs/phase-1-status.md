# Revised Phase 1 — continuation record

Updated: 2026-09-15. Scope: a top-down, turn-based Delveworn vertical slice.

## Decision gate

The user's revised request explicitly requires approval of milestone B's small
visual prototype **before producing or integrating a complete new asset set**.
Milestones C–F must wait for that approval. A prototype is not a finished Phase 1.
No approval has been received yet.

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

## Milestone B — prepared for visual review; approval pending

Specification: `docs/phase-1-vertical-slice.md`. Review/test instructions:
`docs/phase-1-review.md`. Audit commit: `c96cee1`.

### Delivered

- Ten-combat-room plan matching existing boss/supply/camp cadence, with entrance
  and recovery spaces. First 10–15 minutes, three builds, enemy/boss behavior,
  controls, mobile/desktop layout, presentation, architecture and boundaries.
- Recommended **painted dark fantasy** art direction. One ImageGen target image
  saved at `docs/phase-1-evidence/art-direction-target.png`; exact prompt/tool
  provenance adjacent. This is a mockup, not a game screenshot or an asset pack.
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

### Current local state

The local dev server was left running at `http://127.0.0.1:3100/concept` for
the user's review on this Mac. Restart instructions are in the review guide.
All work is local. No push, merge, production deploy or onchain transaction.
**Not production-ready or blind-test-ready.** Await approval before full assets
and dungeon integration. Browser QA still needs resolution even if approved.

## Resume checklist

1. Read this file, the specification and review guide; inspect Git status and
   preserve both prior Weekly commits and all newer remote work.
2. Obtain/record the user's **visual approval** of the painted target and room
   layout, or revise the concept in response. Do not treat silence as approval.
3. When Browser policy checking is available again, verify the actual `/concept`
   layout and controls with the Browser skill. Do not bypass the restriction.
4. After approval: C dungeon/state integration; D versioned local training
   mechanics; E coherent small painted asset set; F full verification, fix the
   two baseline regressions, and prepare a 5–10-person blind test.
5. Preserve actual onchain rules; Somnia stays behind its existing boundary.
   No transaction/deployment. Update this file after every milestone.

## Explicit exclusions

No Market Dungeon edits, Weekly expansion, NFT implementation, SDK, social
integrations, grants, partnerships, accounts, production publication, merge,
onchain transactions or `setConsumer` in this work.
