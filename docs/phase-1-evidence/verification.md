# First Descent verification — 2026-09-16

## Current correction — intact artwork, free floor movement and Kevin's entrance

### Behavior

- All 16 monsters retain their original WebP paintings and tier heights. Each
  figure has a subject-specific SVG contour. Independent contours now combine
  as a union, so opposite winding cannot cut holes through overlapping limbs.
  Crops include the preserved ears, hands, feet, weapons and cloth. Nevin remains
  the tier-two goblin; Quartermaster Kevin remains the merchant.
- Gold drops use a small pile of the original coin painting, increasing modestly
  with the amount. The label reports the exact reward; pickup and reward rules
  are unchanged.
- Kevin and his original wagon enter from the north doorway and settle at the
  upper-left visible floor edge at every merchant stop. Kevin then faces inward;
  the wagon and no-refunds sign are never mirrored. The shop portrait includes
  the full merchant and wagon, with the existing sticky inventory information.
- Trading waits for both Kevin and the player to arrive. Retargeting to floor,
  door or WASD cancels queued trade, as do pending actions, phase and focus loss.
  Walking away from Kevin does not immediately trigger his proximity interaction.
  Reduced motion skips his entrance; mobile camera resizing retargets the walk.
- Clicking/tapping empty floor moves the avatar there during exploration, combat,
  loot and recovery. A new click retargets the walk. Moving neither consumes a
  combat turn nor changes HP, rewards or RNG. Pending actions and dead/finished
  runs still reject movement. Merchant interaction uses the painted figure/cart,
  so the empty area around the wagon stays walkable.

### Actual checks

- **165 automated tests passed, 0 failed, 0 skipped.** Includes the new two-arrival
  merchant gate regression, plus existing movement, loot bypass, deterministic
  replay, safe-healing, input and state regressions.
- ESLint: **0 errors, 14 existing warnings**. Whitespace checks pass.
- All three existing frontend CI build configurations passed locally on the
  final application source: RISE compatibility, Somnia session keys and Somnia
  standard. Each completed compilation and TypeScript validation. No remote
  GitHub CI run was triggered.
- **205 browser scenarios in 10 files discovered, not executed.** Added the
  empty-floor exploration/combat check and revised Kevin's arrival/position and
  walking-away checks.
- Mounted no-DOM probes exercised actual scene callbacks for empty-floor
  movement/retargeting during combat, no game-action callback on empty floor,
  pending/dead guards, continuous WASD, modal/focus guards and room entry.
- Mounted merchant probes passed door entry, intermediate position, resize
  continuity, final inward facing, reduced motion and cleanup. Actual scene
  integration passed waiting for both walkers, exactly one trade, and cancellation
  by floor, walking away, pending state and doorway. Empty floor near Kevin does
  not open trade.
- The existing Practice callback probe passed original HUD/Gear/Relics values,
  potion before/after loot, no extra RNG, pending-loot preservation, stale/full-HP/
  empty-stock guards, door bypass and legacy save restoration. The K/J/M and
  arrow/Enter callback probe also passes.
- [Static artwork review](monster-cutout-review.png): all sixteen masks were
  rendered from the actual EnemySprite component, enlarged and at mobile room
  scale, and inspected against the originals. Kevin's final room composition was
  also rendered at wide and portrait dimensions. These are SVG illustrations,
  **not browser screenshots** and not evidence of responsive app layout.

Browser/device QA remains blocked by the administration-policy decision from
previous automatic approval review; no browser retry or alternate browser was
used. The build remains a **review preview, not production-approved**. No Git
push/merge, production release, contract change or onchain transaction occurred.
The unresolved Somnia VRF adapter setup remains outside this verification.

### Files in this correction

- `frontend/app/dungeon/scene.tsx`, `tier-art.ts`, `gold-loot-art.tsx`,
  `merchant-art.tsx`, `merchant-room.tsx`, `shop-vitals.tsx`, `shop-vitals.css`.
- `frontend/tests/dungeon-scene.test.ts`, `tier-art.test.ts`,
  `e2e/descent.spec.ts`; `frontend/scripts/render-dungeon-art.tsx`.
- `ENDLESS_GRID.md`, `docs/phase-1-status.md`, this verification record and
  `docs/phase-1-evidence/monster-cutout-review.png`.

First external test: open the Practice preview without a wallet on desktop and
phone. Click empty floor before and during combat, retarget, then use held WASD
and K/J/M on desktop. Compare coin piles, bypass one drop through the doorway,
and collect the next. At room 5, click Kevin early and confirm trade waits for
both walkers; walk away afterward. Confirm the same upper-left stop at room 9,
then continue through tier two and compare the original character details.

## Previous correction — continuous desktop movement, button navigation and room notes

### Correction

WASD now steers continuously on animation frames, beginning with the first
keydown and ending on release. It supports diagonals at the same speed,
direction changes and walking into enemy approach range. The page listens
without requiring a click/focus on the SVG floor, including after room entry.
Active Practice and onchain returns now include the missing main input scope
and DesktopNavigation. Arrows select room/combat buttons; Enter activates them.
K/J/M use the existing Attack/Storm/Potion callbacks once per physical press.
M also heals while loot is pending and after collection; E walks to the enemy
or to the cleared room's door. Input fields, modifiers, dialogs, wallet controls,
pending actions, visibility/focus loss and unmount stop or exclude game input.

Small parchment notes inside the room reuse the current monster description
and latest log remarks; combat/reward punchlines can appear without repeating
their numeric prefix. They are pointer-transparent, use fixed overlay bounds
and sit below the original timed close-up artwork. On phones the notes are
compact and the full log remains available. The decorative armor ring is removed.

The tier-two goblin is Nevin the Unqualified across displayed personas and new
log entries. Quartermaster Kevin is unchanged. The original goblin bitmap,
asset path, crop and actor scale are preserved; the SVG clip includes both ears.
Previously stored log entries are not rewritten.

### Actual checks

