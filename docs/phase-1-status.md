# Revised Phase 1 — continuation record

Updated: 2026-09-16. Scope: a top-down, turn-based Delveworn vertical slice.

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

## Current checkpoint — two lines per fight and Kevin continuity

Each fight now allows at most one personal opening and one reaction. Further
combat actions cannot start a third line, reset its timer or consume unseen
catalogue entries. The next room gets a fresh allowance; the 264-line rotation
and top-right parchment presentation remain. Kevin's original shop portrait is
mirrored horizontally through scoped CSS in the shared shop component.
The relic-choice phase now preserves Kevin's journey, so he resumes at the same
stage or stays parked afterward instead of entering the same room twice.

All **196 tests** and the Somnia-standard production build pass. ESLint has zero
errors and 14 existing warnings. The mounted Strict Mode probe confirms the
cap before and after expiry, and a fresh greeting next room. Protected preview
publication is pending; see [verification](phase-1-evidence/verification.md).

## Previous checkpoint — expanded monster dialogue and top-right speech

The shared room now has **264 unique spoken lines**, including four personal
openings for each of the sixteen monsters. Zombie, goblin, orc and boss reactions
have distinct voices. Each dialogue deck is exhausted before repeating, across
rooms and new runs within the same page visit. A full reload clears this small
in-memory history; it creates no stored identifier or gameplay randomness.

The compact parchment bubble is at the top right with the speaker's name.
Desktop Field Notes yield while speech is visible and return afterward. Mobile
shows complete lines without the former three-line truncation. Clearing a
combat effect no longer redraws a greeting or resets the bubble's timer;
killing blows remain silent. Original artwork and combat rules are unchanged.

