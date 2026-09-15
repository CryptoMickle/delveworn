# First Descent verification — 2026-09-15

## Latest correction — fullscreen mobile room panel

- Active `/play` fills the available mobile viewport, with a room background
  behind its top/middle/bottom grid. HUD, health, actions, feedback, help/journal,
  shop and outcome panels live inside that room panel. Desktop stays unchanged.
- Dynamic viewport units account for Safari chrome; safe areas protect the
  notch/home indicator. No fullscreen API or zoom restriction.
- Original art is not stretched. A camera helper caps tier-1 actor scale at the
  previous mobile size and keeps keyboard/tap movement inside visible bounds.
- **98 frontend tests passed; 0 failed.** ESLint: **0 errors, 14 existing
  warnings**. Explicit TypeScript passed. Somnia standard production build passed.
- Geometry checks cover 20 portrait width/height combinations, actor scale,
  avatar visibility and reachable loot/door targets. Core/model/storage and
  original raster assets are unchanged by this layout correction.
- Browser discovery: **159 cases in 10 files**, including the iPhone 11 Pro
  profile (375×635 viewport / 375×812 screen). Updated tests check fullscreen
  bounds, controls without page scrolling, Menu, modal shop, recovery and resize
  at 375×812/635/568 without changing the saved game.
- Browser execution was attempted again through the approved in-app tool. Its
  mandatory admin-policy check still failed. No browser bypass was used.
- Current preview source: `861687cd1a8f08d4335280c866825c26c431f3ea`;
  deployment `dpl_2WUeAcHLxBppLFGjAFo5dtqcsuZ8`: **READY**.
  <https://delveworn-qmkq2lana-crypto-mickle.vercel.app/play>
- Deployment-specific seven-day access link delivered in the conversation;
  token not committed. `/play` returned HTTP 200 with the expected title and
  `width=device-width, initial-scale=1, viewport-fit=cover`. Room, avatar, Grave
  Belle and potion assets returned HTTP 200. These are delivery checks, not
  browser interaction evidence. Previous preview links below are superseded.
- This remains a review build, not production-ready. No production release,
  remote Git push/CI run or onchain transaction.

## Previous correction — original core, floor loot and mobile controls

User phone feedback overrides the earlier starter-build proposal. `/play` now
starts with the original kit, uses default Practice combat, and applies loot
only when the avatar reaches it. HP and Attack/Storm/Potion are inside the room
on mobile. Original background and original monster files are preserved.

| Check | Actual result |
| --- | --- |
| Frontend Node/tsx suite | 97 passed, 0 failed, 0 skipped |
| ESLint | 0 errors; 14 existing warnings in legacy onchain/monitor code |
| Explicit TypeScript | Passed |
| Somnia standard production build | Passed; `/play` generated |
| Existing RISE legacy production build | Passed; `/play` generated |
| Somnia session-key production build | Passed; `/play` generated; development-only `/concept` remains 404 |
| Original combat | Start/RNG/action state parity, all three actions, complete win; three classic golden hashes unchanged |
| Loot/persistence | All drop types; deferred inventory; once-only pickup; stale/invalid actions; reload; boss keep/equip |
| Transparent artwork | Four WebPs; four channels; alpha-zero corners and significant genuine transparent/opaque areas |
| Scene geometry | Guarded/open door, reachable pickup, door-before-pickup routing and exact reward labels |
| Scripted simulation | 200 valid terminal runs; 110 wins; mean 46.17 turns; see `descent-simulation.json` |
| Browser discovery only | 153 tests in 10 files; 18 First Descent device cases; not executed |
| Static illustrations | Nine React/SVG exports; loot labels moved clear of the avatar; not browser QA |

The browser test specification now includes no starter relic, physical pickup,
full run/reload, boss keep/equip, original background, and combat controls within
the room on mobile. Actual execution is still unavailable because the mandatory
browser admin-policy check failed. It was not bypassed with another browser.

Local Node is 24.19.0; GitHub frontend CI uses Node 22. Local checks do not certify
remote CI on unpublished commits. Contracts and original monster raster files
are unchanged by this correction; prior 143 contract tests are historical.

## Updated phone preview

- Project `delveworn-app`; source commit `a542b559d1eda53f2668950bb4aa0ef5c7618368`.
- Deployment `dpl_H3RoHdmpY6reNWa7tcC6X6i7huC3`: **READY**, preview target.
  <https://delveworn-q2fvt6inb-crypto-mickle.vercel.app/play>
- Exported tracked frontend files only. Somnia configuration, session keys off.
- Deployment-specific shareable link created for seven days and delivered to
  the user; token never committed. Project-wide protection unchanged.