- **164 automated tests passed, 0 failed, 0 skipped.** Added coverage includes
  held movement without key repeat, immediate direction changes, normalized
  diagonals, cancellation, delayed/missing animation frames, arrival and
  shortcut selection; existing state, loot, safe-healing and replay tests pass.
- TypeScript passed; ESLint **0 errors, 14 existing warnings**; whitespace
  checks passed. **201 browser scenarios in 10 files** were discovered, not run.
- All three existing frontend CI build configurations passed locally on the
  final application changes: RISE compatibility, Somnia standard and Somnia
  session keys. No remote GitHub CI run was triggered.
- No-DOM mounted-component probes exercised actual scene listeners and frames:
  body/button focus, held movement, release, diagonal travel, automatic approach,
  fresh-room movement, blur/modal/input/external exclusions, E door and cleanup.
  A separate actual DesktopNavigation probe verified K/J/M, repeat suppression,
  SVG arrow selection, Enter, disabled potion, pending overlays and focus.
- The actual Practice-page callback probe still passes original HUD values,
  Gear/Relics, safe potion before/after loot, no extra RNG, pending-loot retention,
  full HP, stale callbacks, empty stock, door bypass and legacy save restoration.
- The corrected ear mask was rendered with Sharp and visually inspected against
  the original illustration. This is an SVG art check, not a browser screenshot.
- Browser/device QA remains blocked by the administration policy previously
  reported by automatic approval review. No browser retry or workaround was
  attempted. Real desktop/mobile input and parchment layout need preview testing.
- No production release, Git push/merge or live onchain transaction. Somnia's
  unresolved adapter setup is not validated by these presentation/input checks.

Desktop check: open Practice, start, hold WASD without clicking the floor,
release and change direction. Use arrows to select Approach and Enter to walk
there; try K/J/M in combat, M before/after loot and E to bypass a drop. Start
moving in the next room without clicking the grid. Check parchment readability
and Nevin's ears in tier two; the merchant should remain Quartermaster Kevin.

**Review preview; native gameplay and layout checks remain required for production.**

## Previous correction — restore the original status bar and recovery buttons

### Previous phone preview

- Source `fc1aaf81878393fe36c2dc3ba1a77aa92298d31e`; Vercel deployment
  `dpl_A4rXj3qWCUMxt4RRGrnxamYpfjzY`: **READY**, preview target.
- <https://delveworn-amn288ssn-crypto-mickle.vercel.app/practice>
  (the deployment-specific seven-day phone access link is delivered in the
  conversation; its token is not committed).
- `/practice`, `/play` and `/onchain` returned **HTTP 200** with expected titles.
  Kevin, tier-4 Meatwall and transparent potion artwork returned **HTTP 200**,
  `image/webp`. These are delivery checks only.
- Exported tracked frontend files only; Somnia standard with session keys
  disabled. No production release, remote Git push/merge, domain/configuration
  change, account creation or live contract transaction.

### Correction

Practice, First Descent and the shared onchain room reuse the actual original
`GameHud`: HP/health bar, potion stock, gold, equipment and room above the grid
through combat, pending loot and recovery. Mobile Gear opens the original
equipment details. Relics has a separate header button during recovery.

The lower safe Potion control uses the original green recovery styling and
works both before and after loot collection. Enter room uses the original
orange styling and retains walking to the door before entry. A direct door tap
still bypasses loot. Existing safe-healing authority, combat controls, merchant
and boss relic behavior are unchanged. The sustained room tone remains removed.
Mobile room tracks reserve constant space for the restored HUD across phases.

### Actual checks

- **156 automated tests passed, 0 failed, 0 skipped.** Safe healing, pending
  loot, pickup, bypass, full HP, empty stock and stale actions remain covered.
- TypeScript passed; ESLint **0 errors, 14 existing warnings**; whitespace
  checks passed. Browser discovery: **189 scenarios in 10 files**, not executed.
- All three existing frontend CI build configurations passed locally: RISE
  compatibility, Somnia standard and Somnia session keys. Remote GitHub CI was
  not triggered for these unpublished commits.
- A no-DOM harness exercised the actual Practice page and original HUD:
  current HP, stock, gold and equipment before/after pickup; mobile Gear and
  Relics dialog callbacks; healing before/after pickup; full HP, empty stock,
  stale callbacks and legacy combat restore. Healing preserves held loot and
  room turns without randomness or retaliation; subsequent door bypass works.
- Browser regressions now target the original HUD, Gear dialog, separate
  Relics button and lower safe Potion control. They were statically checked
  and discovered, not run in a browser.
- Browser access remains blocked by the previously reported administration
  policy/automatic approval review. No browser retry or alternative browser
  workaround was attempted. Actual mobile/desktop rendering remains unverified.
- No live onchain transaction was sent; these changes do not validate the
  unresolved Somnia adapter setup.

Phone check: defeat a monster below full HP, leave loot on the floor, then use
the green **POTION** button. Confirm the top HP/stock update and loot remains.
Collect the drop and repeat healing. Check **Gear**, **Relics**, and the orange
**Enter room** button; direct door taps should still skip unwanted loot.

**Review preview; native gameplay checks remain required for production.**

## Previous correction — swap Potion and Relics; remove the exploration drone

### Previous phone preview

- Source `eec95c6e4099a9b564e56e9f7b95c2d25380b357`; Vercel deployment
  `dpl_Dt9DT2h4iaBsfSS3odPAkMJoMvcT`: **READY**, preview target.
- <https://delveworn-o0vsgcqdk-crypto-mickle.vercel.app/practice>
  (the deployment-specific seven-day phone access link is delivered in the
  conversation; its token is not committed).
- `/practice`, `/play` and `/onchain` returned **HTTP 200** with expected titles.
  Kevin, tier-4 Meatwall and transparent potion artwork returned **HTTP 200**,
  `image/webp`. These are delivery checks only.
- Exported tracked frontend files only; Somnia standard with session keys
  disabled. No production release, remote Git push/merge, domain/configuration
  change, account creation or live contract transaction.

### Correction

