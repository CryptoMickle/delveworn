# First Descent verification — 2026-09-15

## Executed checks

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
- `frontend/tests/helpers/descent-policy.ts`, `tests/e2e/descent.spec.ts`
- `frontend/scripts/{simulate-descent.ts,render-descent-scene.tsx}`
- `README.md`, `FIRST_DESCENT.md`
- `docs/phase-1-status.md`, `docs/phase-1-vertical-slice.md`
- `docs/phase-1-evidence/{production-assets.md,descent-simulation.json,verification.md,descent-scene-0.png,descent-scene-1.png,descent-scene-2.png,descent-scene-3.png}`