- `/play` returned HTTP **200** with the expected First Descent title. Room,
  avatar, Grave Belle and all four transparent loot assets returned **200** with
  `image/webp` content types through that shareable link.
- These are deployment/asset checks, not interaction or responsive-render checks.
- No production release, Git push/merge, account creation or contract transaction.

## Remaining review gates

- Current Playwright execution and actual desktop/phone gameplay/rendering.
- Native touch, 200% zoom, phone sound, reduced motion and first-run duration.
- Earlier browser baseline was 129 passed, 2 failed, 4 skipped. Boss-score and
  short-screen fixes exist, but their browser regressions are not certified.
- New room renderer is local-only. Existing Somnia UI remains; the previously
  observed VRF adapter mismatch is unresolved. No live onchain scene adapter.

**Review preview, not production-ready. Phase 1 is still open.** Follow the phone
checklist in `FIRST_DESCENT.md`, then run the planned 5–10-person uncoached test
once the browser/device checks pass.

## Changed files in this correction

- `frontend/app/descent/{model.ts,storage.ts,game.tsx,game.css}`
- `frontend/app/dungeon/{scene.tsx,scene.css}`
- `frontend/app/play/page.tsx`, `frontend/app/dungeon-home.tsx`
- `frontend/public/dungeon/loot/{potion,weapon,armor,pouch}.webp`
- `frontend/tests/{descent.test.ts,dungeon-scene.test.ts,dungeon-loot-art.test.ts}`
- `frontend/tests/helpers/descent-policy.ts`, `frontend/tests/e2e/descent.spec.ts`
- `frontend/scripts/{simulate-descent.ts,render-descent-scene.tsx}`
- `FIRST_DESCENT.md`, `docs/phase-1-{status,vertical-slice}.md`
- This file, simulation JSON, transparent-loot provenance and nine scene exports.

## Historical evidence (superseded rules, retained for traceability)

The sections below describe older checkpoints, including their starter builds.
They do not describe the restored v2 gameplay. The current simulation JSON has
been replaced by the v2 run above; the old 600-run artifact remains in Git history.

## User-authorized Vercel phone-test preview

- Project `delveworn-app`, root `frontend`, source commit
  `4ebf5cb8797e56ac6618ebfc4fabab4be52a6c89` exported from tracked files only.
- Deployment `dpl_9ua69oNVJ9jghrixShS6sRn5xyxE`: **READY**, preview target.
  <https://delveworn-iph4uuz9a-crypto-mickle.vercel.app/play>
- Preview build overrides: Somnia configuration, session keys disabled. Existing
  production settings/domains were not changed; no Git push was needed.
- Created a deployment-specific, seven-day shareable link for the user's phone.
  Its token is not committed. Project-wide Vercel authentication remains enabled.
- HTTP check through that link: `/play` returns **200**, expected First Descent
  title/content; room, adventurer and Grave Belle WebP assets return **200**.
- This verifies deployment and asset delivery, not browser interaction or mobile
  rendering. The remaining Phase 1 gameplay/device checks below still apply.

## Door-guard layout follow-up — 2026-09-15

- Moved all four tier 1 actors to the north-door path; reduced their sprite
  heights to 120/110/146/178 scene units. Grave Belle was previously 185 tall.
- Kept original raster files and silhouette clips. Repositioned shadows, loot,
  interaction targets and combat effects together with the guard.
- Frontend suite: **91 passed, 0 failed**. Three new tests exercise the guarded
  and open doorway, centered-monster floor targets and movement bounds.
- TypeScript passed. ESLint: **0 errors, 14 pre-existing warnings**.
- Somnia standard production build passed again after this change. The other
  two matrix configurations and contract suite were last run at the checkpoint
  below; this presentation-only follow-up did not modify chain configuration.
- Regenerated and inspected all four `descent-scene-*.png` illustrations. They
  show the smaller actors in front of the exit and remain static SVG exports,
  not browser screenshots. Browser/device verification is still unresolved.

## Previous implementation checkpoint — a5f7e64

| Check | Actual result |
| --- | --- |
| Frontend Node/tsx suite | 88 passed, 0 failed, 0 skipped |
| ESLint | 0 errors; 14 existing warnings in legacy onchain/monitor code |
| Explicit TypeScript | `npx tsc --noEmit` passed |
| RISE legacy CI build configuration | Production build passed; `/play` generated |
| Somnia standard CI build configuration | Production build passed; `/play` generated |
| Somnia session-key CI build configuration | Production build passed; `/play` generated |
| Development-only concept gate | Compiled production `concept.meta` status 404 |
| Foundry formatting | Passed |
| Foundry size build | Passed |
| Contract suite | 143 passed, 0 failed, 0 skipped; 13 suites |
| Scripted training simulation | 600 valid terminal runs; results in `descent-simulation.json` |
| Original artwork/contract diff | No changes under `frontend/public/monsters`, `src`, `script`, `test` |
| Git whitespace checks | Passed |
| Browser suite discovery only | 150 tests in 10 files; not an execution result |