Between rooms, Potion moves into the former Relics position: below the report
on mobile, in the recovery sidebar on desktop. Relics opens from the top
inventory/HUD slot during recovery. Existing safe healing remains available
with loot pending and after collection. Combat controls, relic availability,
loot pickup and doorway bypass are unchanged. `/play` uses the lower potion
position and retains its existing final boss relic decision.

The sustained 82.4/123.5 Hz exploration tones are removed, along with the unused
exploration audio option/effect. Short action, character and outcome sounds,
boss music, mute and explicit resume retain their existing behavior.

### Actual checks

- **156 automated tests passed, 0 failed, 0 skipped.** Updated audio coverage
  asserts that ordinary cues have scheduled endings, resume creates no drone,
  and mute/re-enable introduces no sustained sources or ordinary-room timers.
- TypeScript passed; ESLint **0 errors, 14 existing warnings**; whitespace
  checks passed. Browser discovery: **189 scenarios in 10 files**, not executed.
- All three existing frontend CI build configurations passed locally: RISE
  compatibility, Somnia standard and Somnia session keys. Remote GitHub CI was
  not triggered for these unpublished commits.
- Actual Practice page callbacks in a no-DOM component harness confirm one
  safe potion control in each responsive footer/sidebar presentation, no
  healing action in the top inventory, and Relics at the top during recovery.
  The relic panel opens/closes. Healing before/after collection, full HP,
  stale callbacks, empty stock, save restore and doorway bypass still pass.
- Browser access remains blocked by the previously reported administration
  policy. No browser retry or alternate browser workaround was attempted.
  Actual mobile/desktop rendering and listening tests remain unverified.

Phone check: after collecting loot, use **Relics** in the top row and
**Potion +25 HP** below the room report. Repeat potion use with loot still
pending. With sound enabled, ordinary rooms should have only short cues;
there should be no continuous low tone. Boss music should still play.

**Review preview; native gameplay checks remain required for production.**

## Previous correction — safe healing from the existing potion inventory

### Previous phone preview

- Source `741ad2c3bbcfe9981ae4b9c7e31a6f6f7569834a`; Vercel deployment
  `dpl_H9oHD3bu5SC6aFaTPi5k7EnS5Q7X`: **READY**, preview target.
- <https://delveworn-cq73d8z5q-crypto-mickle.vercel.app/practice>
  (the deployment-specific seven-day access link is delivered in the
  conversation; its token is not committed).
- `/practice`, `/play` and `/onchain` returned **HTTP 200** with expected titles.
  Kevin, tier-4 Meatwall and transparent potion artwork returned **HTTP 200**,
  `image/webp`. These are delivery checks, not browser gameplay verification.
- Exported tracked frontend files only; Somnia standard, session keys disabled.
  No production release, remote Git push/merge, domain/configuration change,
  account creation or live contract transaction.

### Correction

The previous preview hid recovery healing in Menu and blocked it entirely while
loot was pending. The existing potion inventory slot now becomes **Potion +25
HP** after a kill, on both desktop and mobile. Tapping it invokes the original
potion action during loot or recovery, with no extra floor button. Healing keeps
pending loot, pickup and doorway bypass intact. Boss floor loot allows healing;
the separate relic reward choice still precedes further recovery actions.

### Actual checks

- **156 automated tests passed, 0 failed, 0 skipped.** Coverage includes safe
  healing with pending loot, collection/bypass balances, save restore, HP caps,
  empty inventory, stale actions, boss loot and onchain presentation guards.
- TypeScript passed. ESLint: **0 errors, 14 existing warnings**. Whitespace
  checks passed. Browser discovery lists **189 scenarios in 10 files**, including
  new inventory-healing regressions; these browser scenarios were not executed.
- All three existing CI build configurations passed locally: RISE compatibility,
  Somnia standard and Somnia session keys. The initial sandboxed build stalled
  and was terminated; the matrix passed on retry with the required local process
  permissions. Remote GitHub CI was not triggered for these unpublished commits.
- Actual Practice page callbacks in a no-DOM component harness: start, approach,
  defeat enemy, tap inventory potion with loot pending, check capped HP increase
  and one potion consumed, then bypass through the door. Pending loot and room
  turns stay identical through healing; no random call or retaliation occurs.
  Full-HP and stale callbacks cannot consume another potion. Reload/collect/
  recovery-heal and empty inventory also pass, as does legacy combat restore.
- No live onchain transaction was sent. Somnia healing uses the existing
  transaction and confirmed-snapshot path; its credited loot is preserved.
- The approved Browser was rejected by automatic approval review because of
  the existing administration policy. No alternate browser was used. Actual
  desktop/mobile rendering and live Somnia remain unverified.

Phone check: defeat an enemy while below full HP, leave loot on the floor, and
tap the potion count in the inventory row. Confirm HP rises by up to 25, stock
falls by one and loot remains. Then tap the door to bypass it. Repeat healing
after collecting a later drop. Full HP or no potions should disable the control.

**Review preview; native gameplay checks are still required for production.**

## Previous correction — tap the doorway to bypass loot

### Previous phone preview

- Source `4cd97612ca08b68cfd14e5dfacd0415b75d8ed60`; Vercel deployment
  `dpl_5ihowAG5JyEYudGYXS3uD4F75gPc`: **READY**, preview target.
- <https://delveworn-j43trlqmp-crypto-mickle.vercel.app/practice>
  (the deployment-specific seven-day access link is delivered in the
  conversation; its token is not committed).
- `/practice`, `/play` and `/onchain` returned **HTTP 200** with expected
  Delveworn titles. Kevin, tier-4 Meatwall and the transparent potion artwork
  returned **HTTP 200**, `image/webp`. These are delivery checks only.
- Exported tracked frontend files only; Somnia standard configuration with
  session keys disabled. No production release, remote Git push/merge,
  account creation, domain/configuration change or contract transaction.

### Correction

The previous correction did not meet the user's intended interaction: it added
a Leave loot button, but the actual doorway still redirected the player to loot.
This correction changes that routing. A direct doorway tap walks to the door,
never collects on that path, and enters only on arrival. A direct loot tap still
walks there and automatically collects once. There are no loot-phase pickup or
bypass buttons. The normal recovery-room entry shortcut is retained.