All **195 tests** and the Somnia-standard production build pass. ESLint has zero
errors and 14 pre-existing warnings. A mounted React Strict Mode probe verifies
rotation, cue cleanup, expiry, attribution and death cleanup without a browser.
Source `afe43a3b5ca0d53c8b0a92307ebcb73d73fc5bc8` is **READY** on the protected
[Practice preview](https://delveworn-qrb5s3a0e-crypto-mickle.vercel.app/practice).
See [verification](phase-1-evidence/verification.md). Actual Safari/phone layout
review remains pending because browser execution is policy-blocked.

## Previous checkpoint — first mobile power-use reductions

Following the iPhone 11 Pro heat report, mobile/touch rooms no longer keep
avatar/enemy breathing and relic floating running between actions. Walking,
whole-leg animation and finite combat effects remain. Blur/glow work is reduced,
unchanged sprites are memoized, and loot placement is reused during walking.
The boss-score scheduler wakes half as often while preserving its frozen musical
trace. This reduces known work; actual phone power/temperature is not measured.

See [verification](phase-1-evidence/verification.md) for tests, preview and limits.
The remaining major graphics candidate is the layered avatar's live alpha
filter; no original artwork or image quality was altered in this pass.

Source `d270c8b661399c25d7554e5bae15972d6c5d7e35` is **READY** on the protected
[Practice preview](https://delveworn-23hqsv7qw-crypto-mickle.vercel.app/practice).
All 190 tests and the Somnia-standard build pass. Real iPhone thermal comparison
and Safari profiling remain outstanding.

## Previous checkpoint — mobile room readability

The shared phone presentation now gives more emphasis to the characters:
the avatar and small enemies are larger, with bounded growth for bosses and
preserved tier progression. Compact HUD/report/actions retain player/enemy HP,
gear, damage ranges, potion count and retaliation. Storm stays left, Potion
middle and Attack right. Floor geometry remains stable across room phases;
very short/wide viewports scroll instead of clipping the room or controls.

Persistent mobile Field Notes are replaced by a 44px picture control. Expanded
art fits the complete original painting above scrollable notes. Speech stays
along the lower-right edge rather than over the monster or north doorway.
Desktop presentation and combat rules are preserved. See current validation
and the protected preview in [verification](phase-1-evidence/verification.md).

All 190 tests and the Somnia-standard build pass. Source
`04c77967347b3db559a255b61e8549fd5c882408` is **READY** on protected preview
deployment `dpl_3WRRMHyH2Lziwz5FAbxiWGs8JE4u`:
[Practice preview](https://delveworn-1vgdwn855-crypto-mickle.vercel.app/practice).
Static artwork QA is complete; actual Safari/touch layout still needs phone
review because the browser-policy block remains in effect.

## Previous checkpoint — original-art environments for all sixteen monsters

The room now follows the background in the exact original monster painting,
including its artwork tier. Sixteen new empty environments use each original
as a direct image reference: purple crypts, amber passages, damp green chambers
and red bureaucratic boss offices. The generic family rooms are superseded.
Tier-four backgrounds continue beyond room 40, matching the monster art cadence.

The scene preserves walking, doors, loot, Kevin and combat. Theme selection is
presentation-only and stays stable through the room's phases. Original monster
art is unchanged. Every background and its exact prompt/source reference are
listed in `frontend/public/dungeon/rooms/original/README.md`.

All 188 automated tests and the Somnia-standard build pass. ESLint has zero
errors and 14 existing warnings. Static original/room/open-door images were
reviewed; actual mobile/desktop gameplay QA remains pending due to the existing
browser-policy block.

Source `8f2693bc92788fb9c137d58501d21fef254c3b3b` is **READY** on protected
preview deployment `dpl_CHfezKstXWXHV3J6d8RAh1r9Uiv7`:
[Practice preview](https://delveworn-lp401ogaw-crypto-mickle.vercel.app/practice).
The existing preview approval and protection remain in effect; no production
promotion or contract transaction occurred.

## Previous checkpoint — monster-specific rooms and shared Field Notes

The shared grid now selects a room by monster family: the original zombie crypt,
goblin storeroom, orc armory or boss hall. Three generated background variants
keep the existing room composition and open floor; movement and interaction
coordinates are unchanged. The theme survives defeat and fills the mobile
surround. Original monster paintings remain intact.

Expanded monster artwork includes the same Field Notes as the room, with HP.
Speech uses the exact Field Notes parchment/font/body sizing. Merchant-room
loot reserves the Kevin/wagon area and interaction clearance, including narrow
portrait paths; clicks on loot have priority over merchant targets. The
Executive Overlord mask removes false-wing background wedges and restores
the real central cape.

This update carries forward the room-11 Enter fix, arrow/Enter navigation and
Kevin's final face-wagon, turn and push-to-wall choreography. See
[verification](phase-1-evidence/verification.md) for final validation and preview.

All 187 automated tests and the Somnia-standard production build pass. ESLint
has zero errors and 14 existing warnings. Static room/door and cutout images
were reviewed; no-DOM input/loot/shop probes pass. Actual browser/device QA
remains outstanding because browser execution is blocked by policy.

Source `4c75c174a66a5210645ab545a11cd6a0da1fd65d` is **READY** on protected
preview deployment `dpl_2Kw6yjZusMbpMs5xE2AJ9XyzX5m4`:
[Practice preview](https://delveworn-n9es7bzvt-crypto-mickle.vercel.app/practice).
Uploaded under the user's existing explicit approval, with unchanged Vercel
protection, Somnia standard and session keys disabled. No production promotion
or contract transaction occurred.

## Previous checkpoint — readable dialogue and complete room input

Source `63f5947` includes discreet speech with larger upright text, the missing
Enter fallback from the floor/document to Approach and Enter room, and Kevin's
complete face-wagon/turn/push-to-left-wall sequence. It also includes all prior
keyboard, avatar, monster-art, loot and shared Practice/onchain room changes.

All 180 automated tests and the Somnia-standard production build pass. Full
ESLint has zero errors and 14 existing warnings. Mounted no-DOM checks cover
keyboard defaults, one activation per press, room-11 travel, speech cleanup,
merchant stage order/depth and lifecycle. The 223 browser scenarios are listed
only; the mandatory browser-policy block remains, so actual device QA is pending.

The user explicitly approved the updated protected Vercel preview. Source
`63f5947450c83e4aeedecc43c1956c5b1b9d38a1` is **READY** on deployment
`dpl_7GBVH2drwKDTwP4giRxgMwe5onRj`:
[Practice preview](https://delveworn-5ze1kq0yg-crypto-mickle.vercel.app/practice).
Preview protection remains unchanged; use existing Vercel login if prompted.
See [verification](phase-1-evidence/verification.md) for exact evidence and limits.

## Previous checkpoint — arrows and Enter, merchant entrance

J/K/M shortcuts are removed from the shared room. Arrows and Enter select combat
and healing actions; WASD and E retain movement and interaction. Boss reward
closure and subsequent room/combat transitions transfer focus to the next
enabled default, fixing the reproduced room-10-to-11 Enter dead end.

Kevin now leads the wagon left, parks it, circles to the inward side and turns
both toward the room. Independent depth ordering keeps player crossings correct.
Early trade waits for the complete entrance; pickup and resize preserve it.
Thud's ear contour retains its original outer rim without changing the artwork.
The earlier quiet speech/no-final-remark correction remains included.

All 180 automated tests, mounted input/motion probes and the Somnia-standard
production build pass. ESLint has zero errors and 14 existing warnings. The 220
browser scenarios were discovered only; actual desktop/phone validation remains
outstanding. See [verification](phase-1-evidence/verification.md).

These changes are local. Vercel still serves source `c404944`; automatic approval
review rejected the previous upload and a new explicit approval remains pending.

## Previous checkpoint — compact combat and a more coherent room

Desktop Storm/Attack/Potion controls are compact and sit under the monster card;
mobile keeps one in-room action panel. The original HP/status information stays
available. Kevin stands on the inward side of his turned wagon, with readable
signage, and enters eligible rooms as soon as the enemy is defeated. Trading
before pickup spends held gold and preserves floor loot. Floor-depth ordering
puts the player behind Kevin/wagon when walking behind them, without restarting
Kevin's entrance during crossings or pickup.

Every ten-room tier now increases monster size, with clearly separated zombie
sizes and bounded growth in deep runs. Original monster paintings are retained.
The bottom-right narrator parchment is replaced by short speech bubbles in the
monster's own voice, while its top-right field notes remain. The walking rig
uses an exposed hip/thigh swing and a smaller opposite step in the leg partially
hidden by the preserved cape. Both visible legs move; the idle pose stays still.

Review source `c404944` is READY at
<https://delveworn-nk1pc2eoj-crypto-mickle.vercel.app/practice>, using existing
Vercel login with preview protection intact.

All 178 automated tests and the three local frontend build configurations pass;
ESLint has zero errors and 14 existing warnings. The 220 browser scenarios were
discovered only. See [current verification](phase-1-evidence/verification.md) for
exact evidence, preview and remaining browser/device limitations. This remains a review build
until actual desktop and phone playthroughs pass.

## Previous checkpoint — native floor clicks, doorway crossing and shop controls

Two reproduced input defects are corrected in the shared room. Native DOMPoint
coordinates are read explicitly instead of spread, preserving the y coordinate
for ordinary floor clicks. The cleared door lane has one continuous north bound,
so short held-key steps no longer stick at y=194. The same saved run can resume;
no game-state migration or combat-rule change is needed.

Gold now has three cylindrical stack silhouettes: 1–9, 10–24 and 25+ gold,
using the original Delveworn coin face. Kevin's shop uses the original complete
painting. Arrow focus navigation stays inside an open shop dialog; gameplay
shortcuts remain blocked behind it.
The tier-two goblin is now **Gribnob the Unqualified**, replacing the rejected
Nevin name across Practice, onchain presentation, room art and new log entries.
Original filenames and already saved logs are preserved.

Avatar direction now follows small steps and north/south travel, using a matching
front view alongside the original rear view. Separately articulated lower legs
alternate while moving; idle and reduced-motion poses stay still. The room and
camera do not bounce. Parchment notes use the self-hosted IM Fell English font
through the existing Next font pipeline, with readable serif fallbacks.

Review source `1b43ad0` is deployed and READY at
<https://delveworn-kkra9n4e8-crypto-mickle.vercel.app/practice>.
Use existing Vercel login: automatic approval review rejected creating a
no-login share token, and protection was not bypassed. All 171 automated tests
and the three local frontend build configurations pass; ESLint has no errors
and 14 existing warnings. The 220 browser scenarios were discovered only.
Browser/device QA remains blocked by the earlier administration-policy failure;
this is a review preview, not production-approved.

## Previous checkpoint — complete figures, room loot and a moving merchant

All sixteen monster silhouettes are reviewed against the unchanged original
paintings. Clipping now follows the subjects rather than interior seams;
room heights still follow the existing tier progression. A reproducible
static contact sheet records the enlarged and room-size cutouts.

Gold uses modest coin piles with exact reward labels. Quartermaster Kevin
keeps his wagon and readable no-refunds sign, enters from the north doorway,
and walks to a fixed upper-left shop position at every supply/camp stop.
He faces inward after arrival; reduced motion skips the walk. The existing
shop, inventory values, prices and callbacks remain authoritative.

Click/tap on empty floor now works during combat as well as exploration,
loot and recovery. Retargeting keeps the current position. Walking consumes
no game turn or randomness; pending actions and finished runs remain guarded.

## Previous checkpoint — desktop input and room atmosphere

Hold WASD for continuous movement from the page or any game control, including
immediately after a new room mounts. Movement no longer waits for OS key repeat
or requires clicking the SVG floor. Walking into enemy range approaches it.
Arrows navigate action buttons; Enter activates. K/J/M invoke the original
Attack/Storm/Potion callbacks once per physical press, with safe M healing
before and after loot pickup. Active Practice and onchain rooms now provide
the missing input scope and navigation component.

Existing monster descriptions and log remarks appear on parchment inside the
room, above/right and below/right. Read-only sheets do not intercept walking
or change camera geometry. The cosmetic armor ring is removed. The tier-two
goblin is now Nevin the Unqualified; its original painting and scale remain,
with the long ears restored in the clipping mask. Quartermaster Kevin keeps
his name and existing shop behavior.

## Previous checkpoint — restore the original top status bar and clear recovery actions

The grid now reuses the actual original `GameHud` in Practice, `/play` and
onchain. HP, potion stock, gold, equipment and room stay above the room in loot
and recovery, with the original mobile Gear details. Relics has a separate
header button and cannot replace the stock display. The lower Potion control
uses the original green recovery-button style and remains available before
and after collection; Enter room is orange and still walks to the doorway.
The mobile header reserves a constant height for the restored status bar so
HP updates and normal phase changes do not resize the room on every action.
Gameplay, pickup, bypass, combat controls and the removed drone remain intact.

## Previous checkpoint — swap Potion and Relics; remove the sustained room tone

Between rooms, Potion now occupies the former Relics control below the report
on mobile and in the recovery sidebar on desktop. Relics opens from the former
potion slot in the top inventory/HUD during recovery. Safe potion use before
and after loot collection is preserved, as are the existing relic availability
rules and combat controls. `/play` uses the same lower potion position while
retaining its existing final boss relic decision.

The two sustained exploration tones (82.4/123.5 Hz) and their unused audio API
are removed. Short action/character/outcome effects and the boss score remain.

## Previous checkpoint — safe potions before and after collecting loot

The inventory potion counter is now the between-room healing control on both
mobile and desktop. After a kill, tapping **Potion +25 HP** invokes the original
potion action, even while loot remains on the floor. Healing consumes one potion
without retaliation, a combat turn or a local random draw, and preserves held
loot and the door-bypass choice. Full HP, empty stock and pending actions block
use. Boss loot can be followed by safe healing; the separate relic reward modal
still requires its choice before further recovery actions. Combat controls keep
their established positions, and no extra floor button is introduced.

## Previous checkpoint — direct door bypass and removal of the extra Potion control

The user clarified that bypass means **tapping the actual doorway instead of the
loot in the grid**. The earlier separate Leave loot button failed that intent:
door taps still rerouted to the drop. Door taps now keep their destination and
never collect along the door path. Only arrival commits the existing room entry
and discards local pending loot; cancellation and failed entry preserve it.
Bosses still require the existing relic choice. The loot-phase pickup/bypass
buttons are removed. Tapping loot and proximity pickup continue to work.

The extra between-room Potion control is removed from the grid. Safe healing is
available in Menu (desktop `/play`: Supplies); the established combat Potion
control is unchanged. This is a preview pending native phone/browser checks.
See `ENDLESS_GRID.md` and the verification record for behavior and evidence.

## Previous checkpoint — optional loot and a shared endless room

The walking grid now serves active Practice and onchain runs through a shared
presentation component. Practice's existing engine and onchain's confirmed
snapshots remain authoritative. Their endless progression, every-tenth-room
bosses, shops, relics and starting kit are preserved. All four original monster
artwork sets appear at their existing tiers; the final set continues after room
40 while the original difficulty progression continues.

**Leave loot** is available in `/play` and the shared room. Local pickup grants
the held reward once; leaving it forfeits that reward without a turn or RNG draw.
Boss relic decisions remain separate. Onchain rewards are already credited by
the contract, so either floor choice only clears the presentation and cannot
change those balances or submit a transaction. The UI explains this difference.

Monster close-ups now last the same two seconds after image load, including
while attacking or defeating the monster. Only explicit **Close artwork** cuts
the automatic display short. Kevin's shop shows his complete original clipped
figure and current HP, gold, potions, weapon and armor inside the panel; player
values stay visible while scrolling the purchase choices.

Practice saves game and optional grid metadata atomically in the existing save
envelope. Older saves resume their prior credited balances and combat phase.
Onchain presentation is isolated by wallet/player/run identity. No contract or
VRF configuration was changed; Somnia's adapter mismatch remains unresolved.

See `ENDLESS_GRID.md` for behavior and the phone checklist, and
`docs/phase-1-evidence/verification.md` for exact checks and preview delivery.
This is a review preview pending actual browser/phone and live Somnia checks.

## Previous checkpoint — physical doors, Kevin and detailed monster reveals

The user's latest direction keeps travel visible: **Enter room** now uses the
resilient walk and commits entry only at the doorway. Kevin appears as a person
in recovery rooms 5 and 9, clipped from the original merchant illustration;
clicking him walks beside him before opening trade. He uses the outer left
visible floor bound in room 5 and outer right bound in room 9, mirrors to face
inward, and is approached from inside the room. The potion/camp placeholder
has been removed from the grid.

Combat starts with a short large view of the original monster artwork over only
the floor. It lasts two seconds after image load and can close immediately via
its button or a combat action. A small **View monster** button reopens it. The
reveals never hold the game lock or cover HP/actions, and do not enlarge tier-1
room sprites or animate the room camera. Original rules and save format remain.

Preview and exact checks are in `docs/phase-1-evidence/verification.md`.

## Previous checkpoint — stable room, continuous walking and automatic floor loot

**Current phone stability correction:** the earlier direct-exit change did not
cover free movement. The movement clock now starts at input time and races each
animation frame with a timer fallback, using one monotonic timestamp. Rapid
retargeting makes progress; missing/constant-timestamp animation callbacks do not
strand Approach or pickup. Invalid SVG coordinates are rejected. Viewport changes
continue the same walking intent to its new reachable destination. Hidden/blurred
pages still cancel walks, and the next gesture can restart them.

The save gate no longer queues behind another tab's held lock: it returns a
visible retry state without applying the action. True save conflicts show
recovery controls, including mobile reward panels. Original rules, art, loot
pickup, camera tracks and chain boundaries remain unchanged.

The approved Browser still cannot complete its required admin-policy check;
actual phone confirmation remains open. Current automated evidence and preview
are recorded in `docs/phase-1-evidence/verification.md`.

### Previous checkpoint — Practice controls inside the mobile room

Latest phone-review correction: use the actual shared `CombatActionDock` instead
of the custom three-button imitation. Monster HP is a dedicated current/max +
bar status in the room. Attack is right; Potion is below or middle on short
screens. Player HP, TOOK/DEALT and potion limits/reasons are readable at the point
of action. Local Practice source was audited; live production Browser access was
blocked by its mandatory policy check. See verification for exact evidence.

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
- The mobile room panel now fills the available viewport (`100dvh`, safe-area
  padding). Room/progress/inventory/menu sit in the top grid row; HP/actions and
  short feedback in the bottom row. The room camera takes the remaining space.
  Original art is not stretched; taller rooms do not enlarge tier-1 actors.
  Walking is clamped to the visible camera. Menu, shop, rewards and results use
  in-room panels. Desktop retains its existing layout.
- Nine static React/SVG illustrations cover four enemies and five loot views.
  These are illustration exports, not browser screenshots or responsive QA.

### Milestone F — verification and preview

- Earlier restored-core checkpoint: **102 tests passed, 0 failed**. TypeScript passed. ESLint: **0 errors,
  14 pre-existing warnings**. Alpha-channel and loot routing checks pass.
- All three existing CI build configurations passed at the restored-core
  checkpoint; Somnia standard passed again after the fullscreen mobile layout. Development-only
  `/concept` remains a production 404. Current evidence is in
  `phase-1-evidence/verification.md`.
  Earlier fullscreen preview: source `ec3c502`, deployment
  `dpl_6CaykjEikF8rTW2njLEcNb5iDyMa`, READY. `/play` returned HTTP 200 with the
  expected title; room, monster and potion assets also returned HTTP 200.
  Its seven-day access token is delivered only in the conversation. Earlier
  `861687c`, `a542b55` and `4ebf5cb` previews are superseded.
- Browser suite discovery: **159 tests in 10 files**, including 24 First
  Descent device cases and a dedicated iPhone 11 Pro profile. Discovery is not execution.
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