Local Node version is 24.19.0; GitHub frontend CI specifies Node 22. Builds use
the same public matrix settings, but this is local validation, not a remote CI
run on the unpublished commits. No RPC, wallet approval or transaction is needed
by these checks. Foundry emitted only an optional signature-cache write warning
because the sandbox prevents writing under `~/.foundry/cache/signatures`.

## Gameplay evidence

- Three pre-change hashes cover entire classic Practice runs including logs
  and RNG position. All remain byte-identical after optional intent parameters.
- Tests cover exact guard/reply rounding, zero wind-up through armor and potion,
  distinct intent cycles, stale/invalid action rejection and unchanged RNG.
- Warden, Duelist and Stormcaller complete seed 12345 with a documented test
  policy. Every transition serializes/restores with identical next outcome.
- Reload cases include supply, camp, boss reward and terminal win/death.
- Storage tests preserve unknown saves and reject stale writers. Game audio
  tests cover gesture gating, ambience, boss stop, blur, mute and delayed resume.

## Visual evidence — distinguish images from browser QA

Before: `before-desktop.png`, `before-mobile.png` are the earlier baseline
browser captures. After: `descent-scene-0.png` through `descent-scene-3.png` are
**static React/SVG illustration exports**, inspected for original monster
identity, the androgynous avatar, room composition and relic placement. They
are not browser screenshots and cannot prove responsive layout or interaction.

The original monster raster files are reused with runtime silhouette clips.
Only the room and base avatar are new raster assets. Their prompts/provenance
are in `production-assets.md`. The avatar's black background is removed in the
scene's SVG presentation filter; mobile GPU/device performance needs review.

## Unexecuted / unresolved

In-app Browser refused access to `http://127.0.0.1:3100` because its
admin-enforced security policy could not be verified. This is not a code test
failure or an app permission approval from the user. No alternate browser was
used to bypass it. The user was asked for direct feedback on `/play`.

- New and existing Playwright tests have **not** run on this final revision.
- Earlier baseline: 129 passed, 2 failed, 4 skipped. Boss-ending score cleanup
  and short-screen header fixes are implemented, but their native browser
  regression cases need rerunning. The old failures are not declared resolved.
- Keyboard/touch behavior, actual responsive layout, reduced motion, audio on
  a physical phone, 200% zoom and real session duration need verification.
- The new room renderer is local-only. The existing classic/onchain UI and
  onchain rules are preserved; a live snapshot adapter to the new scene is not
  shipped. Somnia's previously observed adapter mismatch is still unresolved.
- No remote CI run, merge, push, deployment or contract transaction occurred.

Conclusion: **local review build, not production-ready or certified blind-test
ready. Milestone F remains open.** Next: restore policy-compliant browser access,
run the 150-case suite, review desktop/physical phone, then use `FIRST_DESCENT.md`
for an uncoached 5–10-person test.

## Changed files

Implementation:

- `frontend/app/descent/{model.ts,storage.ts,game.tsx,game.css}`
- `frontend/app/dungeon/{scene.tsx,scene.css}`
- `frontend/app/play/page.tsx`
- `frontend/app/practice/engine.ts` (optional context only; v1 golden-checked)
- `frontend/app/dungeon-home.tsx`, `home.module.css`
- `frontend/app/concept/page.tsx`, `concept/review.css`
- `frontend/app/game-audio.ts`, `use-game-audio.ts`, `globals.css`
- `frontend/public/dungeon/{stone-room.webp,adventurer.webp}`

Tests, tools and documentation:

- `frontend/tests/descent.test.ts`, `game-audio.test.ts`
- `frontend/tests/dungeon-scene.test.ts` (door-layout follow-up)
- `frontend/tests/helpers/descent-policy.ts`, `tests/e2e/descent.spec.ts`
- `frontend/scripts/{simulate-descent.ts,render-descent-scene.tsx}`
- `README.md`, `FIRST_DESCENT.md`
- `docs/phase-1-status.md`, `docs/phase-1-vertical-slice.md`
- `docs/phase-1-evidence/{production-assets.md,descent-simulation.json,verification.md,descent-scene-0.png,descent-scene-1.png,descent-scene-2.png,descent-scene-3.png}`