Local discard plus entry is one state/save transition. A failed encounter roll
preserves pending loot, and retargeting/canceling the walk cannot discard it.
Boss floor loot still yields to the original relic decision. Onchain door entry
uses the existing room-entry transaction; its already-credited rewards remain
unchanged, and failed/unconfirmed entry retains the local loot display.

The extra between-room Potion button was removed from the mobile footer and
desktop grid. Safe healing is available in Menu (desktop `/play`: Supplies);
the established combat Potion control and its position are unchanged.

### Actual checks

- **149 tests passed, 0 failed, 0 skipped.** New coverage includes direct-door
  hit testing, atomic local discard/entry, failed entry, repeated/stale arrivals,
  onchain confirmation/retry presentation and required boss relic choice.
- TypeScript passed; ESLint **0 errors, 14 existing warnings**; whitespace checks
  passed. The previous 100-run save/restore flow test remains green.
- Browser test discovery passed: **178 scenarios in 10 files**. Updated door,
  loot and recovery-healing scenarios were listed, not executed in a browser.
- All three local frontend CI build configurations passed: RISE compatibility,
  Somnia standard and Somnia session keys. This is local validation, not remote
  GitHub CI on unpublished changes. Contracts and VRF setup were not exercised.
- Actual no-DOM scene callbacks: start `[400,391]`, loot `[423,287]`, door
  `[450,92]`. The door walk crosses the loot path, collects **zero**, and calls
  `enter(true)` **once on arrival**. Retargeting to `[450,435]` keeps loot and
  calls neither entry nor collection. Direct loot navigation collects once.
  Stale callbacks cannot duplicate either action; app movement timers, frames
  and listeners are cleared on unmount.
- The actual Practice page's callbacks complete start → approach → two attacks
  → loot → door arrival → next encounter. The next saved game has **zero gold**
  from the uncollected reward and no pending loot; a legacy midfight save still
  resumes combat. This exercises the page wiring in a no-DOM component harness.
- Actual shared-room component callbacks confirm no recovery Potion button in
  the floor, functioning safe healing inside Menu, and one supplied combat
  Potion control. This is component testing, not responsive-render evidence.
- The approved Browser was retried on 2026-09-16. Its mandatory admin-policy
  check still denied access; no alternate browser bypass was used. Native
  phone/desktop interaction remains unverified, as does live Somnia/VRF.

Changed files: scene and shared-room presentation; Descent model/game/styles;
Practice and onchain presentation adapters; associated unit and browser
specifications; gameplay documentation. No original artwork, combat engine,
contract, deployment configuration or production domain was changed.

Phone check: defeat a monster and tap the actual north doorway while loot is
still present. Confirm walking, unchanged reward balance locally, and next-room
entry. Repeat with a direct loot tap, then test canceling a doorway walk.
Confirm the separate recovery Potion button is gone from the grid.

**Review preview; not production-ready without native gameplay checks.**

## Previous correction — optional loot, endless shared grid and readable Kevin shop

### Previous phone preview

- Source `b258bc2f06675c68f51ff3a3a51a72c48e8e9d0d`; Vercel deployment
  `dpl_DakWn5rJzNipw8t2DH68kQhh2att`: **READY**, preview target.
- <https://delveworn-nqcr0qc2s-crypto-mickle.vercel.app/practice>
  (the deployment-specific seven-day phone access link is delivered in the
  conversation; its token is not committed).
- `/practice`, `/play` and `/onchain` each returned **HTTP 200** with their
  expected Delveworn titles; onchain identifies Somnia. Kevin, tier-4 Meatwall
  and the transparent potion assets returned **HTTP 200**, `image/webp`.
- Exported tracked frontend files only; Somnia standard configuration, session
  keys disabled. No production release, domain/configuration change, remote Git
  push/merge, account creation or contract transaction. These HTTP checks verify
  delivery only; browser/phone gameplay remains the review gate below.

Active Practice and onchain runs reuse `EndlessRoom`, `DungeonScene` and the
existing action/shop/relic controls. They retain their existing progression and
authorities. All four original artwork tiers are presented without changing the
source raster assets; rooms continue beyond 40. `/play` retains its ten rooms.

Local **Leave loot** forfeits held floor resources. Onchain floor choices only
acknowledge rewards already credited by the contract. Neither movement nor
pickup/skip consumes combat RNG or submits a contract transaction. Boss relic
decisions still use their existing independent flow.

Kevin's shop includes his complete figure and current HP, gold, potions, weapon
and armor. Monster artwork persists for exactly two seconds after image load
even during normal or lethal attacks, unless explicitly closed.

### Actual verification

- **143 unit/integration tests passed, 0 failed, 0 skipped.** Coverage includes
  optional loot, once-only/stale choices, reload, boss relic separation, original
  Practice/Weekly traces, legacy Practice saves, wallet-scoped presentation,
  confirmed onchain reward acknowledgement, and all artwork tiers. Practice
  progression is exercised through rooms 1, 11, 21, 31, 41 and into 42 with a
  healed fixture (a progression check, not a balance or human-survival claim).
- An additional 100 seeded Practice flow simulations use normal HP, both loot
  choices and a fixed healing/shop policy: **6,046 combat actions, 881 pickups,
  293 skips and 10,999 valid save/restore checks**. All eventually end in a valid
  death; the deepest clears room 27. This verifies transition/persistence safety,
  not human balance or a promise of achievable depth.
- ESLint: **0 errors, 14 existing warnings**. Git whitespace validation passed.
- TypeScript passed. All three existing frontend CI build configurations passed
  on the final implementation: **RISE compatibility, Somnia standard, Somnia
  session keys**. `/practice`, `/onchain` and `/play` were generated; development
  `/concept` retains its production 404. These are local matrix checks, not a
  remote GitHub CI run on the unpublished commit.
- Actual no-DOM Practice page callbacks complete start → approach → kill → leave
  loot → next room; a legacy living encounter restores directly into combat.
- Actual monster component with a controlled clock remains visible at 1,999ms
  and closes at 2,000ms for both a normal and killing attack. Pending at 450ms
  and resolution at 800ms preserve the original deadline. No timer survives
  unmount.
- Actual scene callbacks: **Leave loot** during a pickup walk cancels movement,
  acknowledges once and never collects, including when a stale canceled frame
  is delivered. No app frames or timers remain.
- Actual shared-room callbacks: Kevin's shop opens only after arrival; the
  complete merchant figure and all five supply values are present. Updating
  parent values after a purchase updates the open shop. Closing/unmounting
  leaves no app timers or frames.
- Browser suite discovery: **178 cases in 10 files**, including updated Practice
  navigation and optional-loot cases. Discovery is not browser execution.
- The twelve higher-tier silhouettes were inspected as static SVG exports,
  including at their intended room heights. They use the original raster files
  with hand-traced clip paths. This checks illustration composition, not native
  browser compositing or mobile performance.

The approved Browser was retried; its mandatory admin-policy check still blocks
access. No alternate browser bypass was used. The component probes are not
browser screenshots or evidence of native touch/responsive rendering. Actual
phone/desktop play and live Somnia remain unverified. The previously reported
VRF adapter mismatch is unresolved; no wallet/contract transaction was attempted.

Changed files include `app/dungeon/{scene.tsx,endless-room.*,shop-vitals.*,tier-art.ts}`,
`app/descent/{game.tsx,model.ts,monster-reveal.tsx}`,
`app/practice/{page.tsx,grid-state.ts,storage.ts,practice.test.ts}`,
`app/{onchain-game.tsx,onchain-presentation.ts,wallet-view-guard.ts}`,
relevant unit/browser specifications and the three gameplay/evidence documents.

Status: **review preview, not production-ready**. First phone check: use
`/practice`, attack during the artwork, try both floor-loot choices, visit Kevin
after room 5 and verify shop stats, then finish the boss and enter room 11.
See `ENDLESS_GRID.md` for the detailed checklist and authority boundary.

## Previous correction — visible door travel, inward-facing Kevin and original monster close-ups

**Enter room** now uses the resilient movement clock and commits entry only
after reaching the doorway. Retargeting cancels the old arrival; fallback timers
still complete the walk when animation callbacks are absent. Loot collection
continues to gate entry.

Kevin is a clipped figure from the existing merchant illustration in recovery
rooms 5 and 9. Room 5 uses the outer left visible floor bound; room 9 uses the
outer right bound. His painting mirrors on the left so he always faces inward.
The trade approach is 48 room units inward and 36 down, keeping the player inside
the room. Clicking his figure or **Visit Kevin** walks there before opening the
mobile shop or focusing the existing desktop shop. Resize retargets that same
merchant intent using the new visible bounds. No original asset file was edited.

Fresh combat shows the original detailed monster artwork over the room floor.
It closes two seconds after image load/error, immediately on combat input, or
with **Continue fight**. **View monster** reopens a view that stays until closed
or the next action. The view owns no gameplay lock, covers no HP/action controls,
and changes neither room size nor tier-1 floor sprite scale. Mid-fight reload
starts collapsed. Original Practice rules, combat RNG, loot, saves and Somnia
boundaries are unchanged.

### Actual verification

- **130 unit/integration tests passed, 0 failed.** Coverage includes both Kevin
  edges and inward approaches across desktop/portrait bounds, original art and
  mirroring, loot gating, monster reveal state, image-load timer, manual reopening
  and immediate combat-action dismissal. Existing Practice/Weekly traces pass.
- TypeScript and the Somnia standard production build passed. Full ESLint:
  **0 errors, 14 pre-existing warnings**.
- Actual no-DOM React callbacks: clicking **Enter room** keeps recovery revision
  5 while walking, then reaches explore revision 6 once through fallback timers.
  Canceling and retargeting leaves recovery revision 5; stale callbacks cannot
  enter. A complete ten-room run with no delivered animation frames still won
  in **51 combat turns**, leaving zero movement handles.
- Fresh source component probes at a 320×440 floor: room 5 Kevin was at
  `(326.18,320)`, the avatar arrived at `(374.18,356)`; room 9 Kevin was at
  `(573.82,320)`, the avatar arrived at `(525.82,356)`. Kevin faced right/left,
  the avatar faced left/right toward him. Each opened trade once with no saved
  progression change; zero app timers, frames or listeners remained on unmount.
- Browser suite discovery: **175 cases**, including **40 Descent device cases**.
  New scenarios cover walking before entry, cancellation, and reaching Kevin
  on both sides before trade opens. These scenarios remain **unexecuted**.

Static React/SVG exports of Kevin on both sides were visually inspected: the
original clipped figure fits the floor, faces inward and retains an unmirrored
label. These are illustration checks, not browser screenshots. The approved
Browser was retried and remains blocked by its required admin-policy check;
actual browser/phone interaction is still unverified. No alternate browser was
used to bypass the restriction.

Changed files: `app/dungeon/{scene.tsx,scene.css}`,
`app/descent/{game.tsx,monster-reveal.tsx,monster-reveal.css}`,
`tests/{dungeon-scene.test.ts,monster-reveal.test.tsx,e2e/descent.spec.ts}`,
`FIRST_DESCENT.md`, `docs/phase-1-status.md` and this evidence record.

Status: **review build; not production-ready until phone/browser checks pass**.
First phone check: approach and immediately attack during the monster close-up;
collect loot and watch **Enter room** finish walking; meet Kevin at the left edge
after room 5 and right edge after room 9, then tap him to walk over and trade.

Current preview: source `be5ba23549e2731022e3423bb1ef6e312d8210f2`, deployment
`dpl_8HsWzkE7TB9Rb8bxDfckKzQ822na`, **READY**.
<https://delveworn-14qq8qy8o-crypto-mickle.vercel.app/play>

Seven-day deployment-specific phone access is delivered in the conversation;
the token is not committed. Delivery returned HTTP 200 with the expected
`Delveworn · The First Descent` title. This confirms delivery, not phone gameplay.
No production release, remote Git push or contract transaction was performed.

## Previous correction — movement and progression stall audit

The next phone report showed that the direct-exit fix was too narrow: free
movement before Approach could still stop progression. This audit covers start,
free movement, Approach, combat, physical loot pickup, recovery/entry, supply
shop, camp, boss relic choice, terminal result and restart.

| Stop path | Reproduction / change |
| --- | --- |
| First frame repeatedly starts at zero elapsed time | Legacy code made zero progress under eight retargets immediately before successive frames. Movement now starts at input time; the same test moves 20.73 room units. |
| Missing frames or unchanging frame timestamps | Legacy Approach never reached combat. Each frame now races an 80ms timer, with a shared monotonic clock. One winner updates the visible position; the losing callback is canceled. |
| Invalid SVG floor coordinates | Legacy NaN positions propagated into all later walks and queued frames forever. Singular/non-finite pointer conversions are ignored and the movement API rejects invalid points before scheduling. |
| Camera changes during walking | The old resize handler canceled the requested arrival. It now resumes the same intent from the displayed point using current reachable bounds and loot location. Zero/non-finite or inverted room measurements are ignored. |
| Another tab holds the save lock | The old request could wait indefinitely with actions locked. Non-queuing acquisition now returns a retry message without writing or switching to session-only play. |
| Save conflict behind a mobile panel | Blocked controls now reflect the actual lock. Save notices/recovery are also inside shop, reward and terminal panels; a valid restored save clears stale blocked state. |

Hidden/blurred pages still cancel walking deliberately. A new foreground input
restarts it; stale frame/timer callbacks cannot arrive, collect or enter twice.
**Enter room** remains direct after collected loot. Combat/RNG/reward rules,
transparent loot art, original monster/player artwork, viewport tracks, save
format and the Somnia/chain boundary are unchanged.

### Actual verification

- **121 unit/integration tests passed, 0 failed.** New scheduler tests cover
  missing/throwing RAF, stale/constant timestamps, fallback cancellation, first
  frame progress, retargeting, invalid coordinates and once-only pickup. Camera
  tests reject hidden/invalid measurements before they can displace a walker. Six
  save-lock tests cover acquisition, held locks, retry, fallback and conflict
  preservation. Existing Practice/Weekly golden traces pass.
- TypeScript and Somnia standard production build passed.
- Full ESLint: **0 errors, 14 pre-existing warnings**.
- Temporary no-DOM React 19.2.8 harness exercised actual DescentGame and
  DungeonScene callbacks with normal, constant-timestamp and absent RAF modes:
  free walk → retarget → Approach reached combat in all three modes; invalid/null
  pointer matrices did not poison later movement; resize continued the intent;
  blur/visibility cancellation allowed a fresh Approach afterwards.
- Targeted component guard test: width 0/NaN, height 0/Infinity and width 1
  preserved the exact avatar position and active frame/timer IDs. A subsequent
  valid 320×500 resize replaced the job once and reached combat through fallback
  timers, leaving zero movement handles. Bundle: `client-repro-resize-guard.cjs`.
- Full actual-component run with RAF never delivered: seed 1 completed all ten
  rooms, with **51 turns, 68 HP, won**, and 30 expected phase transitions. The
  run bought Bandage/Potion after room 5 and Rest/Potion/Weapon after room 9;
  resized during room-3 Approach and room-5/9 loot walks; and picked up each
  reward physically through fallback movement. Zero movement frames remained
  at victory. Restart returned a fresh explore state, revision 0 / cleared 0,
  without needing the cosmetic focus frame.
- Browser test discovery: **167 cases**, including 32 Descent device cases. A
  new persisted scenario covers free walking → retarget → Approach → kill →
  pickup → room 2 with RAF disabled; the explicit-exit regression remains.
  These browser scenarios are **unexecuted**. Approved Browser navigation was
  retried; its mandatory admin-policy verification remains unavailable. No
  alternate browser was used to bypass it. Node/component checks do not verify
  actual iPhone rendering or responsiveness.

Temporary component harness: `/tmp/delveworn-rtr-19-2-8/client-repro.tsx`, compiled
as `client-repro-full.cjs`. It is not a repository dependency. No new production
or test package, account, wallet, RPC, telemetry service or transaction was added.

Changed code: `app/dungeon/{movement.ts,scene.tsx}`,
`app/descent/{game.tsx,save-lock.ts}`, `tests/dungeon-movement.test.ts`,
`tests/descent-save-lock.test.ts`, `tests/dungeon-scene.test.ts`,
`tests/e2e/descent.spec.ts`; documentation:
`FIRST_DESCENT.md`, `phase-1-status.md` and this record.

Status: **review build; not production-ready until actual phone verification**.
First external check: walk left/right and retarget several times before using
Approach, collect loot, then continue through the shop/camp and boss. Open/close
the phone browser's chrome during a walk and resume after backgrounding once.
These corrections remove reproducible code paths; the exact phone trigger has
not been directly observed in an automated browser.

Current preview: source `ab0fb81efee78793c24ba2634ce44e265812430f`, deployment
`dpl_BuFYbDSgA9vXkrUXTGv4r7nsTqgi`, **READY**.
<https://delveworn-1xrmpwyi0-crypto-mickle.vercel.app/play>

Seven-day deployment-specific phone access delivered in the conversation; the
access token is not committed. Delivery check: HTTP 200 with the expected
`Delveworn · The First Descent` title. This is a delivery check, not a browser
playthrough. No production deployment, remote Git push or contract transaction.
The intermediate `cf9db19` deployment was superseded before delivering a phone
link; it lacked the final invalid-measurement guard.

## Previous correction — exit blocked after collecting loot

The supplied phone screenshots distinguish this case from an exception: room 1
is cleared, Grave Belle is at 0 HP, loot is collected, the log still opens and
closes, and Potion is enabled. Only **Walk to room 2** is disabled. Its disabled
condition included local walking state; Potion only depends on the game action
lock/resources. This explains why the error-report screen did not appear.

Reproduction with the previous scene: leave a movement frame queued without
servicing it. Recovery stays at revision 5, Potion is available and the exit is
disabled. This establishes a progress dependency on cosmetic walking. It does
not establish why animation frames stopped or remained pending on this phone.

The explicit **Enter room** button now cancels movement and calls the existing
guarded enter transition directly after collection. Floor-door walking remains
available; loot still requires reaching pickup range. Approach, pickup and shop
shortcuts can be retried/retargeted while walking. Art, camera tracks, combat,
RNG, rewards and save format are unchanged. Local error reporting is retained.

Verification:

- Temporary no-DOM React 19.2.8 harness: the corrected exit advanced to room 2
  with a deliberately stalled movement clock. Two immediate clicks committed
  exactly one revision (5 → 6), no frame remained queued, pending game actions
  disabled entry, and entry was absent before loot collection. Also passed
  50 lethal attacks and 10 full kill → collect → enter flows, 30 in Strict Mode.
- **111 unit/integration tests passed; 0 failed.** The new scene test covers
  exit visibility after collection, pending-action gating and other phases.
- TypeScript and the Somnia standard production build passed.
- Full ESLint: **0 errors, 14 existing warnings**.
- Browser suite discovery: **163 cases**, including 28 Descent device cases.
  A persisted paused-frame regression checks the actual rendered button,
  double-click protection, cancelled movement and saved room-2 recovery.
  Browser scenarios are **unexecuted**: the approved Browser's mandatory admin
  policy verification remains unavailable. No alternate browser is used.

Changed files: `app/dungeon/scene.tsx`, `app/descent/game.tsx`,
`tests/dungeon-scene.test.ts`, `tests/e2e/descent.spec.ts` and documentation.
The temporary React harness lives under `/tmp/delveworn-rtr-19-2-8/`; no package
or telemetry dependency was added.

Status: **review build; phone confirmation required; not production-ready**.
First check: defeat room 1, walk to loot, tap **Enter room 2**, and confirm the
next monster appears. Repeat through several rooms, including during movement.

Exit correction preview: source `76f17c093d6d43de17339d376f9a47008075b9e2`,
deployment `dpl_Fq8t71GVCLT6ckYDKFZoPvgKeQPG`, **READY**.
<https://delveworn-c4ouy8jy3-crypto-mickle.vercel.app/play>

Seven-day deployment-specific phone access was created; its token is only in
the conversation/local temporary access file. Delivery check: HTTP 200 with
`Delveworn · The First Descent`. This is not browser interaction verification.
No production release, remote Git push or contract transaction.

## Previous diagnostic preview — reported post-kill crash

The user reports another crash after a lethal attack on the walking-hotfix
preview. This crash has **not been reproduced or declared fixed**. The next
preview adds recovery and a copyable error report to obtain the missing phone
exception without developer tools or new telemetry.

Investigation evidence:

- 5,000 actual first-kill snapshots rendered without exceptions, covering all
  four generated loot kinds; separate SSR checks cover post-kill cues and boss
  loot. No model/loot-index exception was found.
- A temporary no-DOM React 19.2.8 test-renderer harness exercised the actual
  DescentGame/DungeonScene callbacks: 50 lethal attacks and 10 full kill → collect
  → enter flows, including 30 Strict Mode runs. No exception or remaining
  timer/frame/listener was observed. This is not browser or GPU verification.
- Injecting an audio exception after the lethal save verified the new async
  failure path: the event promise was handled, the error reached a render
  boundary, retry restored the exact saved loot state, and collection applied
  it once. No replay/reward duplication or saved-state rewrite occurred.
- **110 unit/integration tests passed; 0 failed.** TypeScript, targeted ESLint
  and Somnia standard production build passed. Browser execution remains
  unavailable because of the admin-policy check; phone confirmation is pending.

Implementation: `/play` now has an error boundary with **Resume saved run** and
**Copy error report**. Async action failures enter that boundary instead of
leaving an unhandled rejection and a locked action state. The report contains
only error text and saved room/phase/revision; run IDs/seeds/inventory are omitted,
preview access tokens are removed, and nothing is sent automatically. Rendering
or copying the report does not replace saved progress. A browser process crash
or full page reload cannot be caught by this React boundary.

Changed files: `app/play/error.tsx`, `app/descent/{game.tsx,failure.ts}`,
`tests/descent-failure.test.ts`, and documentation. The temporary diagnostic
harness and test-renderer dependency are under `/tmp/delveworn-rtr-19-2-8/`;
no new production or test dependency was added to the repository.

Status at that checkpoint: **diagnostic review build; not production-ready**.
The later phone screenshots supplied the missing distinction; see the current
exit correction above.

Diagnostic preview: source `3520e1e96b86a9fd6487be3dd9a0dc40c473d809`, deployment
`dpl_7Vg1JUa7e5HbHt1NRNHk4SS1Pc9K`, **READY**.
<https://delveworn-hwt42twxp-crypto-mickle.vercel.app/play>

Seven-day deployment-specific phone link delivered in the conversation; access
token never committed. Delivery check: `/play` returned HTTP 200 with the expected
First Descent title. This does not verify gameplay on the affected phone.
No production release, remote Git push, external error collection or transaction.

## Previous hotfix — avatar turns but walking never starts

The phone review of `e10f0ac` exposed a browser-specific error missed by the
injected test clock: native `requestAnimationFrame`/`cancelAnimationFrame` were
copied onto another object and invoked with that object as their receiver.
Facing changed before scheduling threw, so the avatar could turn but not walk.

The default clock now calls both methods through `window`. A new test exercises
the actual default clock against Window-receiver checks, including movement,
cancellation and arrival after restarting. It failed on the previous code and
passes with the fix. The full suite is **108 passed, 0 failed**; TypeScript and
targeted ESLint passed; Somnia standard production build passed.

Approved Browser navigation was retried for `/play`; the required admin-policy
check remains unavailable. No alternate browser was used. The physical phone
flow is still unverified; this is a review preview, not production-ready.
Changes: `app/dungeon/movement.ts`, `tests/dungeon-movement.test.ts` and this
record. Camera layout, art, combat rules and loot placement are unchanged.

Current preview: source `964812d0e9b0d72daf04670403209c94db9051a1`, deployment
`dpl_6aLDHnfo1CrqC34rqsBoT7WLCdHM`, **READY**.
<https://delveworn-8ju886rrq-crypto-mickle.vercel.app/play>

Seven-day deployment-specific access link delivered in the conversation; token
not committed. After access propagation, the link returned HTTP 200 with the
expected First Descent title; avatar asset also returned 200. These are delivery
checks only. The previous movement preview below is superseded. No production
release, remote Git push or onchain transaction.

## Previous correction — stable room, walking and automatic loot

User reported zooming on each attack, hopping during Approach and requested
random floor drops, automatic pickup by proximity and horizontal avatar facing.

- Mobile HUD/floor/control grid tracks now depend on the viewport, not changing
  action descriptions. The same tracks apply through exploration, combat, loot
  and recovery. Enemy/player HP and Storm/Potion/Attack placement are preserved.
- One animation clock updates visible movement and arrival. Retargeting starts
  from the visible point; arrival no longer snaps to a second combat anchor.
  Walking bob is removed; the original avatar artwork mirrors left/right.
- Loot position comes from an independent seed/room hash fitted to the visible
  floor. Navigating within 32 room units automatically applies the existing
  pending reward once. Pointer, arrows and accessible walking shortcuts work.
  Reload reproduces placement at the same viewport; changing camera bounds
  cancels movement so the next input targets the displayed drop.
- Original combat model, RNG, save format, monster/loot artwork and contracts
  are unchanged. No extra wallet, network service or analytics dependency.

Actual checks: **107 unit/integration tests passed, 0 failed**; explicit
TypeScript passed; Somnia standard production build passed. ESLint: **0 errors,
14 existing warnings**. Browser discovery: **159 cases**, including 24 Descent
device cases; discovery is not execution. New executable tests
cover smooth movement, interrupted/retargeted walks, once-only proximity pickup,
facing, and 25,000 reproducible/reachable loot placements across viewport sizes.
Updated browser scenarios inspect actual SVG transforms while busy and after
attacks, Approach continuity, visual mirroring, floor/keyboard pickup and resize.
They remain **unexecuted** because the required browser admin-policy check is
unavailable. No physical-phone or screenshot verification is claimed.

Changed implementation: `app/dungeon/{movement.ts,scene.tsx,scene.css}`,
`app/descent/{game.tsx,game.css,combat-panel.css}`. Tests:
`tests/{dungeon-movement.test.ts,dungeon-scene.test.ts,e2e/descent.spec.ts}`.
Play instructions and continuation record updated. This remains a review
build, not production-ready.

Current preview: source `e10f0ac749add0a4189c769fa13d9a2d6bdddb3e`, deployment
`dpl_Gi5zAp9ckc9vtA2GaMK9zhYQ3dmi`, **READY**.
<https://delveworn-je3id3u2k-crypto-mickle.vercel.app/play>

Deployment-specific seven-day access link delivered in the conversation; token
never committed. HTTP delivery checks: `/play` 200 with expected title; room,
avatar, Grave Belle and potion assets 200. These checks are not browser gameplay
verification. Earlier previews below are superseded. No production release,
remote Git push or contract transaction.

## Previous correction — use Practice combat controls in the room

User reported missing monster HP and incorrect action placement. The live
`https://delveworn.app/practice` review was attempted with the approved in-app
Browser, but the mandatory admin-policy check failed. No alternate access path
was used. Findings below come from local Delveworn Practice source, not a live
visual inspection of production.

Reference implementation: `app/game-ui.tsx` (`DungeonBattle`, `CombatActionDock`),
`app/globals.css` combat rules and `app/practice/page.tsx` supplied values.

Adopted into `/play`:

- Dedicated mobile enemy name, current/max HP, red health bar and retaliation.
  Zero HP remains visible after victory. Boss health retains its distinct color.
- Reuse of the real `CombatActionDock`, without editing that shared component.
  Storm is left and Attack right. Potion is below, or centered at mobile
  viewport heights <=700px. Scoped styles do not modify other game modes.
- Player and enemy HP beside actions; low-health coloring; TOOK/DEALT and critical
  feedback; real zero-damage exchanges remain zero rather than unset.
- Potion stock, per-encounter 2/3-use limits, actual disabled reasons and healing/
  retaliation consequences. Room/camp and loot authority remain unchanged.
- Readable last-action feedback and a modal log; combat shortcuts ignore open
  modals/menus. A/S/P aliases apply in combat, preserving scene walking elsewhere.

Actual checks: **102 unit/integration tests passed, 0 failed**; TypeScript passed;
ESLint **0 errors, 14 existing warnings**; Somnia standard production build passed.
Browser discovery: **159 cases**. Updated device specs assert visible HP, Attack
right/Potion middle-or-below, damage updates, no attacks behind the log, and
viewport fit. These browser tests remain **unexecuted** because of the policy
check failure. No current mobile screenshot or physical-phone verification is
claimed. This is a review build, not production-ready.

Changes: `app/descent/combat-panel.{tsx,css}`, `app/descent/game.{tsx,css}`,
`app/dungeon/scene.{tsx,css}`, `tests/descent-combat-panel.test.tsx`,
`tests/e2e/descent.spec.ts` and the play/verification documents. Original Practice
components, combat model/storage, raster assets and contracts are unchanged.

Current preview: source `ec3c502f120bb8dac51213eb0f2072b900a8ab73`, deployment
`dpl_6CaykjEikF8rTW2njLEcNb5iDyMa`, **READY**.
<https://delveworn-rktmwhhpc-crypto-mickle.vercel.app/play>

Seven-day access link delivered in the conversation; token never committed.
HTTP checks: `/play` 200 with expected title; stone room, Grave Belle and potion
assets 200. These are delivery checks, not visual gameplay verification. Previous
preview links below are superseded. Production, remote Git and contracts untouched.

## Previous correction — fullscreen mobile room panel

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
